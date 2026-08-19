# Horizon Backend — Planned Architectural Changes

A living backlog of architectural changes under consideration but **not yet implemented**. This is a thinking space, not a commitment — items here are ideas to track, weigh, and sequence. When something ships, move any lasting detail into [architecture.md](./architecture.md) and remove it from here.

Related docs: [architecture.md](./architecture.md) (the aspirational production design), [api-contracts.md](../api/api-contracts.md) (the contract source of truth).

_Last updated: 2026-07-02_

---

## 1. Multi-provider LLM routing — remaining follow-ups

The routing layer itself is in place; these are the open items around it.

- **Confirm rate limits (per-model).** [rateLimits.ts](../../functions/src/llm/rateLimits.ts) is keyed per model (`provider:model`) with safety-margined values from official docs (Groq/Gemini/Cerebras); Gemini numbers are mapped from the flash/flash-lite classes (confirm the 3.x names in the AI Studio dashboard), and Mistral RPM is unpublished/conservative. Verify each and tune.
- **Confirm free-tier model IDs + eval quality.** [models.ts](../../functions/src/llm/models.ts) candidate model IDs churn — validate they exist on each provider's current catalog, and eval quality per provider before trusting the rotation (heterogeneous models = variable output quality).
- **Wire the load dashboard.** Enable AI SDK OpenTelemetry → Langfuse, and/or the Firestore→BigQuery→Looker Studio path on the `logs` collection (PII-free: stage/provider/model/latency).
- **Precise token (TPM/TPD) accounting** — currently only request-count windows (rpm/rpd) are modeled; token-limit 429s lean on `penalizeRateKey`.
- **Shard the llm_rate_buckets/global doc** if single-doc write contention becomes a bottleneck (distributed-counter pattern).
- **logs retention/TTL + sampling** once write volume matters.
- **Add more providers** (e.g. an OpenRouter free-model pool) if broader fallback breadth is ever needed — trivial via the AI SDK.

---

## 2. Cache-first quests + describe mode — remaining follow-ups

The per-user cache-first flow and describe mode are in place; these remain.

- **PT-accurate daily reset** — currently UTC date keys; align to the provider/product timezone later.
- **Fuller describe moderation** — currently a lightweight keyword blocklist + provider safety; add a real moderation pass.
- **Enable the Cloud Tasks API** in the project for pre-gen enqueue to work (ops).
- Cross-user global pool — see #4.

---

## 3. Per-query Maps cache (cost)

**Status:** Idea / recommended next cost lever
**Effort:** Moderate (backend-only)

Scout queries repeat heavily across users — "specialty coffee roasters in Saint Paul" is identical for everyone in that city — yet every request re-pays for the Places API call.

**Plan:** Before calling Places in [getBestLocation](../../functions/src/integrations/maps.ts), check a Firestore `places_cache` collection keyed by normalized `queryText`. On hit, reuse the stored raw place pool; on miss, fetch and store. Place data is stable, so a **30–90 day TTL** is fine. The random top-5 pick in `getBestLocation` still yields per-user variety from cached data, so quality/variety don't regress. (Considered a semantic/vector cache — rejected: embeddings under-weight the city, risking wrong-city results; only viable with city-partitioning.)

**Impact:** At scale, collapses repeated queries to a single paid call, then serves free for weeks. A good stepping stone toward #4.

---

## 4. Global quest caching — cross-user shared pool (cost — the endgame)

**Status:** Idea / open (per-user pre-generation already exists; the cross-user pool does not)
**Effort:** Large (backend-only)

Hash `city + vibe + interests` → serve a _shared_ batch across users. A cache hit costs **$0** (no LLM _and_ no Maps). This is the bigger cost lever: many users in the same city with similar profiles could share generated batches instead of each getting their own. The per-user `hashProfile` in [hash.ts](../../functions/src/utils/hash.ts) is a stepping stone; a global pool would hash the coarser `city+vibe+interests` tuple.

---

## 5. Shed a Places API SKU tier (cost) — DONE

Dropped from Enterprise + Atmosphere to **Text Search Pro** (\~5,000 free calls/month, \~$0.032/call) by removing `editorialSummary` (the location summary is now written by the Writer LLM) and `rating`/`userRatingCount` (`getBestLocation` picks a middle-ground place from Google's default relevance order). Kept for reference; nothing left to do here.

---

## 6. "Focus / mood" signal for the current phase

**Status:** Idea / blocked on frontend
**Effort:** Small backend, but needs onboarding/UI change

Users' profiles are genuinely broad, but at any given time they're "in a phase" wanting more of a few specific things. An optional `focus`/`mood` field (e.g. "lately I'm into film photography, quiet mornings") that the Scout weights heavily would sharpen batches far better than inferring a focus from a noisy profile.

Deferred because it requires a frontend/onboarding change — the current push is to optimize the backend alone. Revisit alongside a broader onboarding revamp. See the Scout prompt in [prompts.ts](../../functions/src/utils/prompts.ts) for where this would plug in.

---

## Cost reference (as of 2026-06-30)

- Places API (New) Text Search bills **per call**, at the highest SKU tier any requested field touches. Current tier: **Pro (\~$32 / 1,000 calls = \~$0.032/call, \~5,000 free/month)** — see #5 for how it was reduced from Enterprise + Atmosphere.
- One batch of Maps calls ≈ **$0.032 per place**.
- Google Maps Platform has a **recurring monthly free tier** that comfortably covers development/low volume — verify exact caps in Console → Billing.
- **During development, stub Maps** with a fixture to avoid burning quota while iterating on prompts.
