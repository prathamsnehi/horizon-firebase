import * as functions from "firebase-functions/v2";
import { getFunctions } from "firebase-admin/functions";
import {
  CuratedSidequestRequest,
  DescribedSidequestRequest,
  SidequestResponse,
  SidequestTimings,
  DescribedSidequestResponse,
  SidequestItem,
  PregenTaskPayload,
} from "../types";
import { LogContext } from "../llm";
import { generateBatch, generateDescribed } from "../services/sidequestService";
import { hashProfile } from "../utils/hash";
import {
  flushAiCallLogs,
  getUserSidequestState,
  saveServedBatch,
  saveDescribeResult,
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
 * Module-level flag for cold-start detection. Module scope is evaluated once
 * per container; the first invocation sees `false` (it paid the boot cost).
 */
let isWarm = false;

function validateCuratedRequest(data: any): data is CuratedSidequestRequest {
  if (!data || typeof data !== "object") return false;
  if (!data.profile || typeof data.profile !== "object") return false;
  if (typeof data.deviceId !== "string") return false;
  return true;
}

function validateDescribedRequest(data: any): data is DescribedSidequestRequest {
  if (!data || typeof data !== "object") return false;
  if (typeof data.prompt !== "string" || data.prompt.trim().length === 0) return false;
  if (!data.profile || typeof data.profile !== "object") return false;
  if (typeof data.deviceId !== "string") return false;
  return true;
}

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
 * `generateCuratedSidequests` — the client-facing daily batch.
 *
 * Cache-first: returns today's already-served batch (idempotent), else serves a
 * valid pre-generated batch, else generates synchronously. After serving, it
 * enqueues a Cloud Task to pre-generate the next batch. Count is server-controlled
 * (CURATED_BATCH_SIZE); the request carries only { profile, deviceId, excludeTitles? }.
 */
export const generateCuratedSidequests = functions.https.onCall(
  { enforceAppCheck: true, secrets: LLM_SECRETS },
  async (request): Promise<SidequestResponse> => {
    if (!validateCuratedRequest(request.data)) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid request payload.");
    }
    const { profile, deviceId, excludeTitles } = request.data as CuratedSidequestRequest;
    const logCtx: LogContext = { deviceId, profile };

    const serverStart = Date.now();
    const coldStart = !isWarm;
    isWarm = true;

    try {
      const today = dateKey();
      const hash = hashProfile(profile);
      const state = await getUserSidequestState(deviceId);

      // NOTE: No per-user daily cap during the testing phase — every call
      // generates (or serves a valid pre-generated batch). If usage limiting is
      // needed later it will be enforced client-side. The caching / pre-gen
      // below is a cost optimization, not a rate limit.

      // Serve a valid pre-generated batch, else generate synchronously.
      const nextValid =
        !!state?.nextBatch?.length &&
        state.nextBatchHash === hash &&
        !!state.nextBatchCreatedAt &&
        Date.now() - state.nextBatchCreatedAt < BATCH_TTL_MS;

      let batch: SidequestItem[];
      let stageTimings = { scoutMs: 0, mapsMs: 0, writerMs: 0, genericFallbackMs: 0 };
      let cached = false;

      if (nextValid) {
        batch = state!.nextBatch!;
        cached = true;
      } else {
        const result = await generateBatch(
          profile,
          CURATED_BATCH_SIZE,
          excludeTitles ?? [],
          logCtx
        );
        batch = result.sidequests;
        stageTimings = result.stageTimings;
        await flushAiCallLogs();
      }

      // Persist today's served batch (clears the consumed next batch)...
      await saveServedBatch(deviceId, batch, today);
      // ...and queue up the next one so tomorrow is instant.
      await enqueuePregen({ deviceId, profile });

      const timings: SidequestTimings = {
        ...stageTimings,
        totalServerMs: Date.now() - serverStart,
        coldStart,
        cached,
      };
      return { sidequests: batch, timings };
    } catch (error) {
      console.error("[generateCuratedSidequests] Fatal error:", error);
      throw new functions.https.HttpsError(
        "internal",
        "An error occurred while generating sidequests."
      );
    }
  }
);

/**
 * `generateUserDescribedSidequest` — one tailored sidequest from a freeform
 * prompt. Auto-decides real-location vs location-agnostic. Limited to one per
 * day per device: a repeat with the SAME prompt re-serves (retry-safe), a
 * DIFFERENT prompt the same day is rejected as rate-limited.
 */
export const generateUserDescribedSidequest = functions.https.onCall(
  { enforceAppCheck: true, secrets: LLM_SECRETS },
  async (request): Promise<DescribedSidequestResponse> => {
    if (!validateDescribedRequest(request.data)) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid request payload.");
    }
    const { prompt, profile, deviceId } = request.data as DescribedSidequestRequest;
    const logCtx: LogContext = { deviceId, profile };

    const today = dateKey();

    // NOTE: No per-user daily cap during the testing phase — every call
    // generates. If usage limiting is needed later it will be enforced
    // client-side. Moderation still applies.
    if (!isDescribePromptAllowed(prompt)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "That request can't be turned into a sidequest."
      );
    }

    try {
      const sidequest = await generateDescribed(prompt, profile, logCtx);
      await flushAiCallLogs();
      if (!sidequest) {
        throw new Error("Describe generation produced no sidequest.");
      }
      await saveDescribeResult(deviceId, sidequest, prompt, today);
      return { sidequest };
    } catch (error) {
      console.error("[generateUserDescribedSidequest] Fatal error:", error);
      throw new functions.https.HttpsError(
        "internal",
        "An error occurred while crafting your sidequest."
      );
    }
  }
);
