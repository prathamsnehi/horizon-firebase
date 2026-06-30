# Horizon Production Architecture & System Design

This document outlines the production-level architectural decisions and system design for the Horizon Firebase backend, specifically focusing on the AI-driven Sidequest Generation pipeline.

## 1. Fault Tolerance & Limiting the "Blast Radius"

Currently, the generation pipeline is monolithic: if one component fails, the entire request of 10 sidequests fails. In a production system, we must design for **Partial Success**.

- **Best-Effort Delivery:** If the Scout AI (Pass 1) generates 10 concepts, but the Google Maps API only successfully resolves 7 of them, we should _not_ throw an error. We simply pass those 7 to the Writer AI (Pass 2) and return a batch of 7 sidequests to the user.
- **Graceful Degradation (No-Location Fallback):** If the Google Maps API goes down entirely, or the user is in an area with zero mapping coverage, the app shouldn't break. We should have a fallback `generateNoLocationSidequests` prompt that generates at-home activities (e.g., journaling, meditation, home workouts, deep-work sessions) that skip the Maps API entirely.
- **Circuit Breakers:** If an API (like Maps or Gemini) starts failing consistently, we should trip a circuit breaker to stop hammering the API and immediately serve cached/fallback content.

## 2. Scaling, Costs, and Rate Limiting

LLM APIs and Google Maps APIs are expensive and heavily rate-limited. We cannot afford a 1:1 ratio of user swipes to API invocations at scale.

- **Global Quest Caching (The Cost Killer):** Sidequests don't always need to be 100% unique per user. If two users in "San Francisco" both have a "chill" vibe and like "coffee", they can receive the exact same generated sidequest. We can hash the `(City + Vibe + Interests)` and store the resulting sidequests in a global Firestore pool. When a user requests sidequests, we query the global pool first. If a match exists, we serve it (Cost: $0.00). If not, we generate it, serve it, and _add it to the pool_.
- **Multi-Model Router (Fallback Strategy):** We should implement an `LLMProvider` interface. The primary driver can be `Gemini-3.5-Flash` (cheap, fast). If it hits a rate limit (HTTP 429) or fails, the code automatically catches the error and retries the exact same prompt against `Claude 3 Haiku` (AWS/Anthropic) or `GPT-4o-mini` (OpenAI). This ensures uptime even during provider outages.
- **Asynchronous Generation (Cloud Tasks / PubSub):** A Two-Pass LLM system + Maps API will take 5-15 seconds. On a 3G mobile connection, an HTTPS Callable function will often timeout. Instead of making the user stare at a spinner, the app should call `requestBatch`. The backend drops a message into **Google Cloud Tasks** and immediately returns `status: processing`. The backend generates the quests in the background and saves them to Firestore. The iOS app just listens to the Firestore collection for new documents.

## 3. Advanced Production Considerations (Staff Engineer Level)

When designing this for millions of users, we must answer these questions:

### A. Idempotency (The Double-Tap Problem)

What happens if the iOS app sends a `generateSidequests` request, but the user goes into a tunnel and loses connection? The app will automatically retry the request. If we aren't careful, the backend will receive _two_ requests and run the expensive LLM pipeline _twice_.
**Solution:** The iOS app must generate a unique `requestId` (UUID) and send it with the payload. The backend checks Redis or Firestore: "Have I seen this requestId in the last 5 minutes?" If yes, ignore the duplicate.

### B. Toxicity, Safety, and Physical Danger

We are generating real-world quests. What if the AI hallucinates a sidequest to "Explore this abandoned warehouse at 2 AM" and the user gets hurt?
**Solution:**

1. Strict LLM Safety Settings (block hate speech, dangerous activities).
2. A lightweight sanitization pass (or rule-based keyword blocklist) to ensure the AI isn't sending people to dangerous areas.
3. A disclaimer in the UI: "Sidequests are AI-generated. Use your own judgment."

### C. Observability (Monitoring & Alerting)

If sidequests start failing, how will we know?
**Solution:** We need structured logging (e.g., Google Cloud Logging / Datadog). We need to track:

- `llm_latency_ms`: Are requests getting slower?
- `maps_resolution_rate`: What percentage of AI concepts actually exist in the real world? (If this drops below 50%, our Scout AI prompt is broken).
- Alerts on Discord/Slack if `HTTP 429 (Too Many Requests)` spikes above a threshold.

### D. Data Privacy (PII Leakage)

We are sending user profiles to Google/OpenAI.
**Solution:** We must ensure the `UserProfile` object sent to the prompt _never_ contains names, emails, phone numbers, or exact home addresses. We only send abstract concepts (city name, interests, budget).
