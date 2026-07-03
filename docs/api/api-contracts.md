# Cloud Function API Contracts

The app communicates with Firebase Cloud Functions over HTTPS. Each function receives a JSON request and returns a JSON response. The AI model behind each function is a backend concern — the app only cares about the contract.

All endpoints are called via Firebase's `callable` Cloud Functions SDK (not raw HTTP), which handles auth tokens and serialization automatically.

## Endpoints

---

### 1. `generateCuratedSidequests`

The user's **curated batch**. Cache-first: serves a pre-generated batch from Firestore instantly when available, else generates on the spot. The batch size is **server-controlled** (3); the client does not send a count. _No per-user rate limit is enforced on the backend right now (testing phase) — repeat calls serve a valid pre-generated batch or generate a new one. Usage limiting, if needed, will be enforced client-side._

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

`excludeTitles` (optional) contains titles of recently completed sidequests to avoid duplicates. `deviceId` identifies the device (and keys the per-user cache).

`cityLatitude`/`cityLongitude` are optional. When both are present, the backend computes straight-line distance and per-mode travel-time estimates for each resolved location; when absent, distance is omitted and transportation options fall back to `0`-minute placeholders.

_Validation: the backend requires profile (object) and deviceId (string). A missing or malformed field returns an invalid-argument error._

**Caching & pre-generation:** On serve, the backend persists today's batch and enqueues a **Cloud Task** to pre-generate the next batch, so subsequent days are instant. A stored batch is invalidated when the profile changes (its hash no longer matches) or after a TTL (7 days).

**App Behavior:** The app calls this and waits. A cache hit is instant; a miss (first time, or profile changed) takes a few seconds — show a "curating" state past \~2s. The response's `timings.cached` is `true` when served from cache.

**Response:**

```json
{
    "sidequests": [
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
                "photoURL": "string",
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
    ],
    "timings": {
        "scoutMs": 0,
        "mapsMs": 0,
        "writerMs": 0,
        "genericFallbackMs": 0,
        "totalServerMs": 0,
        "coldStart": false,
        "cached": false
    }
}
```

**Field notes:**

- `estimatedActivityMinutes` is an integer count of minutes for the activity itself and **excludes** travel time.
- `locationInformation` is omitted for generic (no-location) sidequests — these are produced as a fallback when Maps cannot resolve enough real locations. The client should treat its absence as "at-home / location-agnostic."
- `distanceMiles` and `transportationOptions` are only present when the request included `cityLatitude`/`cityLongitude`. Exactly one option has `isRecommended: true`, chosen by the Writer model.
- `timings` is optional, additive server-side latency telemetry (per-stage milliseconds, a cold-start flag, and `cached: true` when the batch was served from cache). Clients that don't need it can safely ignore it.

_Note: If the Google Maps API fails to return a specific location field (e.g., the place has no photos or no editorial description), that field safely defaults to an empty string "" (or 0 for coordinates)._

### 2. `generateUserDescribedSidequest`

Generate **one** sidequest tailored to a freeform user prompt. The backend first plans whether the request needs a real place (→ Maps + location writer) or is location-agnostic (→ generic writer), falling back to generic if Maps can't resolve. _No per-user rate limit is enforced on the backend right now (testing phase)._

**Request:**

```json
{
  "prompt": "string (the user's freeform description)",
  "profile": { "...": "a full UserProfile (see generateCuratedSidequests)" },
  "deviceId": "string"
}
```

**Response:**

```json
{
  "sidequest": {
    "title": "string",
    "questDescription": "string",
    "difficulty": "easy" | "moderate" | "hard" | "extreme",
    "estimatedActivityMinutes": 60,
    "categories": ["string"],
    "locationInformation": { "...": "present only when the quest is tied to a real place" }
  }
}
```

**Rate limiting:** None on the backend for now (testing phase); any usage limiting will be enforced client-side. Freeform prompts still pass a lightweight moderation check; blocked prompts return `invalid-argument`.

### 3. `generateGetStartedGuide` -> NOT YET IMPLEMENTED

Generate a step-by-step guide for approaching a specific sidequest. Called on demand when the user taps "Get Started."

**Request:** _(shapes defined in types.ts as GetStartedRequest; the handler is not yet wired up)_

```json
{
  "sidequest": {
    "...": "a full SidequestItem (see the generateCuratedSidequests response)"
  },
  "profile": {
    "...": "a full UserProfile (see the generateCuratedSidequests request)"
  }
}
```

**Response:** _(GetStartedResponse)_

```json
{
  "steps": ["Step 1 description", "Step 2 description", "Step 3 description"]
}
```

---

## Error Handling

Errors are surfaced as Firebase `HttpsError`, so the client receives a standard `{ code, message }` via the callable SDK. Codes emitted:

- `invalid-argument` — the payload failed validation (missing/malformed fields), or a described prompt was blocked by moderation.
- `internal` — generation failed downstream (e.g., the Scout pass produced no concepts, or the Writer produced nothing). Show a retry button.

_App Check is enforced (enforceAppCheck: true). Requests without a valid App Check token are rejected by Firebase before the handler runs._

## Rate Limiting

**No backend rate limiting is enforced during the current testing phase.** Both `generateCuratedSidequests` and `generateUserDescribedSidequest` can be called freely; each call generates (or, for curated, may serve a valid pre-generated batch from cache). If per-user usage limiting is needed later, it will be enforced **client-side**, not here.

_Note: this is unrelated to the multi-provider LLM router, which still applies its own free-tier-aware distribution across providers (see "Multi-provider LLM routing") to avoid provider 429s. That is infrastructure, not a user-facing rate limit._

## Backend Orchestration — Gemini + Google Maps

The Cloud Functions use a multi-step orchestration pattern to generate location-aware sidequests:

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
    │                              │ ←── 3 rich location objects      │
    │                              │     (address, summary, etc)      │
    │                              │                                  │
    │                              ├── Pass 2: profile + 3 locations→ LLM router
    │                              │                                  (Gemini/Groq/…)
    │                              │ ←── 3 tailored sidequests        │
    │                              │                                  │
    │                              ├── construct media URL from       │
    │                              │   resource identifier + API key  │
    │                              │                                  │
    │ ←── { sidequests[] } ────── │                                  │
    │  (locationInformation.photoURL│                                  │
    │      = constructed media URL) │                                  │
```

### What the Cloud Function does:

1. **Pass 1 (Scout):** Sends the user's profile to the **LLM router** (fast model class; Gemini `gemini-3.1-flash-lite` with minimal thinking is primary) using structured JSON output to generate the batch's high-level location concepts/queries, each tagged with an `intendedDifficulty` that maps to geographic scale.
2. **Location Fetch:** Cloud Function calls **Google Maps Places API (New)** `places:searchText` in parallel using `Promise.all()` to fetch rich details for those concepts (address, coordinates, editorial summary, photo references, maps URI). From each query's result pool the function picks a **quality-ranked** place — scored by rating × review volume, then chosen at random among the top few (closed places excluded) — so results are strong but not identical across users. Queries that return nothing are dropped (partial success — the batch continues with whatever resolved).
3. **Distance & transport math (local):** For each resolved location, if the request supplied `cityLatitude`/`cityLongitude`, the function computes a Haversine `distanceMiles` and heuristic per-mode `transportationOptions`. No external call.
4. **Pass 2 (Writer):** Sends the profile AND the enriched Maps locations back to the **LLM router** (quality model class; Gemini `gemini-3.5-flash` primary) with structured JSON to write highly-tailored sidequests. The model only selects an `assignedLocationId` and a `recommendedTransportationMode`; the backend re-attaches the exact, untouched Maps data by ID afterward so the LLM cannot corrupt real addresses/coordinates/URLs.
5. **Generic fallback (deficit filling):** If fewer locations resolved than the batch size, the shortfall is filled with location-agnostic quests via a separate router call. These come back **without** `locationInformation`.
6. The Places API returns a **photo resource identifier** (`name` field) for each photo — not a URL or raw image data. Example: `"places/ChIJN1t.../photos/AUacShh3Z..."`
7. Cloud Function constructs a **media URL** from the resource identifier: `https://places.googleapis.com/v1/{photo_name}/media?key=API_KEY&maxHeightPx=600` and returns it as `photoURL` — the app fetches and caches the image directly from Google.

### Multi-provider LLM routing

Every LLM pass above goes through a provider-agnostic routing layer rather than a single hard-coded model:

- **Providers:** Gemini (primary), Groq, Mistral, Cerebras — all free-tier, integrated via the Vercel AI SDK with Zod-validated structured output.
- **Global rate-aware distribution:** a Firestore-backed multi-window (per-minute + per-day) limiter, keyed per model, spreads load across providers to stretch each free quota; a model is skipped when any of its windows is exhausted.
- **Failover:** on a rate-limit / transient / schema-validation error, the router drops to the next provider in the class and drains the failed model's window so subsequent calls route elsewhere. It fails open (static priority order) if the limiter store is unavailable, so generation never blocks on it.
- The chosen provider/model is invisible to the app — only the sidequest contract above is returned. (Each call is recorded server-side in `ai_call_logs` for observability.)

### Security

- **Google Cloud Secret Manager** stores all LLM provider API keys (Gemini, Groq, Mistral, Cerebras) — never exposed to the client
- The **Maps API key** is embedded in the `photoURL` returned to the app. This key should be restricted to the Places API only and locked to your app's bundle ID via Google Cloud Console. The URL travels over HTTPS and lives only in the app's local cache.
- **Firebase App Check** ensures only the genuine compiled app can trigger Cloud Functions, preventing API abuse

### What the app receives

The app doesn't know about Gemini or the orchestration details. It just receives a sidequest with an optional `locationInformation` object containing `address`, `latitude`, `longitude`, `photoURL`, and (when city coordinates were supplied) `distanceMiles` and `transportationOptions`. The `photoURL` is a Google Maps media URL that the app loads directly.

### Image loading on the app side

- The app loads hero images from the `photoURL` using **Kingfisher** for async downloading and disk/memory caching
- Images are already size-optimized via the `maxHeightPx` parameter baked into the URL by the Cloud Function
- Kingfisher handles cache expiration, memory pressure, and retry logic automatically
- Once cached locally, images load instantly on repeat views without additional network requests
- Non-location quests use pre-loaded placeholder images bundled with the app — no network call needed

## Note on Share Captions

Share captions are **not AI-generated**. The app uses pre-configured template text with placeholders (e.g., sidequest title, categories) that is general enough for social media posting. This keeps sharing instant, offline-capable, and free of API calls.
