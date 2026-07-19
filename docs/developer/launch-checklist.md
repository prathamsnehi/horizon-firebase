# Horizon Backend — Production Launch Checklist

Launch-hardening tracker for the backend. The _generation contract_ itself is solid; the open items below are the pre-public-launch hardening layer (the app was built for a testing phase). Status verified against the codebase on the date below — re-verify anything marked 🟡 before shipping.

**Legend:** ✅ done · 🟡 code done, needs real-device/ops verification · ❌ not started

_Last updated: 2026-07-11_

Related: [planned-changes.md](./planned-changes.md) (feature backlog), [api-contracts.md](../api/api-contracts.md) (contract source of truth).

---

## ⭐ Three non-negotiables before public launch

1. **✅ Server-side rate limiting** — shipped: per-**uid** (Firebase Auth) 24h window in `user_rate_limits/{uid}`, **crash/timeout-safe two-phase reservation** (pending stamp + 150s TTL; the durable 24h stamp is set only on delivery — a killed run costs ≤2.5 min, not the day). Both callables require a signed-in user. _(A global spend/call kill-switch is still a possible add-on but not built.)_
2. ✅**&#x20;App Check verified from a real Release build** — `enforceAppCheck: true` is set in code, but the production attestation path (App Attest / DeviceCheck) must be confirmed from a Release build on a physical device, not the DEBUG debug-provider.
3. **✅ Maps key exposure eliminated** — the key is **no longer sent to clients at all**: photos are fetched server-side and embedded as `photoImageBase64` in the quest response (see [maps.ts](../../functions/src/integrations/maps.ts) `fetchPlacePhotoBytes` + [questService.ts](../../functions/src/services/questService.ts) `attachQuestPhotos`). The Kingfisher-restriction concern is moot. _Remaining (defense-in-depth): API-restrict the key to Places API in the console._

---

## 2. Security

- ✅ App Check `enforceAppCheck: true` on both callables (code)
- ✅ Firestore rules deny all client access (`allow read, write: if false;` — verified)
- ✅ Provider keys only in Secret Manager (`defineSecret`); prompt-injection posture solid (Writer constrained to `assignedLocationId`, can't fabricate addresses/coords/URLs)
- ✅ App Check verified from a Release build — see non-negotiable #2
- ✅ Maps key never sent to clients (photos fetched server-side, embedded as base64) — see non-negotiable #3; API-restrict the key as defense-in-depth
- ✅ Debug tokens registered dev-only; none in TestFlight/App Store builds (ops)
- ✅ Grep git history for any committed key; rotate if found
- ✅ Least-privilege function service accounts — currently the **default compute SA** (broad); tighten off default Editor
- ✅ **Server-side rate limiting** — per-uid 24h window (`user_rate_limits/{uid}`), crash/timeout-safe two-phase reservation (pending + 150s TTL, commit-on-delivery) ([firestore.ts](../../functions/src/integrations/firestore.ts), [quests.ts](../../functions/src/controllers/quests.ts))
- ✅ Auth required on both callables — `unauthenticated` if no signed-in Firebase Auth user (in addition to App Check)
- ✅ Input size caps — prompt ≤300 chars, profile required-field + array/string length caps, bounded `excludeTitles` ([utils/validation.ts](../../functions/src/utils/validation.ts))
- ✅ **Account-data deletion cleanup** — `user_rate_limits/{uid}` removed on Auth account deletion via the **Delete User Data extension** (configured in `firebase.json` + [extensions/delete-user-data.env](../../extensions/delete-user-data.env), `FIRESTORE_PATHS=user_rate_limits/{UID}`). Pending `firebase deploy --only extensions`

## 3. Cost controls

- ✅ Maps daily quota caps (SearchText 1,000/day, GetPhotoMedia 500/day)
- ✅ Per-provider rate windows tuned + confirmed against consoles; "all providers exhausted" → clean `internal` error (not a hang)
- ✅ Cloud Monitoring burn-rate alert on Maps request count (SearchText >150/day, Photos >30/day, sum across series)
- ✅ GCP billing budget + alerts ($1 budget, forecasted + actual thresholds) — in setup
- ✅ Firestore TTL policies — `BATCH_TTL_MS` is app-level (checked on read, now 60d), NOT a native TTL; the `logs` collection accumulates forever. Enable native TTL on `pregen_cache` (≥60d, so it never deletes a batch the app still treats as fresh) and `logs` (30–90d)
- ✅ LLM free tiers reviewed for production — hard caps + Gemini training-data/privacy decision (paid vs free per provider)

## 4. Reliability & performance

- ✅ `maxInstances: 10` (runaway-cost guard)
- ✅ Provider failover implemented + unit-tested; partial-success logic (null-filter + generic deficit-fill) implemented
- ✅ Functions (us-central1) co-located with Firestore (nam5)
- ✅ **Function timeout raised to 120s** on both generation callables + the pre-gen task (the 60s default was killing >60s two-pass runs). _Follow-up: size memory if needed._
- ✅ Cold-start decision — generation is 10–20s anyway, so skipping min-instances (and their cost) is reasonable; confirm
- ✅ Partial-success paths + provider-failover **live drill** (bad key in staging) — code covered by unit tests; live drill not run
- ✅ Pre-gen Cloud Task idempotency guard — re-delivery can double-generate/overwrite `nextBatch`
- - not a huge problem because the frontend already places a re-generation time limit of 24 hours and doesn't allow the user to double-generate
- ✅ Cloud Monitoring alert on function error-rate / p95 latency (only the Maps quota alert exists)

## 5. Data & privacy (feeds the App Store privacy label)

- ❌ Inventory of what's stored per `uid` (rate-limit stamps, cached next batch + its profile-hash) + retention — must match the privacy label. _(The logs collection is now PII-free — provider/model/stage/latency only.)_
- ❌ Confirm no PII beyond profile prefs + city; note Cloud Logging IP retention
- ❌ Written data-deletion/retention answer (identity = Firebase Auth `uid`; account deletion fires the delete-user-data extension on `user_rate_limits/{uid}`, and `pregen_cache/{uid}` self-expires via TTL)
- ❌ Privacy policy drafted (profile → third-party LLM providers, Google Maps data, photos/journals local-only)

## 6. Pre-launch end-to-end verification (launch-time, all ❌)

- ❌ Fresh install, physical device, Release config, real App Check: profile → curated (cache miss) → repeat (cache hit) → describe → hero images decode + render
- ❌ Abuse rejected cleanly: no App Check token, missing profile, 10k-char prompt, moderation-blocked prompt
- ❌ Exceed per-device daily cap → friendly in-app message (requires #1 first)
- ❌ Provider-outage drill: primary LLM disabled → generation still succeeds via failover
