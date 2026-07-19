# Horizon Production Architecture & System Design

This document outlines the production-level architectural decisions and system design for the Horizon Firebase backend, specifically focusing on the AI-driven Quest Generation pipeline.

## 1. Fault Tolerance & Limiting the "Blast Radius"

Currently, the generation pipeline is monolithic: if one component fails, the entire request of 10 quests fails. In a production system, we must design for **Partial Success**.

- **Best-Effort Delivery:** If the Scout AI (Pass 1) generates 10 concepts, but the Google Maps API only successfully resolves 7 of them, we should _not_ throw an error. We simply pass those 7 to the Writer AI (Pass 2) and return a batch of 7 quests to the user.
- **Graceful Degradation (No-Location Fallback):** If the Google Maps API goes down entirely, or the user is in an area with zero mapping coverage, the app shouldn't break. We should have a fallback `generateNoLocationQuests` prompt that generates at-home activities (e.g., journaling, meditation, home workouts, deep-work sessions) that skip the Maps API entirely.
- **Circuit Breakers:** If an API (like Maps or Gemini) starts failing consistently, we should trip a circuit breaker to stop hammering the API and immediately serve cached/fallback content.

## 2. Scaling, Costs, and Rate Limiting

LLM APIs and Google Maps APIs are expensive and heavily rate-limited. We cannot afford a 1:1 ratio of user swipes to API invocations at scale.

> **Implementation status:** Per-user caching + background pre-generation, the multi-provider router, and rate limiting are **shipped** (see [planned-changes.md](./planned-changes.md) §0/§0b). The remaining unbuilt item is the **global (cross-user) pool** described in the first bullet.

- **Global Quest Caching (The Cost Killer):** _Partially shipped._ Per-user pre-generation is live (`pregenerateCuratedBatch` via Cloud Tasks stores each user's next batch in `pregen_cache/{uid}`). The **cross-user global pool** — hash `(City + Vibe + Interests)` → serve a shared batch across users for a $0 hit — is still to be built.
- **Multi-Model Router (Fallback Strategy):** _Shipped_ as the `llm/` layer (Vercel AI SDK). Primary is Gemini; on 429/error it distributes + fails over across **Groq, Mistral, Cerebras** (all free-tier). Note: Claude/OpenAI have no free API tier, so they were intentionally excluded. Distribution is global + rate-aware via a Firestore multi-window limiter.
- **Asynchronous Generation (Cloud Tasks):** _Shipped for pre-generation._ We don't return `status: processing`; instead `generateCuratedQuests` serves the pre-generated batch synchronously (instant on a cache hit) and uses **Cloud Tasks** only to build the *next* batch in the background. A miss generates synchronously (a few seconds).

## 3. Advanced Production Considerations (Staff Engineer Level)

When designing this for millions of users, we must answer these questions:

### A. Idempotency (The Double-Tap Problem)

What happens if the iOS app sends a `generateCuratedQuests` request, but the user goes into a tunnel and loses connection? The app will automatically retry the request. If we aren't careful, the backend could run the expensive LLM pipeline _twice_. (Currently unmitigated: the per-day idempotent re-serve that used to absorb same-day retries was removed along with the daily caps during the testing phase, so a retry regenerates. A dedicated `requestId` guard is the robust general solution to add before launch.)
**Solution:** The iOS app must generate a unique `requestId` (UUID) and send it with the payload. The backend checks Redis or Firestore: "Have I seen this requestId in the last 5 minutes?" If yes, ignore the duplicate.

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

We are sending user profiles to Google/OpenAI.
**Solution:** We must ensure the `UserProfile` object sent to the prompt _never_ contains names, emails, phone numbers, or exact home addresses. We only send abstract concepts (city name, interests, budget).
