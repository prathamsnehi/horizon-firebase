import * as functions from "firebase-functions/v2";
import { getFunctions } from "firebase-admin/functions";
import {
  CuratedQuestRequest,
  DescribedQuestRequest,
  QuestResponse,
  DescribedQuestResponse,
  QuestItem,
  PregenTaskPayload,
} from "../types";
import {
  generateBatch,
  generateDescribed,
  attachQuestPhotos,
} from "../services/questService";
import { hashProfile } from "../utils/hash";
import {
  validateProfilePayload,
  validateDescribePrompt,
  validateExcludeTitles,
} from "../utils/validation";
import {
  flushLogs,
  getUserQuestState,
  saveServedBatch,
  saveDescribeResult,
  reserveRateLimitSlot,
  commitRateLimitSlot,
  releaseRateLimitSlot,
  dateKey,
} from "../integrations/firestore";
import {
  geminiApiKey,
  placesApiKey,
  groqApiKey,
  mistralApiKey,
  cerebrasApiKey,
  CURATED_BATCH_SIZE,
  BATCH_TTL_MS,
  PREGEN_TASK_NAME,
} from "../config";

const LLM_SECRETS = [
  geminiApiKey,
  placesApiKey,
  groqApiKey,
  mistralApiKey,
  cerebrasApiKey,
];

/**
 * Lightweight moderation for the freeform describe prompt. v1: reject obviously
 * dangerous requests via a keyword blocklist; provider safety settings are the
 * second line of defense. (A fuller moderation pass is a planned follow-up.)
 */
const DESCRIBE_BLOCKLIST = [
  "suicide",
  "self-harm",
  "self harm",
  "kill myself",
  "explosive",
  "make a bomb",
  "weapon",
  "overdose",
];
function isDescribePromptAllowed(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return !DESCRIBE_BLOCKLIST.some((term) => p.includes(term));
}

/** Best-effort enqueue of the background next-batch pre-generation task. */
async function enqueuePregen(payload: PregenTaskPayload): Promise<void> {
  try {
    await getFunctions().taskQueue(PREGEN_TASK_NAME).enqueue(payload);
  } catch (err) {
    console.error("[enqueuePregen] failed (next batch will be a sync miss):", err);
  }
}

/**
 * `generateCuratedQuests` — the client-facing daily batch.
 *
 * Cache-first: returns today's already-served batch (idempotent), else serves a
 * valid pre-generated batch, else generates synchronously. After serving, it
 * enqueues a Cloud Task to pre-generate the next batch. Count is server-controlled
 * (CURATED_BATCH_SIZE); the request carries only { profile, deviceId, excludeTitles? }.
 */
export const generateCuratedQuests = functions.https.onCall(
  { enforceAppCheck: true, secrets: LLM_SECRETS, timeoutSeconds: 120 },
  async (request): Promise<QuestResponse> => {
    // A: require authentication (App Check is enforced by the runtime).
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Sign in to generate quests."
      );
    }
    const uid = request.auth.uid;

    // C: validate structure + content before any spend or slot reservation.
    const data = request.data as CuratedQuestRequest;
    if (!data || typeof data !== "object" || typeof data.deviceId !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "Invalid request payload.");
    }
    const profileErr = validateProfilePayload(data.profile);
    if (profileErr) throw new functions.https.HttpsError("invalid-argument", profileErr);
    const excludeErr = validateExcludeTitles(data.excludeTitles);
    if (excludeErr) throw new functions.https.HttpsError("invalid-argument", excludeErr);

    const { profile, deviceId, excludeTitles } = data;

    // B: reserve the per-uid 24h curated slot (transactional, server time).
    const reservation = await reserveRateLimitSlot(uid, "curated");
    if (!reservation.allowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "You've used today's curated quest. Come back tomorrow.",
        { retryAt: reservation.retryAt, scope: "curated" }
      );
    }

    try {
      const today = dateKey();
      const hash = hashProfile(profile);
      const state = await getUserQuestState(deviceId);

      // Serve a valid pre-generated batch, else generate synchronously. Caching
      // and pre-gen are a cost optimization, not a rate limit.
      const nextValid =
        !!state?.nextBatch?.length &&
        state.nextBatchHash === hash &&
        !!state.nextBatchCreatedAt &&
        Date.now() - state.nextBatchCreatedAt < BATCH_TTL_MS;

      let batch: QuestItem[];
      const cached = nextValid;

      if (nextValid) {
        batch = state!.nextBatch!;
      } else {
        batch = await generateBatch(profile, CURATED_BATCH_SIZE, excludeTitles ?? []);
      }

      // Persist today's served batch (references only — clears the consumed
      // next batch)...
      await saveServedBatch(deviceId, batch, today);
      // ...and queue up the next one so tomorrow is instant.
      await enqueuePregen({ deviceId, profile });
      // Flush the best-effort stage logs before the container can freeze.
      await flushLogs();

      console.log(`[generateCuratedQuests] served ${batch.length} quests (cached=${cached})`);

      // Embed hero-image bytes for the response ONLY, after persisting (so the
      // stored/cached batch stays reference-only and under Firestore's 1MB cap).
      const responseBatch = await attachQuestPhotos(batch);

      // Commit LAST (quests are landing): starts the 24h window at delivery and
      // clears the pending stamp. A timeout before this leaves only the pending
      // stamp, which self-expires in ≤150s — no burned day.
      await commitRateLimitSlot(uid, "curated");
      return { quests: responseBatch };
    } catch (error) {
      // Generation failed — free the pending slot immediately (best-effort; a
      // process death would let it self-expire within 150s instead).
      await releaseRateLimitSlot(uid, "curated");
      console.error("[generateCuratedQuests] Fatal error:", error);
      throw new functions.https.HttpsError(
        "internal",
        "An error occurred while generating quests."
      );
    }
  }
);

/**
 * `generateUserDescribedQuest` — one tailored quest from a freeform
 * prompt. Auto-decides real-location vs location-agnostic. Limited to one per
 * day per device: a repeat with the SAME prompt re-serves (retry-safe), a
 * DIFFERENT prompt the same day is rejected as rate-limited.
 */
export const generateUserDescribedQuest = functions.https.onCall(
  { enforceAppCheck: true, secrets: LLM_SECRETS, timeoutSeconds: 120 },
  async (request): Promise<DescribedQuestResponse> => {
    // A: require authentication (App Check is enforced by the runtime).
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Sign in to generate quests."
      );
    }
    const uid = request.auth.uid;

    // C: validate structure + content before any spend or slot reservation.
    const data = request.data as DescribedQuestRequest;
    if (!data || typeof data !== "object" || typeof data.deviceId !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "Invalid request payload.");
    }
    const promptErr = validateDescribePrompt(data.prompt);
    if (promptErr) throw new functions.https.HttpsError("invalid-argument", promptErr);
    const profileErr = validateProfilePayload(data.profile);
    if (profileErr) throw new functions.https.HttpsError("invalid-argument", profileErr);

    const prompt = data.prompt.trim();
    const { profile, deviceId } = data;

    // Moderation — before spend and before reserving the slot.
    if (!isDescribePromptAllowed(prompt)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "That request can't be turned into a quest."
      );
    }

    // B: reserve the per-uid 24h described slot (transactional, server time).
    const reservation = await reserveRateLimitSlot(uid, "described");
    if (!reservation.allowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "You've used today's custom quest. Come back tomorrow.",
        { retryAt: reservation.retryAt, scope: "described" }
      );
    }

    const today = dateKey();
    try {
      const quest = await generateDescribed(prompt, profile);
      await flushLogs();
      if (!quest) {
        throw new Error("Describe generation produced no quest.");
      }
      console.log("[generateUserDescribedQuest] served a described quest");
      // Persist the reference-only result first, then embed the image bytes for
      // the response (keeps the stored copy byte-free).
      await saveDescribeResult(deviceId, quest, prompt, today);
      const [responseQuest] = await attachQuestPhotos([quest]);

      // Commit LAST (quest is landing): starts the 24h window at delivery.
      await commitRateLimitSlot(uid, "described");
      return { quest: responseQuest };
    } catch (error) {
      // Generation failed — free the pending slot immediately (best-effort; a
      // process death would let it self-expire within 150s instead).
      await releaseRateLimitSlot(uid, "described");
      console.error("[generateUserDescribedQuest] Fatal error:", error);
      throw new functions.https.HttpsError(
        "internal",
        "An error occurred while crafting your quest."
      );
    }
  }
);
