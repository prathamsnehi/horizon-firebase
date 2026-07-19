/**
 * Request-scoped end-to-end tracing (TEST BRANCH ONLY).
 *
 * Captures one self-contained trace document per request — an ordered list of
 * pipeline spans (Scout → Maps → Writer → generic, plus rate-limit/cache/photo
 * bookkeeping) with per-stage input/output and latency — for feeding into a
 * timeline/waterfall visualizer.
 *
 * The trace context lives in an {@link AsyncLocalStorage}, so deep pipeline
 * functions record spans into the *currently active* request's trace without any
 * of them taking a tracer parameter. It is **concurrency-safe** (gen2 handles
 * multiple requests per instance) and a **no-op when no context is active** — so
 * un-wrapped paths and unit tests record nothing and never crash.
 *
 * This module exists only on the `test` branch; `main` never imports it.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { saveTrace } from "../integrations/firestore";

export type TraceType = "curated" | "described" | "pregen";
export type TraceOutcome =
  | "success"
  | "error"
  | "rate_limited"
  | "invalid"
  | "blocked";

export interface TraceSpan {
  seq: number;
  stage: string; // "scout" | "maps.resolve" | "writer" | "generic" | ...
  offsetMs: number; // start, relative to trace start
  latencyMs: number;
  input?: unknown; // stage-specific
  output?: unknown;
  meta?: Record<string, unknown>;
}

export interface TraceContext {
  traceId: string;
  type: TraceType;
  uid?: string;
  startMs: number;
  spans: TraceSpan[];
  outcome?: TraceOutcome;
  error?: string;
  result?: unknown; // final assembled quests (image bytes stripped)
  _seq: number; // internal span counter
}

export interface TraceInit {
  type: TraceType;
  uid?: string;
}

const als = new AsyncLocalStorage<TraceContext>();

/** The active request's trace, or undefined outside any {@link runTrace}. */
export function currentTrace(): TraceContext | undefined {
  return als.getStore();
}

/** Patch top-level trace fields (uid, outcome, result, …). No-op if inactive. */
export function setTraceField(patch: Partial<TraceContext>): void {
  const ctx = als.getStore();
  if (!ctx) return;
  Object.assign(ctx, patch);
}

/**
 * Record a pre-timed span. Use where the latency is already known (e.g. the
 * router's RoutingResult.latencyMs). No-op when no trace is active.
 */
export function recordSpan(
  stage: string,
  fields: {
    input?: unknown;
    output?: unknown;
    meta?: Record<string, unknown>;
    latencyMs?: number;
    /** Explicit start (ms epoch). Defaults to now − latency. */
    startMs?: number;
  } = {}
): void {
  const ctx = als.getStore();
  if (!ctx) return;
  const now = Date.now();
  const latencyMs = fields.latencyMs ?? 0;
  const startMs = fields.startMs ?? now - latencyMs;
  ctx.spans.push({
    seq: ++ctx._seq,
    stage,
    offsetMs: startMs - ctx.startMs,
    latencyMs,
    input: fields.input,
    output: fields.output,
    meta: fields.meta,
  });
}

/**
 * Time an async operation and auto-record it as a span. Returns the op's value.
 * When no trace is active this just runs `fn` (no timing overhead recorded).
 */
export async function span<T>(
  stage: string,
  fn: () => Promise<T>,
  opts: {
    input?: unknown;
    /** Derive the span's `output`/`meta` from the result. */
    onResult?: (result: T) => { output?: unknown; meta?: Record<string, unknown> };
  } = {}
): Promise<T> {
  const ctx = als.getStore();
  if (!ctx) return fn();

  const startMs = Date.now();
  try {
    const result = await fn();
    const derived = opts.onResult ? opts.onResult(result) : {};
    recordSpan(stage, {
      startMs,
      latencyMs: Date.now() - startMs,
      input: opts.input,
      output: derived.output,
      meta: derived.meta,
    });
    return result;
  } catch (err) {
    recordSpan(stage, {
      startMs,
      latencyMs: Date.now() - startMs,
      input: opts.input,
      meta: { ok: false, error: String((err as Error)?.message ?? err) },
    });
    throw err;
  }
}

/**
 * Open a trace context, run `fn` inside it, and write exactly one `debug_logs`
 * document when it settles. Stamps `outcome`/`totalLatencyMs`; on a thrown error
 * it records `outcome:"error"` (unless the handler already set a more specific
 * one) and rethrows — the trace write never masks the handler's result or error.
 */
export async function runTrace<T>(
  init: TraceInit,
  fn: () => Promise<T>
): Promise<T> {
  const ctx: TraceContext = {
    traceId: randomUUID(),
    type: init.type,
    uid: init.uid,
    startMs: Date.now(),
    spans: [],
    _seq: 0,
  };

  try {
    const result = await als.run(ctx, fn);
    if (!ctx.outcome) ctx.outcome = "success";
    return result;
  } catch (err) {
    if (!ctx.outcome) ctx.outcome = "error";
    if (!ctx.error) ctx.error = String((err as Error)?.message ?? err);
    throw err;
  } finally {
    await saveTrace(toTraceDoc(ctx));
  }
}

/**
 * Serialize a trace context to the document written to Firestore. `undefined`
 * fields (which Firestore rejects) are dropped downstream by {@link saveTrace}'s
 * JSON round-trip, so we can build this object directly.
 */
function toTraceDoc(ctx: TraceContext): Record<string, unknown> {
  return {
    traceId: ctx.traceId,
    type: ctx.type,
    uid: ctx.uid,
    startedAt: ctx.startMs,
    totalLatencyMs: Date.now() - ctx.startMs,
    outcome: ctx.outcome ?? "success",
    error: ctx.error,
    spans: ctx.spans,
    result: ctx.result,
  };
}
