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
    "transportation": ["string"],
    "locationPreferences": ["string"],
    "additionalContext": "string or null",
    "city": "string"
  },
  "count": 10,
  "excludeTitles": ["string"],
  "deviceId": "string"
}
```

`count` is always 10 for batch generation. `excludeTitles` contains titles of recently completed sidequests to avoid duplicates. `deviceId` is used for fetching pre-generated batches from Firestore and for rate-limiting.

**App Behavior:** The app calls this endpoint and waits for a response. If a pre-generated batch is available on the backend, the response will be instant. If a fresh batch needs to be generated (e.g. first time, or profile changed), it may take a few seconds. The app should show a "curating" state (e.g., "New sidequests are being curated for you...") if the request takes longer than 2 seconds.

**Response:**

```json
{
    "sidequests": [
        {
            "title": "string",
            "description": "string",
            "difficulty": "easy" | "moderate" | "hard" | "extreme",
            "estimatedTime": "1 Hour",
            "categories": ["string"],
            "location": {
                "address": "string",
                "latitude": 37.7694,
                "longitude": -122.4862,
                "photoURL": "string"
            } | null
        }
    ]
}
```

### 2. `generateGetStartedGuide`

Generate a step-by-step guide for approaching a specific sidequest. Called on demand when the user taps "Get Started."

**Request:**

```json
{
  "sidequest": {
    "title": "string",
    "description": "string",
    "categories": ["string"]
  },
  "profile": {
    "interests": ["string"],
    "growthAreas": ["string"],
    "additionalContext": "string or null"
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

All endpoints return standard error responses:

```json
{
  "error": {
    "code": "string",
    "message": "string"
  }
}
```

Common error codes:

- `rate_limited` — too many requests, show cooldown UI
- `invalid_request` — malformed request, log and retry
- `generation_failed` — AI generation failed, show retry button
- `service_unavailable` — backend down, show offline state

## Rate Limiting

Rate limits are enforced server-side per device identifier (vendor ID or similar). Suggested limits:

- `generateSidequests` — 5 calls per hour (normal usage is \~1 call per session — one batch on completion)
- `generateGetStartedGuide` — 10 calls per hour

The app should handle `rate_limited` gracefully with a user-friendly message and countdown.

## Backend Orchestration — Gemini + Google Maps

The Cloud Functions use a multi-step orchestration pattern to generate location-aware sidequests:

### Flow

```javascript
Mobile App                    Cloud Function                     External APIs
    │                              │                                  │
    ├── { profile, count } ──────→ │                                  │
    │                              ├── prompt + user context ────────→ Gemini API
    │                              │                                  │
    │                              │ ←── structured sidequests +      │
    │                              │     search params                │
    │                              │     (textQuery)                  │
    │                              │                                  │
    │                              ├── textQuery ────────────────────→ Google Maps
    │                              │                                  Places API (New)
    │                              │                                  │
    │                              │ ←── address, lat/lng,            │
    │                              │     editorial summary,           │
    │                              │     photo resource identifier    │
    │                              │                                  │
    │                              ├── construct media URL from       │
    │                              │   resource identifier + API key  │
    │                              │                                  │
    │ ←── { sidequests[] } ────── │                                  │
    │     (with location.photoURL  │                                  │
    │      = constructed media URL)│                                  │
```

### What the Cloud Function does:

1. Sends the user's profile + city to **Gemini** with a function declaration for location searching
2. Gemini returns structured sidequest data + search parameters for relevant places
3. Cloud Function calls **Google Maps Places API (New)** with those parameters, using a Field Mask to fetch only: address, coordinates, editorial summary, and photo references
4. The Places API returns a **photo resource identifier** (`name` field) for each photo — not a URL or raw image data. Example: `"places/ChIJN1t.../photos/AUacShh3Z..."`
5. Cloud Function constructs a **media URL** from the resource identifier: `https://places.googleapis.com/v1/{photo_name}/media?key=API_KEY&maxHeightPx=600`
6. Returns this constructed URL as `photoURL` in the response — the app fetches and caches the image directly from Google

### Security

- **Google Cloud Secret Manager** stores the Gemini API key — never exposed to the client
- The **Maps API key** is embedded in the `photoURL` returned to the app. This key should be restricted to the Places API only and locked to your app's bundle ID via Google Cloud Console. The URL travels over HTTPS and lives only in the app's local cache.
- **Firebase App Check** ensures only the genuine compiled app can trigger Cloud Functions, preventing API abuse

### What the app receives

The app doesn't know about Gemini or the orchestration details. It just receives a sidequest with an optional `location` object containing `address`, `latitude`, `longitude`, and `photoURL`. The `photoURL` is a Google Maps media URL that the app loads directly.

### Image loading on the app side

- The app loads hero images from the `photoURL` using **Kingfisher** for async downloading and disk/memory caching
- Images are already size-optimized via the `maxHeightPx` parameter baked into the URL by the Cloud Function
- Kingfisher handles cache expiration, memory pressure, and retry logic automatically
- Once cached locally, images load instantly on repeat views without additional network requests
- Non-location quests use pre-loaded placeholder images bundled with the app — no network call needed

## Note on Share Captions

Share captions are **not AI-generated**. The app uses pre-configured template text with placeholders (e.g., sidequest title, categories) that is general enough for social media posting. This keeps sharing instant, offline-capable, and free of API calls.
