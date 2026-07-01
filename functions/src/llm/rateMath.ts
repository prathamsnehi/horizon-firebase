import {
  RateWindowConfig,
  RateWindowState,
  BucketWindowState,
  FixedWindowState,
} from "../types";

/**
 * Pure (Firestore-free) rate-window math, so it can be unit-tested in isolation
 * and reused by the Firestore transaction in the limiter.
 */

export interface AdvanceResult {
  /** The window state advanced to `now` (refilled bucket / rolled counter). */
  state: RateWindowState;
  /** Whether at least one unit is available. */
  hasHeadroom: boolean;
  /** Remaining capacity (tokens for buckets, `limit - count` for counters). */
  remaining: number;
}

/**
 * Advance a window to `now` without consuming: refill token buckets by elapsed
 * time; roll fixed-window counters over when their window has elapsed.
 */
export function advanceWindow(
  w: RateWindowConfig,
  prev: RateWindowState | undefined,
  now: number
): AdvanceResult {
  if (w.strategy === "bucket") {
    const s = (prev as BucketWindowState) ?? {
      tokens: w.limit,
      lastRefillMs: now,
    };
    const elapsed = Math.max(0, now - s.lastRefillMs);
    const refill = (elapsed / w.windowMs) * w.limit;
    const tokens = Math.min(w.limit, s.tokens + refill);
    return {
      state: { tokens, lastRefillMs: now },
      hasHeadroom: tokens >= 1,
      remaining: tokens,
    };
  }

  // Fixed window (hard cap that resets at the window boundary).
  let s = (prev as FixedWindowState) ?? { count: 0, windowStartMs: now };
  if (now - s.windowStartMs >= w.windowMs) {
    s = { count: 0, windowStartMs: now };
  }
  const remaining = w.limit - s.count;
  return { state: s, hasHeadroom: remaining >= 1, remaining };
}

/**
 * Consume one unit from an already-advanced window state.
 */
export function consumeWindow(
  w: RateWindowConfig,
  state: RateWindowState
): RateWindowState {
  if (w.strategy === "bucket") {
    const s = state as BucketWindowState;
    return { tokens: Math.max(0, s.tokens - 1), lastRefillMs: s.lastRefillMs };
  }
  const s = state as FixedWindowState;
  return { count: s.count + 1, windowStartMs: s.windowStartMs };
}
