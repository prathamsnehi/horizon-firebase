import { getApps, initializeApp, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import {
  AiCallLogDocument,
  RateWindowConfig,
  ProviderRateState,
  RateWindowState,
  UserQuestStateDocument,
  QuestItem,
} from "../types";
import { advanceWindow, consumeWindow } from "../llm/rateMath";

/**
 * Initialize the Admin SDK once at module load (runs at cold start, before any
 * request). We capture the App instance and pass it explicitly to
 * getFirestore(app) rather than relying on default-app resolution, which was
 * throwing "default Firebase app does not exist" under firebase-admin 13.
 * `initializeApp()` with no args uses the default service-account credentials
 * and bypasses security rules.
 */
const app: App = getApps().length ? getApps()[0]! : initializeApp();
let db: Firestore | null = null;

function getDb(): Firestore {
  if (!db) {
    db = getFirestore(app);
  }
  return db;
}

// ------------------------------
// AI-call logging (ai_call_logs)
// ------------------------------

/**
 * Best-effort writes are tracked here so the handler can flush them before the
 * container freezes (a warm container may otherwise pause an unawaited write).
 */
const pendingLogWrites: Promise<unknown>[] = [];

/**
 * Persist one AI call's response tagged with provider + model. Fire-and-forget:
 * failures are logged and swallowed so logging can never break or delay
 * generation. Awaited later via {@link flushAiCallLogs}.
 */
export function saveAiCallLog(doc: AiCallLogDocument): void {
  const write = getDb()
    .collection("ai_call_logs")
    .add(doc)
    .catch((err) => {
      console.error("[saveAiCallLog] Failed to persist AI call log:", err);
    });
  pendingLogWrites.push(write);
}

/**
 * Await any in-flight AI-call-log writes. Call before returning the response so
 * writes land before the container can freeze. Never throws.
 */
export async function flushAiCallLogs(): Promise<void> {
  const inflight = pendingLogWrites.splice(0);
  if (inflight.length) {
    await Promise.allSettled(inflight);
  }
}

// ------------------------------
// Global rate distribution (llm_rate_buckets/global)
// ------------------------------

const RATE_BUCKET_DOC = "llm_rate_buckets/global";

/**
 * Reserve capacity for one AI call and return the candidate rate-keys reordered
 * so the one with the most available quota is tried first. Keys are per model
 * (`${provider}:${model}`) since limits are metered per model. Runs a single
 * Firestore transaction implementing a multi-window limiter: refills token
 * buckets by elapsed time, rolls fixed daily counters, and a model is eligible
 * only if ALL its windows have headroom. Decrements every window of the chosen
 * model.
 *
 * Fails open: on any error it returns the input order unchanged, so a Firestore
 * hiccup never blocks generation.
 */
export async function reserveLlmToken(
  candidateKeys: string[],
  limits: Record<string, RateWindowConfig[]>
): Promise<string[]> {
  try {
    const ref = getDb().doc(RATE_BUCKET_DOC);
    const now = Date.now();

    return await getDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data: Record<string, ProviderRateState> = snap.exists
        ? (snap.data() as Record<string, ProviderRateState>)
        : {};

      const headroom: Record<string, number> = {};
      const eligible: string[] = [];

      for (const key of candidateKeys) {
        const windows = limits[key] ?? [];
        const state: ProviderRateState = { ...(data[key] ?? {}) };
        let modelEligible = true;
        let minNormalized = 1; // normalized 0..1 headroom of the scarcest window

        for (const w of windows) {
          const advanced = advanceWindow(w, state[w.kind], now);
          state[w.kind] = advanced.state;
          if (!advanced.hasHeadroom) modelEligible = false;
          minNormalized = Math.min(minNormalized, advanced.remaining / w.limit);
        }

        data[key] = state;
        headroom[key] = windows.length ? minNormalized : 1;
        if (modelEligible) eligible.push(key);
      }

      // Choose the eligible model with the most scarce-window headroom.
      let chosen: string | null = null;
      if (eligible.length) {
        chosen = eligible.reduce(
          (best, key) => (headroom[key] > headroom[best] ? key : best),
          eligible[0]
        );
        const windows = limits[chosen] ?? [];
        const state = data[chosen];
        for (const w of windows) {
          state[w.kind] = consumeWindow(w, state[w.kind] as RateWindowState);
        }
        data[chosen] = state;
      }

      tx.set(ref, data);

      // Chosen first; remaining candidates by descending headroom.
      const rest = candidateKeys.filter((key) => key !== chosen);
      rest.sort((a, b) => (headroom[b] ?? 0) - (headroom[a] ?? 0));
      return chosen ? [chosen, ...rest] : candidateKeys;
    });
  } catch (err) {
    console.error("[reserveLlmToken] failing open to static order:", err);
    return candidateKeys;
  }
}

/**
 * Drain a model's windows after an observed 429 / failure, so routing avoids it
 * until the window recovers. `rateKey` is `${provider}:${model}`. Best-effort;
 * never throws. This is also the backstop for token-based (TPM/TPD) limits we
 * don't model explicitly.
 */
export async function penalizeRateKey(rateKey: string): Promise<void> {
  try {
    const ref = getDb().doc(RATE_BUCKET_DOC);
    await getDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data() as Record<string, ProviderRateState>;
      const state = data[rateKey];
      if (!state) return;

      for (const kind of Object.keys(state)) {
        const s = state[kind] as RateWindowState;
        if ("tokens" in s) {
          s.tokens = 0;
        } else {
          // Exhaust the fixed window until it rolls over.
          s.count = Number.MAX_SAFE_INTEGER;
        }
      }

      data[rateKey] = state;
      tx.set(ref, data);
    });
  } catch (err) {
    console.error("[penalizeRateKey] failed:", err);
  }
}

// ------------------------------
// Per-user quest cache + daily usage (user_quests/{deviceId})
// ------------------------------

const USER_QUESTS_COLLECTION = "user_quests";

/** Current UTC date as "YYYY-MM-DD" — the daily-reset key. */
export function dateKey(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export async function getUserQuestState(
  deviceId: string
): Promise<UserQuestStateDocument | null> {
  const snap = await getDb()
    .collection(USER_QUESTS_COLLECTION)
    .doc(deviceId)
    .get();
  return snap.exists ? (snap.data() as UserQuestStateDocument) : null;
}

/**
 * Persist the batch most recently served to the user, and clear the
 * now-consumed pre-generated batch.
 */
export async function saveServedBatch(
  deviceId: string,
  batch: QuestItem[],
  date: string
): Promise<void> {
  await getDb()
    .collection(USER_QUESTS_COLLECTION)
    .doc(deviceId)
    .set(
      {
        deviceId,
        servedBatch: batch,
        servedDate: date,
        nextBatch: null,
        nextBatchHash: null,
        nextBatchCreatedAt: null,
      },
      { merge: true }
    );
}

/** Store a background pre-generated batch ready to serve next. */
export async function savePregeneratedBatch(
  deviceId: string,
  batch: QuestItem[],
  profileHash: string,
  createdAt: number = Date.now()
): Promise<void> {
  await getDb()
    .collection(USER_QUESTS_COLLECTION)
    .doc(deviceId)
    .set(
      {
        deviceId,
        nextBatch: batch,
        nextBatchHash: profileHash,
        nextBatchCreatedAt: createdAt,
      },
      { merge: true }
    );
}

/** Persist the most recently described quest (cache only). */
export async function saveDescribeResult(
  deviceId: string,
  quest: QuestItem,
  prompt: string,
  date: string
): Promise<void> {
  await getDb()
    .collection(USER_QUESTS_COLLECTION)
    .doc(deviceId)
    .set(
      {
        deviceId,
        describeResult: quest,
        describePrompt: prompt,
        describeDate: date,
      },
      { merge: true }
    );
}
