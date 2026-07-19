import { getApps, initializeApp, App } from "firebase-admin/app";
import {
  getFirestore,
  Firestore,
  Timestamp,
  FieldValue,
} from "firebase-admin/firestore";
import {
  LogDocument,
  RateWindowConfig,
  ProviderRateState,
  RateWindowState,
  PregenCacheDocument,
  QuestItem,
} from "../types";
import { advanceWindow, consumeWindow } from "../llm/rateMath";
import { evaluateReservation } from "../utils/rateLimit";
import { BATCH_TTL_MS } from "../config";

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
// Pipeline-stage logging (logs)
// ------------------------------

/**
 * Best-effort writes are tracked here so the handler can flush them before the
 * container freezes (a warm container may otherwise pause an unawaited write).
 */
const pendingLogWrites: Promise<unknown>[] = [];

/**
 * Persist one PII-free stage log (latency + AI provider/model). Fire-and-forget:
 * failures are logged and swallowed so logging can never break or delay
 * generation. Awaited later via {@link flushLogs}.
 */
export function saveLog(doc: LogDocument): void {
  const write = getDb()
    .collection("logs")
    .add(doc)
    .catch((err) => {
      console.error("[saveLog] Failed to persist log:", err);
    });
  pendingLogWrites.push(write);
}

/**
 * Await any in-flight log writes. Call before returning the response so writes
 * land before the container can freeze. Never throws.
 */
export async function flushLogs(): Promise<void> {
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
  limits: Record<string, RateWindowConfig[]>,
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
          eligible[0],
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
// Pre-generation cache (pregen_cache/{uid})
// ------------------------------
// Ephemeral, regenerable cache of the next curated batch per user. NOT a
// durable store of user data — it holds only a pre-generated batch that the
// next request serves instantly, then discards.

const PREGEN_CACHE_COLLECTION = "pregen_cache";

/** Read a user's cached pre-generated batch (if any). */
export async function getPregenCache(
  uid: string,
): Promise<PregenCacheDocument | null> {
  const snap = await getDb()
    .collection(PREGEN_CACHE_COLLECTION)
    .doc(uid)
    .get();
  return snap.exists ? (snap.data() as PregenCacheDocument) : null;
}

/** Store a background pre-generated batch ready to serve next. */
export async function savePregeneratedBatch(
  uid: string,
  batch: QuestItem[],
  profileHash: string,
  createdAt: number = Date.now(),
): Promise<void> {
  await getDb()
    .collection(PREGEN_CACHE_COLLECTION)
    .doc(uid)
    .set(
      {
        uid,
        nextBatch: batch,
        nextBatchHash: profileHash,
        nextBatchCreatedAt: createdAt,
        expireAt: Timestamp.fromMillis(createdAt + BATCH_TTL_MS), // for the sake of native firestore TTL
      },
      { merge: true },
    );
}

/**
 * Invalidate a user's cached batch after it's been served, so a failed
 * re-generation can't serve the same batch twice.
 */
export async function clearPregenBatch(uid: string): Promise<void> {
  await getDb().collection(PREGEN_CACHE_COLLECTION).doc(uid).set(
    {
      uid,
      nextBatch: null,
      nextBatchHash: null,
      nextBatchCreatedAt: null,
    },
    { merge: true },
  );
}

// ------------------------------
// Per-uid rate limiting (user_rate_limits/{uid})
// ------------------------------

const RATE_LIMITS_COLLECTION = "user_rate_limits";

export type RateAction = "curated" | "described";

/** Durable "delivered" stamp — the 24h window is measured from this. */
function lastFieldFor(action: RateAction): string {
  return action === "curated" ? "lastCuratedAt" : "lastDescribedAt";
}
/** Short-lived "in-flight" stamp — reserved before generation, cleared after. */
function pendingFieldFor(action: RateAction): string {
  return action === "curated" ? "pendingCuratedAt" : "pendingDescribedAt";
}

export interface RateReservation {
  allowed: boolean;
  /** ISO8601 of when the next attempt is allowed (present only when denied). */
  retryAt?: string;
}

/**
 * Phase 1 of the crash/timeout-safe reservation. One transaction: deny if the
 * durable 24h window is open, or if an unexpired pending reservation exists
 * (blocks concurrent duplicates); otherwise write a fresh `pendingAt` stamp and
 * allow. The pending stamp — NOT a durable "used" stamp — is what a killed run
 * leaves behind; it self-expires after PENDING_TTL_MS, so no rollback is needed.
 * Server time only.
 */
export async function reserveRateLimitSlot(
  uid: string,
  action: RateAction,
): Promise<RateReservation> {
  const ref = getDb().collection(RATE_LIMITS_COLLECTION).doc(uid);
  const lastField = lastFieldFor(action);
  const pendingField = pendingFieldFor(action);
  const nowMs = Date.now();
  return getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : undefined;
    const lastTs = data?.[lastField] as Timestamp | undefined;
    const pendingTs = data?.[pendingField] as Timestamp | undefined;

    const result = evaluateReservation(
      lastTs ? lastTs.toMillis() : null,
      pendingTs ? pendingTs.toMillis() : null,
      nowMs,
    );
    if (!result.allowed) {
      return {
        allowed: false,
        retryAt: new Date(result.retryAtMs!).toISOString(),
      };
    }
    tx.set(
      ref,
      { [pendingField]: Timestamp.fromMillis(nowMs) },
      { merge: true },
    );
    return { allowed: true };
  });
}

/**
 * Phase 2 (success): commit the delivery. Sets the durable `lastAt = now` (the
 * 24h window starts here, at delivery) and clears the pending stamp. Call this
 * only once the quests are about to be returned to the client.
 */
export async function commitRateLimitSlot(
  uid: string,
  action: RateAction,
): Promise<void> {
  await getDb()
    .collection(RATE_LIMITS_COLLECTION)
    .doc(uid)
    .set(
      {
        [lastFieldFor(action)]: Timestamp.now(),
        [pendingFieldFor(action)]: FieldValue.delete(),
      },
      { merge: true },
    );
}

/**
 * Phase 2 (failure): best-effort clear of the pending stamp so a failed run
 * frees the slot immediately. If the process dies before this runs, the pending
 * stamp self-expires within PENDING_TTL_MS instead. Never throws.
 */
export async function releaseRateLimitSlot(
  uid: string,
  action: RateAction,
): Promise<void> {
  try {
    await getDb()
      .collection(RATE_LIMITS_COLLECTION)
      .doc(uid)
      .set({ [pendingFieldFor(action)]: FieldValue.delete() }, { merge: true });
  } catch (err) {
    console.error("[releaseRateLimitSlot] failed:", err);
  }
}

/** Delete a user's rate-limit doc (account-deletion cleanup). */
export async function deleteUserRateLimit(uid: string): Promise<void> {
  await getDb().collection(RATE_LIMITS_COLLECTION).doc(uid).delete();
}
