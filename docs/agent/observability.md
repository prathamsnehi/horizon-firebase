# Observability — generation samples

Every generation the server runs emits **one anonymous document** to the
`generation_samples` collection. A single record serves three purposes at once:

- **Error tracking** — `outcome` plus the failing stage and error message.
- **Performance observability** — the full pipeline waterfall: each stage as an
  ordered span with start-offset and latency, including the LLM router's
  provider/model failover chain (`attemptLog`).
- **A training corpus** — the profile that went in and the quests that came out,
  retained indefinitely to improve generation later.

Because the record carries **no identity**, it is safe in every environment.
There is no test/production distinction, no flag, and nothing to remember to
turn off — it simply always runs.

## What a sample contains

```
generation_samples/{autoId}
  traceId, type            curated | described | pregen
  startedAt, totalLatencyMs
  outcome                  success | error | rate_limited | invalid
  error                    message, when outcome is error
  spans[]                  stage, offsetMs, latencyMs, input, output, meta
                           (meta carries provider/model/attempts/attemptLog
                            for the four LLM stages)
  result                   the generated quests
```

## What it deliberately does not contain

The anonymity is structural, not a policy — these are dropped at the capture
site by [sanitize.ts](../../functions/src/observability/sanitize.ts):

| Dropped | Why |
|---|---|
| `uid` | The join key. Without it, two samples cannot be linked to one person. |
| `profileHash` / `cachedHash` | A stable digest of the profile is a pseudonymous ID in disguise — it would re-link every sample from the same user. |
| `additionalContext` | Unbounded free text: highest re-identification risk, least training value. |
| The rendered LLM prompts | Three redundant copies of the profile in prose. The structured inputs are kept instead. |
| Anything with `outcome: "blocked"` | No sample is written at all. A moderated prompt is the one thing this corpus must never accumulate. |
| Place photo bytes | Only the reference, byte count and content type are recorded. |

Freeform text that *is* kept — the describe `prompt` and any user-written
comfort-zone edge — passes through `scrubText`, which strips emails, phone
numbers, URLs and @handles. That is a best-effort floor rather than a guarantee,
and it matters doubly if the corpus is ever used for training, since models
memorize verbatim strings.

City coordinates are coarsened to two decimal places (~1 km); the city name
carries the actual signal.

> **Strongly de-identified, not legally anonymous.** With no stable identifier
> the records are unlinkable, and any single record is a thin slice — but a rare
> combination of preferences in a small city could in principle narrow things
> down. Treat the corpus accordingly, and disclose de-identified collection in
> the privacy policy.

## Implementation

Built on Node's `AsyncLocalStorage`, so deep pipeline functions record spans into
the active request's trace without threading a context through every signature.
It is concurrency-safe (gen2 serves multiple requests per instance) and a no-op
when no context is active, so unit tests and un-wrapped paths record nothing.

See [tracer.ts](../../functions/src/observability/tracer.ts) (`runTrace` / `span`
/ `recordSpan` / `setTraceField`) and `saveGenerationSample` in
[firestore.ts](../../functions/src/integrations/firestore.ts).

## Reading samples

The `/admin` dashboard in `hosting/` reads them live from Firestore — health
metrics over a time window, and a log viewer that renders each sample's spans as
a waterfall with the `attemptLog` failover chain and every stage's input/output.
See [../developer/admin-dashboard.md](../developer/admin-dashboard.md).

It reads with the Firestore **client** SDK, gated by the security rules
(`admins/{uid}` must exist). There is no longer a script or an Admin SDK path for
this — a second reader would be a second thing to keep in step with the sample
schema. The Firestore console is the zero-setup fallback if the dashboard is ever
unavailable.

## Known gap — no quality labels

Samples record what went in and what came out, but not whether the user swiped
right or completed the quest; that state lives on-device and never reaches the
server. A corpus without labels can teach a model to imitate today's generator,
not to beat it. An anonymous completion ping is the highest-value addition, and
it is the same signal the v2 design already assumes for Thompson sampling (see
[horizon-architecture-v2.md](./v2/horizon-architecture-v2.md) §11).
