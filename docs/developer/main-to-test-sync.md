# `main` → `test` sync log

Changes landed on `main` that must be mirrored onto the long-lived `test`
branch. `test` carries extra observability (the `debug_logs` tracer) that never
exists on `main`, so a plain merge is avoided — apply these edits by hand, then
tick them off. Delete an entry once it's synced.

---

## Pending: eliminate `deviceId` (swap to authenticated `uid`)

`deviceId` is gone from the backend. Per-user identity is now the Firebase Auth
`uid` (already on every call). The `pregen_cache` collection is now keyed on
`uid` instead of the client-supplied `deviceId`; the field is dropped from both
request payloads. (iOS handoff lives in
`docs/frontend/deviceid-to-uid-migration.md`.)

### Part A — core swap (identical to what's on `main`)

- [ ] **`functions/src/types.ts`**
  - Remove `deviceId` from `CuratedQuestRequest` and `DescribedQuestRequest`.
  - `PregenCacheDocument`: `deviceId: string` → `uid: string`; update the doc
    comment (`pregen_cache/{deviceId}` → `pregen_cache/{uid}`, "for a device" →
    "for a user").
  - `PregenTaskPayload`: `deviceId: string` → `uid: string`.

- [ ] **`functions/src/integrations/firestore.ts`**
  - `getPregenCache`, `savePregeneratedBatch`, `clearPregenBatch`: rename the
    param `deviceId` → `uid`, key the doc on `uid` (`.doc(uid)`), and store the
    field as `uid` (not `deviceId`).
  - Update the section header/comment (`pregen_cache/{deviceId}` → `{uid}`,
    "per device" → "per user").

- [ ] **`functions/src/controllers/quests.ts`** (core logic only — see Part B for
  the tracer lines)
  - Curated callable: drop `typeof data.deviceId !== "string"` from the payload
    guard; destructure `{ profile, excludeTitles }` (no `deviceId`); use the
    in-scope `uid` for `getPregenCache(uid)`, `clearPregenBatch(uid)`, and
    `enqueuePregen({ uid, profile })`.
  - Described callable: drop `typeof data.deviceId !== "string"` from the guard.
  - Fix the doc comment: `{ profile, deviceId, excludeTitles? }` →
    `{ profile, excludeTitles? }`.

- [ ] **`functions/src/controllers/tasks.ts`** (core logic only — see Part B)
  - Destructure `{ uid, profile }` from the payload; guard `if (!uid || !profile)`;
    `savePregeneratedBatch(uid, …)`; update the log line to `${uid}`.

### Part B — test-only tracer follow-ups (these lines don't exist on `main`)

On `test`, the tracer still threads `deviceId` around. Since `deviceId` no longer
exists and the trace already carries `uid` (passed into `runTrace` init), fold
these onto `uid` and drop the now-dead `deviceId` trace field:

- [ ] **`functions/src/controllers/quests.ts`**
  - Curated: delete the `setTraceField({ deviceId });` line — `uid` is already set
    via `runTrace({ type: "curated", uid }, …)`.
  - Described: delete `setTraceField({ deviceId: data.deviceId });` — `uid` is
    already set via `runTrace({ type: "described", uid }, …)`.

- [ ] **`functions/src/controllers/tasks.ts`**
  - `runTrace({ type: "pregen", deviceId }, …)` → `runTrace({ type: "pregen", uid }, …)`.

- [ ] **`functions/src/observability/tracer.ts`**
  - Remove the `deviceId?: string` field from `TraceContext` (and `TraceSpan` if
    present), the `deviceId: init.deviceId` line in trace init, and the
    `deviceId: ctx.deviceId` line in `toTraceDoc`. Update the `setTraceField`
    doc comment that lists `deviceId`.

- [ ] **`functions/src/tests/observability/tracer.test.ts`**
  - Drop `deviceId` from `setTraceField({ deviceId: "d1", … })` and the
    `expect(doc.deviceId).toBe("d1")` assertion; change
    `runTrace({ type: "pregen", deviceId: "d" }, …)` →
    `runTrace({ type: "pregen", uid: "d" }, …)`.

## Pending: pregen task timeout 120s → default 60s

- [ ] **`functions/src/controllers/tasks.ts`** — remove the
  `timeoutSeconds: 120` line from `pregenerateCuratedBatch` entirely so it falls
  to the 60s default (same approach the callables took when they dropped
  `timeoutSeconds` in commit `124fe55`).

## Pending: backend cleanup pass (leaner/coherence/perf)

- [ ] **`functions/src/integrations/maps.ts`** — `getTopLocation` /
  `getRandomLocation` moved to the bottom of the file (below `fetchPlacePhotoBytes`),
  bodies unchanged, under a "not currently wired in" section comment. Purely
  cosmetic reorder. _(Note: `test`'s `maps.ts` has the richer
  `fetchPlacePhotoBytes` returning `{ base64, contentType, bytes }` — leave that
  as-is; only the function ordering moves.)_

- [ ] **`functions/src/integrations/firestore.ts`** — delete the unused
  `deleteUserRateLimit(uid)` function (account deletion is handled by the
  `delete-user-data` extension, not this).

- [ ] **`functions/src/types.ts`** — `LogDocument.stage` union gains `"planner"`.

- [ ] **`functions/src/llm/tasks.ts`** — widen `logCall`'s `stage` param to
  include `"planner"`; add `logCall("generic", result)` in `generateGenericQuests`
  and `logCall("planner", result)` in `planDescribedQuest` (these AI calls were
  never logged). _(On `test` these also have `recordSpan` calls — keep those.)_

- [ ] **`functions/src/services/questService.ts`** — step comments in
  `generateBatch` renumbered to `STEP 1..5` (was `PASS 1 / STEP 2 / 3 / PASS 4 /
  STEP 4.5`). Also confirm the `enrichLocations` `export` is dropped (done on
  `main`). Cosmetic.

- [ ] **`functions/src/utils/rateLimit.ts`** — `PENDING_TTL_MS` `150_000` →
  `90_000` + refreshed comment (timeout is now 60s).

- [ ] **`functions/src/tests/utils/rateLimit.test.ts`** — the invariant test
  `PENDING_TTL_MS ≥ 120_000` → `≥ 60_000` (and its title).

- [ ] **`functions/src/controllers/quests.ts`** — two hot-path parallelizations
  + the `150s`→`90s` comment updates:
  - Curated: `clearPregenBatch` + `enqueuePregen` + `flushLogs` collapsed into one
    `Promise.all`; `attachQuestPhotos` + `commitRateLimitSlot` into another
    `Promise.all([...])` destructured as `const [responseBatch] = …`.
  - Described: `attachQuestPhotos([quest])` + `commitRateLimitSlot` into one
    `Promise.all`, destructured `const [[responseQuest]] = …`.
  - **Care on `test`:** the tracer version wraps `commitRateLimitSlot` in
    `span("ratelimit.commit", …)` — put the `span(...)` call inside the
    `Promise.all` in place of the bare `commitRateLimitSlot`, so the span still
    records. Also update the `≤150s` / `within 150s` comments to `90s`.

---

### Verify on `test`

- [ ] `yarn tsc --noEmit && yarn jest` (from `functions/`) — green.
- [ ] `grep -rn "deviceId" functions/src` returns nothing.
