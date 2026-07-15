# Cloud Function API Contracts

The app communicates with Firebase Cloud Functions over HTTPS. Each function receives a JSON request and returns a JSON response. The AI model behind each function is a backend concern — the app only cares about the contract.

All endpoints are called via Firebase's `callable` Cloud Functions SDK (not raw HTTP), which handles auth tokens and serialization automatically.

## Endpoints

---

### 1. `generateCuratedQuests`

The user's **curated batch**. Cache-first: serves a pre-generated batch from Firestore instantly when available, else generates on the spot. The batch size is **server-controlled** (3); the client does not send a count. **Requires a signed-in Firebase Auth user** (App Check also enforced). **Rate-limited server-side to 1 per 24h per user** (keyed on `request.auth.uid`) — see [Rate Limiting](#rate-limiting).

**Used by:** Initial batch after onboarding, and the daily refresh.

**Request:**

```json
{
  "profile": {
    "interests": ["string"],
    "growthAreas": ["string"],
    "vibe": ["string"],
    "experimentationLevel": 1,
    "budget": ["string"],
    "transportation": ["walking" | "publicTransport" | "car" | "bike" | "rideshare"],
    "locationPreferences": ["string"],
    "additionalContext": "string or null",
    "city": "string",
    "cityLatitude": 37.7749,
    "cityLongitude": -122.4194
  },
  "excludeTitles": ["string"],
  "deviceId": "string"
}
```

`excludeTitles` (optional) contains titles of recently completed quests to avoid duplicates. `deviceId` identifies the device (and keys the per-user cache).

`cityLatitude`/`cityLongitude` are optional. When both are present, the backend computes straight-line distance and per-mode travel-time estimates for each resolved location; when absent, distance is omitted and transportation options fall back to `0`-minute placeholders.

_Validation (before any LLM spend or rate-limit reservation): `deviceId` must be a string; the profile's required arrays (`interests`, `growthAreas`, `vibe`, `budget`, `transportation`, `locationPreferences`) must be present and non-empty and `city` a non-empty string, all within length caps; `excludeTitles` (if present) is a bounded string array. A missing/malformed field returns `invalid-argument`._

**Caching & pre-generation:** On serve, the backend persists today's batch and enqueues a **Cloud Task** to pre-generate the next batch, so subsequent days are instant. A stored batch is invalidated when the profile changes (its hash no longer matches) or after a TTL (7 days).

**App Behavior:** The app calls this and waits. A cache hit is fast; a miss (first time, or profile changed) takes a few seconds — show a "curating" state past ~2s. (The response no longer carries per-stage timings; those are logged server-side.)

**Response:**

```json
{
    "quests": [
        {
            "title": "string",
            "questDescription": "string",
            "difficulty": "easy" | "moderate" | "hard" | "extreme",
            "estimatedActivityMinutes": 60,
            "categories": ["string"],
            "locationInformation": {
                "name": "string",
                "address": "string",
                "locationDescription": "string",
                "latitude": 37.7694,
                "longitude": -122.4862,
                "photoReference": "string",
                "photoImageBase64": "string (optional)",
                "photoContentType": "string (optional)",
                "googleMapsURL": "string",
                "distanceMiles": 2.4,
                "transportationOptions": [
                    {
                        "mode": "walking" | "publicTransport" | "car" | "bike" | "rideshare",
                        "estimatedTravelMinutes": 15,
                        "isRecommended": true
                    }
                ]
            }
        }
    ]
}
```

**Field notes:**

- `estimatedActivityMinutes` is an integer count of minutes for the activity itself and **excludes** travel time. (Maps directly to `Quest.estimatedActivityMinutes`.)
- `locationInformation` is omitted for generic (no-location) quests — these are produced as a fallback when Maps cannot resolve enough real locations. The client should treat its absence as "at-home / location-agnostic."
- `distanceMiles` and `transportationOptions` are only meaningful when the request included `cityLatitude`/`cityLongitude`. Exactly one option has `isRecommended: true`, chosen by the Writer model. Without city coords, `distanceMiles` is omitted and `transportationOptions` come back as `0`-minute placeholders.
- **Hero image:** `photoImageBase64` is the base64-encoded image bytes (with `photoContentType`, e.g. `image/jpeg`), fetched server-side and embedded in the response — **the Maps API key is never sent to the client.** The client should decode it once, store it on the quest, and render from the stored bytes (no image URL to load). It is **absent** when the place has no photo or the fetch failed → show a placeholder. `photoReference` is the durable Places photo handle used server-side; clients can ignore it.

_Note: If the Google Maps API fails to return a specific location field (e.g., the place has no photo), that field safely defaults to an empty string `""` (or `0` for coordinates); `photoImageBase64`/`photoContentType` are simply omitted._

---

### 2. `generateUserDescribedQuest`

Generate **one** quest tailored to a freeform user prompt. The backend first plans whether the request needs a real place (→ Maps + location writer) or is location-agnostic (→ generic writer), falling back to generic if Maps can't resolve. **Requires a signed-in Firebase Auth user** (App Check also enforced). **Rate-limited server-side to 1 per 24h per user** (independent of the curated window) — see [Rate Limiting](#rate-limiting).

**Used by:** The "Describe your own" daily action on the Explore tab.

**Request:**

```json
{
  "prompt": "string (the user's freeform description)",
  "profile": { "...": "a full UserProfile (see generateCuratedQuests)" },
  "deviceId": "string"
}
```

**Response:**

```json
{
  "quest": {
    "title": "string",
    "questDescription": "string",
    "difficulty": "easy" | "moderate" | "hard" | "extreme",
    "estimatedActivityMinutes": 60,
    "categories": ["string"],
    "locationInformation": { "...": "present only when the quest is tied to a real place" }
  }
}
```

Note the response is a **single `quest` object** (not an array). The client sets `origin = .described` and stores the user's `prompt` in `userPrompt`.

**Rate limiting:** 1 per 24h per user (see [Rate Limiting](#rate-limiting)). The prompt is trimmed and capped (max 300 chars) and passes a lightweight moderation check — an empty/oversized/blocked prompt returns `invalid-argument` **before** any spend or slot reservation.

---

### 3. `generateGetStartedGuide` — ⚠️ NOT YET IMPLEMENTED

Generate a step-by-step guide for approaching a specific quest. Called on demand when the user taps "Get Started." The request/response shapes are defined in the backend's `types.ts` (`GetStartedRequest` / `GetStartedResponse`), but the handler is **not yet wired up** — do not depend on this endpoint until the backend confirms it is live.

**Request:**

```json
{
  "quest": {
    "...": "a full QuestItem (see the generateCuratedQuests response)"
  },
  "profile": {
    "...": "a full UserProfile (see the generateCuratedQuests request)"
  }
}
```

**Response:**

```json
{
  "steps": ["Step 1 description", "Step 2 description", "Step 3 description"]
}
```

---

## Error Handling

Errors are surfaced as Firebase `HttpsError`, so the client receives a standard `{ code, message, details? }` via the callable SDK. Codes emitted:

- `unauthenticated` — no signed-in Firebase Auth user. Message: "Sign in to generate quests."
- `invalid-argument` — the payload failed validation (missing/malformed fields, oversized/empty prompt), or a described prompt was blocked by moderation. The message text is user-surfaceable.
- `resource-exhausted` — the lane is currently gated. Carries a **`details`** object: `{ retryAt: <ISO8601>, scope: "curated" | "described" }`. The client just reads `details.retryAt` and counts down to it — the value is either the full 24h gate (after a successful delivery) **or** a short ≤2.5-min cooldown (a generation is in flight, or a previous one failed/was killed). Same shape either way.
- `internal` — generation failed downstream (e.g., Scout produced no concepts, or the Writer produced nothing). Show a retry button. A failed generation does **not** consume the 24h slot — its short pending cooldown clears (or self-expires) and a retry then succeeds.

_Both callables enforce **App Check** (`enforceAppCheck: true`) **and** require a signed-in Firebase Auth user. App Check failures are rejected by Firebase before the handler runs; the missing-auth check is the first thing the handler does._

The client should also handle transport-level failures (no network) as its own offline state, independent of these server codes.

## Rate Limiting

Enforced **server-side**, per **`request.auth.uid`** (the verified Firebase Auth token — never a payload field, which is spoofable), on a **24h window** using **server time**. One *delivered* generation per lane per 24h:

- `generateCuratedQuests` — **1 per 24h**.
- `generateUserDescribedQuest` — **1 per 24h**, independent lane.

**Crash/timeout-safe two-phase reservation** (state in `rateLimits/{uid}`):

- **Durable stamp** `lastCuratedAt`/`lastDescribedAt` — the 24h window is measured from here, and it's set **only on successful delivery** (at commit, right before the response is returned).
- **Pending stamp** `pendingCuratedAt`/`pendingDescribedAt` — written inside a transaction *before* generation. A concurrent call, or a retry within **~2.5 min (150s)**, is denied against it (this is what blocks duplicates).
- On **success**: commit — set `lastAt = now`, clear the pending stamp → the 24h window starts at delivery.
- On **failure**: best-effort clear the pending stamp (frees immediately). **If the process is killed** (e.g. the platform timeout), the pending stamp simply self-expires within 150s — no rollback code has to run.

Why: the old reserve-then-rollback burned the full day if a >60s generation was killed before rollback could run. Now a killed run costs the user **at most ~2.5 min**, and the 24h gate only exists once quests actually landed. Function timeout is **120s** (150s pending TTL stays ≥ the timeout so a still-running generation can't be double-entered).

_`deviceId` remains the **pre-generation cache key only** — it is not an identity and is never used for rate limiting._

_This is unrelated to the multi-provider LLM router, which applies its own free-tier-aware distribution across providers (see "Multi-provider LLM routing") to avoid provider 429s — infrastructure, not a user-facing limit._

## Backend Orchestration — LLM Router + Google Maps

The Cloud Functions use a multi-step orchestration pattern to generate location-aware quests:

### Flow (Two-Pass Architecture)

The batch size is server-controlled (3); the client does not send a `count`. Each LLM pass goes through the multi-provider routing layer (see below), not a single hard-coded model.

```javascript
Mobile App                    Cloud Function                     External APIs
    │                              │                                  │
    ├── { profile } ────────────→ │                                  │
    │                              ├── Pass 1: profile ──────────────→ LLM router
    │                              │                                  (Gemini/Groq/…)
    │                              │ ←── 3 location concepts          │
    │                              │                                  │
    │                              ├── Promise.all() fetch 3 ────────→ Google Maps
    │                              │   locations in parallel          Places API (New)
    │                              │                                  │
    │                              │ ←── 3 location objects           │
    │                              │     (name, address, photo ref)   │
    │                              │                                  │
    │                              ├── Pass 2: profile + 3 locations→ LLM router
    │                              │                                  (Gemini/Groq/…)
    │                              │ ←── 3 tailored quests        │
    │                              │                                  │
    │                              ├── fetch photo bytes server-side  │
    │                              │   (key never leaves backend)→b64 │
    │                              │                                  │
    │ ←── { quests[] } ────── │                                  │
    │  (locationInformation         │                                  │
    │   .photoImageBase64 = bytes)  │                                  │
```

### What the Cloud Function does:

1. **Pass 1 (Scout):** Sends the user's profile to the **LLM router** (fast model class; Gemini `gemini-3.1-flash-lite` with minimal thinking is primary) using structured JSON output to generate the batch's high-level location concepts/queries, each tagged with an `intendedDifficulty` that maps to geographic scale.
2. **Location Fetch:** Cloud Function calls **Google Maps Places API (New)** `places:searchText` in parallel using `Promise.all()` to fetch details for those concepts (name, address, coordinates, photo references, maps URI, business status). Only **Pro-tier** fields are requested — no `editorialSummary`/`rating`/`userRatingCount` — keeping every call on the cheaper Text Search **Pro** SKU. Selection is **middle-ground**: `searchText` already returns results in relevance/prominence order, so the function drops closed places and picks at random among the **top few** of that order — popular/mainstream but varied across users (not always the identical #1, and never obscure bottom-of-list spots). Queries that return nothing are dropped (partial success — the batch continues with whatever resolved).
3. **Distance & transport math (local):** For each resolved location, if the request supplied `cityLatitude`/`cityLongitude`, the function computes a Haversine `distanceMiles` and heuristic per-mode `transportationOptions`. No external call.
4. **Pass 2 (Writer):** Sends the profile AND the enriched Maps locations back to the **LLM router** (quality model class; Gemini `gemini-3.5-flash` primary) with structured JSON to write highly-tailored quests. The model selects an `assignedLocationId` and a `recommendedTransportationMode`, and writes a short (1–2 sentence) `locationDescription` for the place; the backend re-attaches the exact, untouched Maps data by ID afterward (and injects that `locationDescription`) so the LLM cannot corrupt real addresses/coordinates. (The location summary comes from the LLM — not Maps, whose editorial-summary field is a premium tier.)
5. **Generic fallback (deficit filling):** If fewer locations resolved than the batch size, the shortfall is filled with location-agnostic quests via a separate router call. These come back **without** `locationInformation`.
6. The Places API returns a **photo reference** (`name` field) for each photo — not a URL or raw image data. Example: `"places/ChIJN1t.../photos/AUacShh3Z..."`. This durable reference (`photoReference`) is what gets stored in the cache.
7. **At serve time** — after persisting the reference-only batch — the Cloud Function fetches the image bytes itself (`GET https://places.googleapis.com/v1/{name}/media?key=API_KEY&maxHeightPx=600`, key used **server-side only**) and embeds them as base64 (`photoImageBase64` + `photoContentType`) in the response. The key is never in the response, and the image is **never persisted server-side** (Firestore 1 MB limit + Places-content policy). Best-effort: a failed fetch just omits the image (client shows a placeholder). Consequence: a cache-hit serve gains ~0.5–1 s for the parallel photo fetch.

### Multi-provider LLM routing

Every LLM pass above goes through a provider-agnostic routing layer rather than a single hard-coded model:

- **Providers:** Gemini (primary), Groq, Mistral, Cerebras — all free-tier, integrated via the Vercel AI SDK with Zod-validated structured output.
- **Global rate-aware distribution:** a Firestore-backed multi-window (per-minute + per-day) limiter, keyed per model, spreads load across providers to stretch each free quota; a model is skipped when any of its windows is exhausted.
- **Failover:** on a rate-limit / transient / schema-validation error, the router drops to the next provider in the class and drains the failed model's window so subsequent calls route elsewhere. It fails open (static priority order) if the limiter store is unavailable, so generation never blocks on it.
- The chosen provider/model is invisible to the app — only the quest contract above is returned. (Each pipeline stage's latency + the AI provider/model is recorded server-side in the **PII-free `logs`** collection for the load/latency dashboard — no profile, prompt, response, or device id.)

### Security

- **Google Cloud Secret Manager** stores all LLM provider API keys (Gemini, Groq, Mistral, Cerebras) — never exposed to the client
- The **Maps API key never leaves the backend** — every Places call (text search **and** photo fetch) runs server-side with the key from Secret Manager; responses carry image **bytes**, never a key or a URL. (Still API-restrict the key to Places API as defense-in-depth.)
- **Firebase App Check** ensures only the genuine compiled app can trigger Cloud Functions, preventing API abuse

### What the app receives

The app doesn't know about the LLM router or the orchestration details. It just receives a quest with an optional `locationInformation` object containing `address`, `latitude`, `longitude`, an embedded `photoImageBase64` (+ `photoContentType`), and (when city coordinates were supplied) `distanceMiles` and `transportationOptions`.

### Image handling on the app side

- The hero image arrives **inside the quest response** as `photoImageBase64` — no image URL, no key, no Kingfisher/network fetch for it.
- The app **decodes it once** (e.g. `Data(base64Encoded:)`), **stores the `Data` on the quest object** (SwiftData), and renders from the stored bytes thereafter — offline, instant on repeat views.
- The bytes live and die with the quest (discarded on completion); no separate cache to manage.
- If `photoImageBase64` is absent (place had no photo, or the server-side fetch failed), show a bundled placeholder.
- Non-location quests use pre-loaded placeholder images bundled with the app — no network call needed

## Note on Share Captions

Share captions are **not AI-generated**. The app uses pre-configured template text with placeholders (e.g., quest title, categories) that is general enough for social media posting. This keeps sharing instant, offline-capable, and free of API calls.
