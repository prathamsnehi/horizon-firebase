# Horizon Backend — Planned Architectural Changes

A living backlog of architectural changes under consideration but **not yet implemented**. This is a thinking space, not a commitment — items here are ideas to track, weigh, and sequence. When something ships, move the detail into [production-architecture.md](./production-architecture.md) or [backend-roadmap.md](./backend-roadmap.md) and mark it done here.

Related docs: [production-architecture.md](./production-architecture.md) (the aspirational production design), [backend-roadmap.md](./backend-roadmap.md) (build order), [api-contracts.md](../api/api-contracts.md) (the contract source of truth).

_Last updated: 2026-07-01_

---

## 0. Multi-provider LLM routing — SHIPPED (follow-ups tracked here)

The provider-agnostic LLM layer (`functions/src/llm/`) is implemented: Vercel AI SDK, Zod/`generateObject`, global Firestore multi-window rate limiter with failover, per-call `ai_call_logs`. Remaining follow-ups:

- **Confirm rate limits (now per-model).** [functions/src/llm/rateLimits.ts](../../functions/src/llm/rateLimits.ts) is keyed per model (`provider:model`) with safety-margined values from official docs (Groq/Gemini/Cerebras); Gemini numbers are mapped from the flash/flash-lite classes (confirm the 3.x names in the AI Studio dashboard), and Mistral RPM is unpublished/conservative. Verify each and tune.
- **Confirm free-tier model IDs.** [functions/src/llm/models.ts](../../functions/src/llm/models.ts) candidate model IDs churn — validate they exist on each provider's current catalog, and eval quality per provider before trusting the rotation (heterogeneous models = variable output quality).
- **Wire the load dashboard.** Enable AI SDK OpenTelemetry → Langfuse, and/or the Firestore→BigQuery→Looker Studio path on `ai_call_logs`.
- **Precise token (TPM/TPD) accounting** — v1 models only request-count windows (rpm/rpd) and leans on `penalizeLlmProvider` for token-limit 429s.
- **Shard the `llm_rate_buckets/global` doc** if single-doc write contention becomes a bottleneck (distributed-counter pattern).
- **`ai_call_logs` retention/TTL + sampling** once write volume matters.
- **Add more providers** (e.g. an OpenRouter free-model pool) if broader fallback breadth is ever needed — trivial via the AI SDK.

---

## 1. Reduce batch size (10 → 5 or 3)

**Status:** Idea / not scheduled
**Effort:** Trivial (backend-only)

Giving the user 10 sidequests per batch feels like too much choice, and every concept costs a Maps call. Dropping to **5 or 3** would:

- Improve the UX — fewer, higher-conviction options instead of an overwhelming list.
- Cut Maps + Gemini cost proportionally (batch size directly = number of Maps `searchText` calls; see cost notes below).

**Where it lives:** `count` flows from the client through the request. `SIDEQUEST_BATCH_SIZE` in [config.ts](../../functions/src/config.ts) is currently `10` but unused by the live path (the controller uses the request's `count`). Decide whether batch size is client-driven or server-enforced before changing it.

**Open questions:**
- 5 or 3? Test both for how "premium" a curated short list feels.
- Does a smaller batch make the generic-fallback deficit logic more/less noticeable?
- Interaction with pre-generation/caching (#3) — smaller batches are cheaper to pre-generate.

---

## 2. Per-query Maps cache (cost)

**Status:** Idea / recommended next cost lever
**Effort:** Moderate (backend-only)

Scout queries repeat heavily across users — "specialty coffee roasters in Saint Paul" is identical for everyone in that city — yet every request re-pays for the Places API call.

**Plan:** Before calling Places in [getBestLocation](../../functions/src/integrations/maps.ts), check a Firestore `places_cache` collection keyed by normalized `queryText`. On hit, reuse the stored raw place pool; on miss, fetch and store. Place data is stable, so a **30–90 day TTL** is fine. The random top-3 pick in `getBestLocation` still yields per-user variety from cached data, so quality/variety don't regress.

**Impact:** At scale, collapses repeated queries to a single paid call, then serves free for weeks. A good stepping stone toward #3.

---

## 3. Global quest caching + pre-generated batches (cost — the endgame)

**Status:** Designed, not built
**Effort:** Large (backend-only)

Already specced in [production-architecture.md](./production-architecture.md) and typed via [PregeneratedBatchDocument](../../functions/src/types.ts). The stubs [hash.ts](../../functions/src/utils/hash.ts) and [sidequestService.ts](../../functions/src/services/sidequestService.ts) are currently empty.

- **Global pool:** hash `city + vibe + interests` → serve a shared batch from Firestore. A cache hit costs **$0** (no Gemini *and* no Maps).
- **Pre-generation:** serve an instant pre-built batch, then rebuild the next one in the background.

This is the biggest cost lever but the most work. #2 is a lighter first move in the same direction.

---

## 4. Shed a Places API SKU tier (cost — minor)

**Status:** Idea / low priority
**Effort:** Trivial

The `searchText` FieldMask requests `places.editorialSummary`, an **Atmosphere-tier** field that pins every call to the top **Enterprise + Atmosphere** SKU. Dropping it falls to **Enterprise** (~12% cheaper per call). Tradeoff: lose the location `description`. Only worth it if `description` proves not to earn its keep.

_Note: fetching 10 candidates costs the same as fetching 1 — Text Search bills per call, not per result — so the quality-ranking in `getBestLocation` adds no cost._

---

## 5. "Focus / mood" signal for the current phase

**Status:** Idea / blocked on frontend
**Effort:** Small backend, but needs onboarding/UI change

Users' profiles are genuinely broad, but at any given time they're "in a phase" wanting more of a few specific things. An optional `focus`/`mood` field (e.g. "lately I'm into film photography, quiet mornings") that the Scout weights heavily would sharpen batches far better than inferring a focus from a noisy profile.

Deferred because it requires a frontend/onboarding change — the current push is to optimize the backend alone. Revisit alongside a broader onboarding revamp. See the Scout prompt in [prompts.ts](../../functions/src/utils/prompts.ts) for where this would plug in.

---

## Cost reference (as of 2026-06-30)

- Places API (New) Text Search bills **per call**, at the highest SKU tier any requested field touches. Current tier: **Enterprise + Atmosphere (~$40 / 1,000 calls = ~$0.04/call)**, driven by `editorialSummary`.
- One batch = `count` Maps calls (currently 10) ≈ **$0.40/batch**; ~$0.04 per place.
- Google Maps Platform has a **recurring monthly free tier** that comfortably covers development/low volume — verify exact caps in Console → Billing.
- **During development, stub Maps** with a fixture to avoid burning quota while iterating on prompts.
</content>
</invoke>
