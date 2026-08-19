# Backend architecture

Firebase Cloud Functions (2nd gen, Node 22, TypeScript), organised as
**Controller → Service → Integration**, with two cross-cutting layers (`llm/`,
`observability/`). The only client is a separate iOS/SwiftData app that does not
live in this repository.

## Layout

```
functions/src/
├── index.ts              exports every function
├── config.ts             secrets (defineSecret) + constants
├── types.ts              every interface: wire shapes, Firestore docs, rate state
│
├── controllers/          Layer 1 — Firebase entrypoints
│   ├── quests.ts         generateCuratedQuests, generateUserDescribedQuest
│   └── tasks.ts          pregenerateCuratedBatch (onTaskDispatched)
├── services/             Layer 2 — business logic, framework-free
│   └── questService.ts   generateBatch, generateDescribed, attachQuestPhotos
├── integrations/         Layer 3 — the outside world
│   ├── maps.ts           Places API (New): search + photo bytes
│   └── firestore.ts      cache, rate limits, LLM rate buckets, samples
│
├── llm/                  provider-agnostic LLM layer (Vercel AI SDK)
│   ├── router.ts         rate-aware distribution + failover
│   ├── models.ts         provider registry, per-stage candidate lists
│   ├── rateLimits.ts     per-model free-tier windows
│   ├── rateMath.ts       pure token-bucket / fixed-window math
│   ├── schemas.ts        Zod structured-output schemas
│   └── tasks.ts          scout / writer / generic / planner calls
│
├── observability/        anonymous per-generation samples
│   ├── tracer.ts         AsyncLocalStorage spans, one doc per request
│   └── sanitize.ts       the de-identification choke point
└── utils/                hash, distance, prompts, validation, rateLimit
```

**Layer rules.** Controllers do Firebase things only — validate `request.data`,
read `request.auth.uid`, map thrown errors to `HttpsError`. No AI logic, no keys,
no direct database calls. Services take plain arguments and return plain objects,
which is why they are unit-testable. Integrations wrap third-party SDKs so a
vendor change touches one file.

## Request flow — curated batch (cache-first)

1. Auth check (`request.auth`), then `validateProfilePayload` / `validateExcludeTitles`
   — **before** any spend or slot reservation.
2. `reserveRateLimitSlot(uid, "curated")` — writes a short-lived pending stamp.
3. Read `pregen_cache/{uid}`. A batch is usable only if its `nextBatchHash`
   matches `hashProfile(profile)` and it is younger than `BATCH_TTL_MS` (60d).
4. **Hit** → serve it. **Miss** → `generateBatch`: Scout LLM emits Maps queries →
   `getBestLocation` in parallel → Haversine distance + heuristic transport →
   Writer LLM → generic quests fill any shortfall.
5. Clear the consumed cache entry, enqueue the Cloud Task for the next batch,
   flush logs — all in one `Promise.all`.
6. `attachQuestPhotos` embeds hero-image bytes **for the response only** (after
   persisting, so the stored batch stays reference-only and under Firestore's
   1 MB cap), in parallel with `commitRateLimitSlot`.

`generateUserDescribedQuest` follows the same shape with a planner deciding
location vs generic, and is never pre-generated.

## Rate limiting — two-phase, crash-safe

State in `user_rate_limits/{uid}`; server time only; keyed on the verified
`request.auth.uid`, never a payload field.

- **Pending stamp** written inside a transaction *before* generation. Blocks
  concurrent duplicates and retries within `PENDING_TTL_MS` (90s).
- **Durable stamp** set only at delivery, so the 24h window starts when quests
  actually land.
- Failure clears the pending stamp; a killed process lets it self-expire. A dead
  run costs the user ~90s, not a day. The 90s TTL stays ≥ the 60s function
  timeout so a still-running generation cannot be double-entered.

Pure logic lives in `utils/rateLimit.ts` (`evaluateReservation`), which is why it
is cheaply testable. Exempt uids short-circuit all three phases — see
[secrets](../developer/secrets.md).

## LLM routing

Four free-tier providers (Gemini primary, then Groq, Mistral, Cerebras) behind
`generateObjectWithRouting`. A Firestore-backed multi-window limiter
(`llm_rate_buckets/global`) tracks per-**model** windows — limits are metered per
model, not per provider — and orders candidates by scarcest-window headroom. On a
429/transient/schema error the router drains that model's window and falls to the
next candidate. `maxRetries: 0` is deliberate: the SDK's own retry would hammer a
down model before failover.

**It fails open.** If the limiter store is unavailable, routing falls back to
static priority order so generation never blocks on bookkeeping.

## Fault tolerance

Partial success everywhere. Fewer resolved concepts than `CURATED_BATCH_SIZE`
does not throw — whatever resolved goes to the Writer, and `generateGenericQuests`
fills the deficit with location-agnostic quests that skip Maps entirely. A Maps
outage or a zero-coverage region still returns a usable batch. Photo attach is
best-effort: a failed fetch just omits the image and the client shows a
placeholder.

Not built: a cross-request circuit breaker, and a per-SKU daily spend cap
(`budget_counters/{sku}:{date}`) — see [backlog](./backlog.md).

## Cost posture

- Places calls request **Pro-tier fields only** (no `editorialSummary`/`rating`),
  keeping every call on the cheaper Text Search Pro SKU. The location summary is
  written by the Writer LLM instead.
- Per-user pre-generation via Cloud Tasks makes the common path a cache hit.
- A **cross-user** shared pool (hash `city + vibe + interests`) is the big
  unbuilt lever.
- `maxInstances: 10` caps runaway concurrency.

## Privacy posture

- Profiles sent to LLM providers carry only abstract preferences — never names,
  emails, or exact addresses. `utils/validation.ts` enforces shape and caps
  before any prompt is built.
- `generation_samples` is anonymous by construction — see
  [observability](./observability.md).
- Firestore rules deny all client access; everything goes through the Admin SDK.
- The Maps key never leaves the backend: photos are fetched server-side and
  embedded as base64.
