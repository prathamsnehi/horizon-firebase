# Horizon Production Architecture & System Design

This document outlines the production-level architectural decisions and system design for the Horizon Firebase backend, specifically focusing on the AI-driven Quest Generation pipeline.

## 1. Fault Tolerance & Limiting the "Blast Radius"

The pipeline is designed for **Partial Success** — no single component failure sinks the whole batch.

- **Best-Effort Delivery:** _Shipped._ If the Scout resolves fewer concepts than the batch size (`CURATED_BATCH_SIZE`, 3), we don't throw — we pass whatever resolved to the Writer and continue.
- **Graceful Degradation (No-Location Fallback):** _Shipped_ as `generateGenericQuests` — the deficit is filled with location-agnostic quests (at-home / anywhere activities) that skip the Maps API entirely, so a Maps outage or a zero-coverage area still returns a full batch.
- **Circuit Breakers:** _Partial._ The LLM router already drains a model's rate window on a 429/failure so subsequent calls route elsewhere; a true cross-request circuit breaker (trip + serve cached/fallback on sustained failure) is still an open idea.

## 2. Scaling, Costs, and Rate Limiting

LLM APIs and Google Maps APIs are expensive and heavily rate-limited. We cannot afford a 1:1 ratio of user swipes to API invocations at scale.

> **Implementation status:** Per-user caching + background pre-generation, the multi-provider router, and rate limiting are **shipped** (see [planned-changes.md](./planned-changes.md) §0/§0b). The remaining unbuilt item is the **global (cross-user) pool** described in the first bullet.

- **Global Quest Caching (The Cost Killer):** _Partially shipped._ Per-user pre-generation is live (`pregenerateCuratedBatch` via Cloud Tasks stores each user's next batch in `pregen_cache/{uid}`). The **cross-user global pool** — hash `(City + Vibe + Interests)` → serve a shared batch across users for a $0 hit — is still to be built.
- **Multi-Model Router (Fallback Strategy):** _Shipped_ as the `llm/` layer (Vercel AI SDK). Primary is Gemini; on 429/error it distributes + fails over across **Groq, Mistral, Cerebras** (all free-tier). Note: Claude/OpenAI have no free API tier, so they were intentionally excluded. Distribution is global + rate-aware via a Firestore multi-window limiter.
- **Asynchronous Generation (Cloud Tasks):** _Shipped for pre-generation._ We don't return `status: processing`; instead `generateCuratedQuests` serves the pre-generated batch synchronously (instant on a cache hit) and uses **Cloud Tasks** only to build the *next* batch in the background. A miss generates synchronously (a few seconds).

## 3. Advanced Production Considerations (Staff Engineer Level)

When designing this for millions of users, we must answer these questions:

### A. Idempotency (The Double-Tap Problem)

What happens if the iOS app retries a `generateCuratedQuests` request after a dropped connection? We don't want to run the expensive pipeline twice. _Largely mitigated:_ the two-phase rate-limit reservation writes a short-lived pending stamp before generation, so a concurrent call or a retry within the pending TTL (90s) is denied against it — and the durable 24h stamp blocks a same-day repeat. A dedicated `requestId` de-dupe (checked in Firestore over a few minutes) would still be the more general guard if finer-grained retry semantics are ever needed.

### B. Toxicity, Safety, and Physical Danger

We are generating real-world quests. What if the AI hallucinates a quest to "Explore this abandoned warehouse at 2 AM" and the user gets hurt?
**Solution:**

1. Strict LLM Safety Settings (block hate speech, dangerous activities).
2. A lightweight sanitization pass (or rule-based keyword blocklist) to ensure the AI isn't sending people to dangerous areas.
3. A disclaimer in the UI: "Quests are AI-generated. Use your own judgment."

### C. Observability (Monitoring & Alerting)

If quests start failing, how will we know?
**Solution:** We need structured logging (e.g., Google Cloud Logging / Datadog). We need to track:

- `llm_latency_ms`: Are requests getting slower?
- `maps_resolution_rate`: What percentage of AI concepts actually exist in the real world? (If this drops below 50%, our Scout AI prompt is broken).
- Alerts on Discord/Slack if `HTTP 429 (Too Many Requests)` spikes above a threshold.

### D. Data Privacy (PII Leakage)

We send user profiles to third-party LLM providers (Gemini/Groq/Mistral/Cerebras). _Handled:_ the `UserProfile` carries only abstract preferences (city, interests, vibe, budget, growth areas) — never names, emails, phone numbers, or exact home addresses — and input validation enforces the shape before any prompt is built. The observability `logs` collection is PII-free by design (stage/provider/model/latency only).
