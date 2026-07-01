# Cloud Function API Contracts

The app communicates with Firebase Cloud Functions over HTTPS. Each function receives a JSON request and returns a JSON response. The AI model behind each function is a backend concern — the app only cares about the contract.

All endpoints are called via Firebase's `callable` Cloud Functions SDK (not raw HTTP), which handles auth tokens and serialization automatically.

## Endpoints

---

### 1. `generateSidequests`

Generate a batch of sidequests based on the user's profile. The AI uses the profile to determine appropriate variety, difficulty, and mix.

**Used by:** Initial batch after onboarding (count=10), new batch after quest completion (count=10).

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
  "count": 10,
  "excludeTitles": ["string"],
  "deviceId": "string"
}
```

`count` is the number of sidequests to generate (typically 10). `excludeTitles` contains titles of recently completed sidequests to avoid duplicates. `deviceId` identifies the requesting device.

`cityLatitude`/`cityLongitude` are optional. When both are present, the backend computes straight-line distance and per-mode travel-time estimates for each resolved location; when absent, distance is omitted and transportation options fall back to `0`-minute placeholders.

_Validation: the backend requires `profile` (object), `count` (number), and `deviceId` (string). A missing or malformed field returns an `invalid-argument` error._

**App Behavior:** The app calls this endpoint and waits for a response. If a pre-generated batch is available on the backend, the response will be instant. If a fresh batch needs to be generated (e.g. first time, or profile changed), it may take a few seconds. The app should show a "curating" state (e.g., "New sidequests are being curated for you...") if the request takes longer than 2 seconds.

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
                "description": "string",
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
        "coldStart": false
    }
}
```

**Field notes:**

- `estimatedActivityMinutes` is an integer count of minutes for the activity itself and **excludes** travel time.
- `locationInformation` is omitted for generic (no-location) sidequests — these are produced as a fallback when Maps cannot resolve enough real locations. The client should treat its absence as "at-home / location-agnostic."
- `distanceMiles` and `transportationOptions` are only present when the request included `cityLatitude`/`cityLongitude`. Exactly one option has `isRecommended: true`, chosen by the Writer model.
- `timings` is optional, additive server-side latency telemetry (per-stage milliseconds plus a cold-start flag). Clients that don't need it can safely ignore it.

_Note: If the Google Maps API fails to return a specific location field (e.g., the place has no photos or no editorial description), that field safely defaults to an empty string `""` (or `0` for coordinates)._

### 2. `generateGetStartedGuide` -> NOT YET IMPLEMENTED

Generate a step-by-step guide for approaching a specific sidequest. Called on demand when the user taps "Get Started."

**Request:** _(shapes defined in `types.ts` as `GetStartedRequest`; the handler is not yet wired up)_

```json
{
  "sidequest": { "...": "a full SidequestItem (see the generateSidequests response)" },
  "profile": { "...": "a full UserProfile (see the generateSidequests request)" }
}
```

**Response:** _(`GetStartedResponse`)_

```json
{
  "steps": ["Step 1 description", "Step 2 description", "Step 3 description"]
}
```

---

## Error Handling

Errors are surfaced as Firebase `HttpsError`, so the client receives a standard `{ code, message }` via the callable SDK. Codes currently emitted by `generateSidequests`:

- `invalid-argument` — the payload failed validation (missing/malformed `profile`, `count`, or `deviceId`).
- `internal` — generation failed downstream (e.g., the Scout pass produced no concepts, or the Writer produced no sidequests). Show a retry button.

_App Check is enforced (`enforceAppCheck: true`). Requests without a valid App Check token are rejected by Firebase before the handler runs._

## Rate Limiting

Not yet implemented. Rate limiting per `deviceId` is planned (see `production-architecture.md`), with target limits of roughly `generateSidequests` — 5 calls/hour and `generateGetStartedGuide` — 10 calls/hour. Until it lands, no `rate_limited` code is returned. Clients should still be prepared to handle a future rate-limit response gracefully with a cooldown UI.

## Backend Orchestration — Gemini + Google Maps

The Cloud Functions use a multi-step orchestration pattern to generate location-aware sidequests:

### Flow (Two-Pass Architecture)

```javascript
Mobile App                    Cloud Function                     External APIs
    │                              │                                  │
    ├── { profile, count } ──────→ │                                  │
    │                              ├── Pass 1: profile ──────────────→ Gemini API
    │                              │                                  │
    │                              │ ←── 10 location concepts         │
    │                              │                                  │
    │                              ├── Promise.all() fetch 10 ───────→ Google Maps
    │                              │   locations in parallel          Places API (New)
    │                              │                                  │
    │                              │ ←── 10 rich location objects     │
    │                              │     (address, summary, etc)      │
    │                              │                                  │
    │                              ├── Pass 2: profile + 10 locations→ Gemini API
    │                              │                                  │
    │                              │ ←── 10 tailored sidequests       │
    │                              │                                  │
    │                              ├── construct media URL from       │
    │                              │   resource identifier + API key  │
    │                              │                                  │
    │ ←── { sidequests[] } ────── │                                  │
    │  (locationInformation.photoURL│                                  │
    │      = constructed media URL) │                                  │
```

### What the Cloud Function does:

1. **Pass 1 (Scout):** Sends the user's profile to **Gemini** (`gemini-3.1-flash-lite`, minimal thinking, structured JSON output) to generate `count` high-level location concepts/queries, each tagged with an `intendedDifficulty` that maps to geographic scale.
2. **Location Fetch:** Cloud Function calls **Google Maps Places API (New)** `places:searchText` in parallel using `Promise.all()` to fetch rich details for those concepts (address, coordinates, editorial summary, photo references, maps URI). One place is currently selected at **random** from each query's result pool. Queries that return nothing are dropped (partial success — the batch continues with whatever resolved).
3. **Distance & transport math (local):** For each resolved location, if the request supplied `cityLatitude`/`cityLongitude`, the function computes a Haversine `distanceMiles` and heuristic per-mode `transportationOptions`. No external call.
4. **Pass 2 (Writer):** Sends the profile AND the enriched Maps locations back to **Gemini** (`gemini-3.5-flash`, structured JSON) to write highly-tailored sidequests. The model only selects an `assignedLocationId` and a `recommendedTransportationMode`; the backend re-attaches the exact, untouched Maps data by ID afterward so the LLM cannot corrupt real addresses/coordinates/URLs.
5. **Generic fallback (deficit filling):** If fewer locations resolved than `count`, the shortfall is filled with location-agnostic quests via a separate Gemini call. These come back **without** `locationInformation`.
6. The Places API returns a **photo resource identifier** (`name` field) for each photo — not a URL or raw image data. Example: `"places/ChIJN1t.../photos/AUacShh3Z..."`
7. Cloud Function constructs a **media URL** from the resource identifier: `https://places.googleapis.com/v1/{photo_name}/media?key=API_KEY&maxHeightPx=600` and returns it as `photoURL` — the app fetches and caches the image directly from Google.

### Security

- **Google Cloud Secret Manager** stores the Gemini API key — never exposed to the client
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
