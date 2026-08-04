# Observability — end-to-end request tracing (TEST BRANCH ONLY)

> This tracing layer lives **only on the `test` branch**. `main` stays clean —
> it has the PII-free `logs` collection (per-stage provider/model/latency) but
> none of the per-request tracing below. Deploy from `test` for R&D; redeploy
> `main` to remove it.

## What it does

Every request the server handles emits **one Firestore document** to the
`debug_logs` collection — a self-contained trace of the whole pipeline: the
inbound profile/prompt, each stage as an ordered span with start-offset +
latency, the Scout/Writer/generic/planner LLM calls (including the
provider/model **failover chain** via `attemptLog`), Maps resolution per
concept, photo-attach byte sizes (never the base64), and the final outcome.

Implemented with Node's `AsyncLocalStorage` so deep pipeline functions record
into the active request's trace without threading a context object through every
signature — and it's a **no-op when no trace is active**, so unit tests and any
un-wrapped path record nothing. See [tracer.ts](../../functions/src/observability/tracer.ts)
(`runTrace` / `span` / `recordSpan` / `setTraceField`) and `saveTrace` in
[firestore.ts](../../functions/src/integrations/firestore.ts).

## Pulling a trace

`functions/scripts/get-trace.js` dumps `debug_logs` as clean JSON via the Admin
SDK (uses ADC + `GOOGLE_CLOUD_PROJECT=horizon-sidequests`):

```bash
cd functions
node scripts/get-trace.js               # most recent trace
node scripts/get-trace.js --last 5      # the last 5
node scripts/get-trace.js <docId>       # a specific trace
node scripts/get-trace.js --type curated
```

## Visualizing

Pipe that JSON into the purpose-built waterfall viewer:

**Horizon Trace Viewer** → https://claude.ai/code/artifact/6b3223ae-4a13-45ca-8322-7e8c7c32a0a2

It renders the ordered spans as a timeline (offset + latency), surfaces the
`attemptLog` failover chain, and shows each stage's inputs/outputs — the fastest
way to see *why* a batch generated the way it did.

## Before launch

Redeploy `main` (drops all of the above) and wipe the disposable `debug_logs`
collection.
