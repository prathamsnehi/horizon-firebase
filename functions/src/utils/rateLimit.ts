/**
 * Pure 24h rolling-window rate-limit math, kept Firestore-free so it can be
 * unit-tested in isolation and reused by the transactional reservation in
 * integrations/firestore.ts. Always driven by SERVER time.
 */

/** The rolling window: one action per uid per 24 hours. */
export const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface RateWindowEvaluation {
  allowed: boolean;
  /** Epoch-ms when the next attempt becomes allowed (present only when denied). */
  retryAtMs?: number;
}

/**
 * Evaluate whether an action is allowed under the 24h rolling window.
 * @param lastMs epoch-ms of the last successful action, or null if never.
 * @param nowMs  current server epoch-ms.
 */
export function evaluateRateWindow(
  lastMs: number | null,
  nowMs: number
): RateWindowEvaluation {
  if (lastMs == null) return { allowed: true };
  if (nowMs - lastMs < RATE_WINDOW_MS) {
    return { allowed: false, retryAtMs: lastMs + RATE_WINDOW_MS };
  }
  return { allowed: true };
}
