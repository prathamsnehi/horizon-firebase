# Horizon — Backend Guide

This is the complete reference for building the Horizon backend. The backend is a set of Firebase Cloud Functions that orchestrate AI-powered sidequest generation using Gemini and Google Maps Places API. The iOS app treats the backend as a black box — it sends structured requests and receives structured responses.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Firebase Project Setup](#firebase-project-setup)
3. [Security](#security)
4. [External APIs](#external-apis)
5. [Cloud Function Endpoints](#cloud-function-endpoints)
6. [Gemini Integration](#gemini-integration)
7. [Google Maps Places API Integration](#google-maps-places-api-integration)
8. [Photo URL Construction](#photo-url-construction)
9. [Rate Limiting](#rate-limiting)
10. [Error Handling](#error-handling)
11. [Deployment & Testing](#deployment--testing)

---

## Architecture Overview

The backend is **two Firebase Cloud Functions** (HTTPS callable). The app never talks to Gemini or Google Maps directly — the Cloud Functions are the single point of contact.

```javascript
iOS App ←→ Firebase Cloud Functions ←→ Gemini API
                                   ←→ Google Maps Places API (New)
                                   ←→ Cloud Firestore (Pre-gen Cache)
```

### What the backend is responsible for:

- **Sidequest generation & Pre-generation** — AI-generated real-world challenges in batches of 10. The backend pre-generates the next batch in the background to ensure instant delivery.
- **Get Started guide generation** — on-demand step-by-step instructions for a specific quest

### What the backend is NOT responsible for:

- User authentication (no accounts in v1 — all data is local on device)
- Photo storage (user photos are stored locally on device, hero images are cached from Google Maps URLs)
- Push notifications (app uses local notifications only)
- Any UI concerns
- Sidequest selection/swiping (entirely app-side)

---

## Firebase Project Setup

### Required Firebase Services

| Service                                   | Purpose                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| **Cloud Functions** (2nd gen recommended) | Host the 3 HTTPS callable endpoints and background tasks                          |
| **Cloud Firestore**                       | Minimal usage: one collection to store pre-generated sidequest batches per device |
| **App Check**                             | Verify requests come from the genuine compiled iOS app                            |

That's it. No Auth, no Storage, no Cloud Messaging.

### Required Google Cloud Services

| Service            | Purpose                                                 |
| ------------------ | ------------------------------------------------------- |
| **Secret Manager** | Store Gemini API key securely (never exposed to client) |
| **Maps Platform**  | Places API (New) for location search and photos         |

### Project Init

```bash
# Initialize Firebase in the project directory
firebase init functions

# Use TypeScript (recommended for type safety with structured API responses)
# Select 2nd gen Cloud Functions when prompted
```

### Dependencies

The Cloud Functions project will need:

- `firebase-functions` — Cloud Functions SDK
- `firebase-admin` — Admin SDK (for App Check verification)
- `@google/generative-ai` — Gemini API SDK (or use REST directly)
- Google Maps Places API — called via REST (no official Node.js SDK for the "New" API)

---

## Security

### Firebase App Check

App Check ensures that only the genuine, compiled iOS app can call the Cloud Functions. Without it, anyone could hit the endpoints directly and rack up API costs.

- Enable App Check in the Firebase console
- Use **DeviceCheck** as the attestation provider for iOS
- Enforce App Check on all three Cloud Functions
- The Firebase Functions SDK handles token verification automatically when App Check is enforced

### Google Cloud Secret Manager

The **Gemini API key** must never be exposed to the client. Store it in Secret Manager and access it from Cloud Functions at runtime.

```javascript
Secret: GEMINI_API_KEY;
```

The Cloud Function reads this secret at invocation time. Firebase 2nd gen functions can reference secrets directly in their config.

### Google Maps API Key

The **Maps API key** is a special case. It gets embedded in the `photoURL` returned to the app (the app needs it to fetch the photo directly from Google). To keep this safe:

1. **Restrict the key to Places API (New) only** — no other Google APIs can use it
2. **Lock it to your app's iOS bundle ID** in Google Cloud Console
3. The URL travels over HTTPS and the image is cached locally by Kingfisher — the key is not stored or logged by the app

You can store this key in Secret Manager too, or in Cloud Functions environment config. Either way, the Cloud Function reads it to construct photo URLs.

---

## External APIs

### Gemini API

Used for all AI generation: onboarding conversation, sidequest generation, and Get Started guides.

- **Model choice is a backend decision** — the app doesn't know or care which model is used. Pick the best Gemini model for the task (cost vs quality tradeoff). You can change models anytime without touching the app.
- Gemini is called with structured output / function calling to get well-typed responses (not free-text that needs parsing)

### Google Maps Places API (New)

Used to find real places near the user's city for location-based sidequests.

- Use the **"New"** Places API (not the legacy one) — it supports field masks for efficient requests
- Called from Cloud Functions only, never from the app
- Provides: place address, coordinates, editorial summary, and **photo resource identifiers**

---

## Cloud Function Endpoints

All endpoints are **HTTPS callable** Cloud Functions invoked via Firebase's callable SDK (not raw HTTP). The SDK handles auth tokens, serialization, and App Check automatically.

### 1. `generateSidequests`

Generate a batch of sidequests based on the user's profile. The AI uses the profile to determine appropriate variety, difficulty, and mix. This is the only generation endpoint — there is no separate reroll or customization endpoint.

#### When it's called:

- **Initial batch after onboarding** — `count=10`, fill the swipe deck
- **User-initiated regeneration** — `count=10`, user explicitly chose to get a fresh batch (old remaining quests cleared app-side)
- **Batch exhausted** — `count=10`, auto-triggered when the user has completed/used all quests from the current batch

#### Request:

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

- `profile` — the user's onboarding profile (everything Gemini needs to personalize)
- `count` — how many sidequests to generate (always 10 for batch generation)
- `excludeTitles` — titles of recently completed sidequests, so the AI avoids duplicates
- `deviceId` — unique identifier for the user's device, used for rate limiting and fetching pre-generated batches

#### Pre-Generation Flow

To ensure the user doesn't have to wait for Gemini and Google Maps API calls, the backend pre-generates the next batch of 10 quests in the background immediately after delivering a batch.

**How it works:**

1. The app calls `generateSidequests`.
2. The Cloud Function checks Firestore for a pre-generated batch (`pregenerated_batches/{deviceId}`).
3. If a valid batch exists and the `profileHash` matches the current profile, it is returned instantly to the app.
4. If there's a cache miss (or the profile changed), the Cloud Function generates a fresh batch synchronously (the app waits and displays a "curating" loading state).
5. Right before returning the batch (whether cached or freshly generated), the Cloud Function kicks off a background task to pre-generate the _next_ batch of 10 using the same profile and `excludeTitles`.
6. This next batch is stored in the Firestore document, overwriting any previous one.

**Firestore Schema:**
Collection: `pregenerated_batches`
Document ID: `{deviceId}`

```json
{
    "sidequests": [...],
    "profileHash": "abc123...",
    "createdAt": Timestamp,
    "excludeTitles": [...]
}
```

**Profile Hash for Staleness:**
The `profileHash` is a hash of `(onboardingSummary, interests, growthAreas, city)`. If the user retakes onboarding or changes their city, the hash changes, invalidating the pre-generated batch. The cache also expires after 7 days (checked via `createdAt`).

**Edge Cases:**

- If the user completes quests rapidly and requests a new batch before the background pre-generation finishes, they will simply wait for a fresh generation.
- If pre-generation fails silently (e.g., Gemini timeout), the cache stays empty. The next request just generates fresh.
- `excludeTitles` overlap is minimal since the pre-generation runs right after completion, and we can also re-filter upon delivery if needed.

#### Response:

```json
{
    "sidequests": [
        {
            "title": "string",
            "description": "string",
            "difficulty": "easy | moderate | hard | extreme",
            "estimatedTime": "string",
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

#### Response field details:

| Field                | Type             | Description                                                                               |
| -------------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| `title`              | `string`         | Short, compelling quest name                                                              |
| `description`        | `string`         | What the quest is about and why it's worth doing                                          |
| `difficulty`         | `string`         | One of: `easy`, `moderate`, `hard`, `extreme`                                             |
| `estimatedTime`      | `string`         | Human-readable time estimate (e.g., "1 Hour", "2 Days", "30 Minutes")                     |
| `categories`         | `[string]`       | Classification labels (e.g., "adventure", "creativity", "connection", "mindfulness")      |
| `location`           | `object or null` | Present only for location-based quests. Not all quests need a location.                   |
| `location.address`   | `string`         | Human-readable address (e.g., "Dolores Park, San Francisco")                              |
| `location.latitude`  | `number`         | Latitude for MapKit display                                                               |
| `location.longitude` | `number`         | Longitude for MapKit display                                                              |
| `location.photoURL`  | `string`         | Constructed Google Maps media URL (see [Photo URL Construction](#photo-url-construction)) |

#### Orchestration flow (this is the core logic):

See [Gemini Integration](#gemini-integration) and [Google Maps Places API Integration](#google-maps-places-api-integration) for the full step-by-step flow.

#### Implementation notes:

- The AI should generate a **mix** of location-based and non-location quests. Not every quest needs a place — some are activities the user can do anywhere
- **Variety is critical** since the user sees all 10 at once in a swipe deck. Vary difficulty, category, time commitment, and type (solo vs social, free vs paid, indoor vs outdoor)
- Categories should feel natural and descriptive, not forced taxonomy. Examples: "adventure", "creativity", "connection", "wellness", "learning", "mindfulness", "spontaneity"
- `estimatedTime` should be human-readable strings, not machine-parseable durations. Examples: "30 Minutes", "1 Hour", "Half a Day", "A Weekend"
- Since there are 10 quests, aim for a balanced spread: \~3-4 easy, \~3-4 moderate, \~2-3 hard, \~0-1 extreme

---

### 2. `generateGetStartedGuide`

Generate a step-by-step guide for how to approach and complete a specific sidequest. Called on-demand when the user taps "Get Started" on the Home tab.

#### Request:

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

- `sidequest` — the quest to generate a guide for (only the fields Gemini needs for context)
- `profile` — a subset of the user's profile (so the guide can be personalized)

#### Response:

```json
{
  "steps": ["Step 1 description", "Step 2 description", "Step 3 description"]
}
```

#### Implementation notes:

- Steps should be practical, actionable, and personalized to the user
- Aim for 3-5 steps — enough to be helpful, not so many that it's overwhelming
- The guide should feel encouraging and specific, not generic
- This is a simple Gemini call with no Maps integration

---

## Gemini Integration

### Sidequest generation flow (used by `generateSidequests`)

This is the core orchestration pattern. The Cloud Function coordinates between Gemini and Google Maps:

```javascript
Cloud Function                         External APIs
    │                                       │
    ├── 1. Build prompt from user profile   │
    │      + excludeTitles                  │
    │                                       │
    ├── 2. Call Gemini ────────────────────→ Gemini API
    │      (with function declaration       │
    │       for place searching)            │
    │                                       │
    │ ←─── Gemini returns structured        │
    │      sidequest data + optionally      │
    │      requests a place search          │
    │      (textQuery)                      │
    │                                       │
    ├── 3. For each quest that needs a      │
    │      location, call Maps ───────────→ Google Maps Places API (New)
    │      with Gemini's search params      │
    │                                       │
    │ ←─── Maps returns address, lat/lng,   │
    │      editorial summary, photo         │
    │      resource identifier              │
    │                                       │
    ├── 4. Construct photoURL from          │
    │      resource identifier + API key    │
    │                                       │
    ├── 5. Merge Maps data into sidequest   │
    │      response object                  │
    │                                       │
    └── 6. Return final response to app     │
```

### Gemini prompting strategy

#### System prompt should establish:

- The app's purpose: generating real-world sidequests for personal growth
- The quest format: title, description, difficulty, estimatedTime, categories
- That some quests should be location-based (tied to a specific place in the user's city) and some should be location-agnostic
- **Variety requirement:** since the user sees all 10 in a swipe deck, the batch needs diverse difficulty levels, categories, time commitments, and types
- Quality guidelines: quests should be specific, actionable, interesting — not generic bucket-list items
- Difficulty rating criteria (easy = within comfort zone, moderate = meaningful stretch, hard = significant challenge, extreme = way outside comfort zone)

#### User context in the prompt:

- `interests` — what they're curious about
- `growthAreas` — where they want to grow / push themselves
- `vibe` — social vs solo preferences
- `experimentationLevel` — this should explicitly control how much Gemini deviates from the user's explicit preferences. A high value means Gemini should intentionally throw "wildcard" quests that fall outside the user's `interests` and `vibe`. A low value means Gemini should stick strictly to what the user explicitly requested.
- `budget` & `transportation` — strict parameters for the quest design (e.g. if transportation is "walking", quests shouldn't require driving across town).
- `locationPreferences` — what type of places they like
- `additionalContext` — any free-text nuance (e.g., "I have a dog")
- `city` — where they're based (for location-based quests)
- `excludeTitles` — quests to avoid duplicating

#### Structured output / function calling:

Use Gemini's structured output or function calling capabilities to get well-typed responses. The AI should return:

For each sidequest:

```javascript
{
    title: string,
    description: string,
    difficulty: "easy" | "moderate" | "hard" | "extreme",
    estimatedTime: string,
    categories: [string],
    needsLocation: boolean,
    placeSearchParams: {              // only if needsLocation is true
        textQuery: string             // natural language query (e.g., "State parks in Wisconsin", "Jazz clubs downtown Chicago")
    } | null
}
```

The `placeSearchParams` are what the Cloud Function uses to call the Google Maps Places API. Gemini decides _what kind of place_ would be good for this quest, and the Cloud Function finds a specific one.

---

## Google Maps Places API Integration

### API Version

Use the **Places API (New)** — NOT the legacy Places API. The new API uses field masks for efficient requests and has a different URL structure.

### Text Search (New)

When Gemini says a quest needs a location, call the Places API Text Search with the textQuery Gemini provided.

#### Endpoint:

```javascript
POST https://places.googleapis.com/v1/places:searchText
```

#### Headers:

```javascript
Content-Type: application/json
X-Goog-Api-Key: {MAPS_API_KEY}
X-Goog-FieldMask: places.displayName,places.formattedAddress,places.location,places.editorialSummary,places.photos
```

The **field mask is critical** — it controls which fields are returned and what you're billed for. Only request what you need.

#### Request body:

```json
{
  "textQuery": "Spicy Thai restaurants in downtown San Francisco",
  "maxResultCount": 1
}
```

- `textQuery` — from Gemini's `placeSearchParams.textQuery`. This gives Gemini infinite flexibility to search local or far away.
- `maxResultCount` — 1 is sufficient since we just need one place per quest

#### Response (relevant fields):

```json
{
  "places": [
    {
      "displayName": { "text": "Dolores Park" },
      "formattedAddress": "Dolores St &, 19th St, San Francisco, CA 94114",
      "location": {
        "latitude": 37.7596,
        "longitude": -122.4269
      },
      "editorialSummary": { "text": "Popular park with city views..." },
      "photos": [
        {
          "name": "places/ChIJN1t_tDeuEmsRUsoyG83frY4/photos/AUacShh3Z_6SpKRaHer2sFGsNr_WjJhfOpkU...",
          "widthPx": 4032,
          "heightPx": 3024
        }
      ]
    }
  ]
}
```

### Important: the `photos[].name` field

The `name` field in the photos array is a **resource identifier**, NOT a URL and NOT raw image data. It looks like:

```javascript
places/ChIJN1t.../photos/AUacShh3Z_6SpKRaHer2sFGsNr_WjJhfOpkU...
```

You must construct a media URL from this identifier. See next section.

---

## Photo URL Construction

The Google Maps Places API returns photo **resource identifiers**, not URLs. The Cloud Function must construct a media URL that the app can use to fetch the image directly.

### Media URL format:

```javascript
https://places.googleapis.com/v1/{PHOTO_RESOURCE_NAME}/media?key={MAPS_API_KEY}&maxHeightPx=600
```

### Example:

Given a photo resource name of:

```javascript
places /
  ChIJN1t_tDeuEmsRUsoyG83frY4 /
  photos /
  AUacShh3Z_6SpKRaHer2sFGsNr_WjJhfOpkU;
```

The constructed URL would be:

```javascript
https://places.googleapis.com/v1/places/ChIJN1t_tDeuEmsRUsoyG83frY4/photos/AUacShh3Z_6SpKRaHer2sFGsNr_WjJhfOpkU/media?key=AIza...&maxHeightPx=600
```

### Parameters:

- `key` — your Maps API key (restricted to Places API + app bundle ID)
- `maxHeightPx` — maximum height in pixels. `600` is a good default for mobile hero images (size-optimized to avoid downloading massive photos)
- You can use `maxWidthPx` instead if you prefer to constrain by width

### What the app does with this URL:

The app receives this constructed URL as `location.photoURL` in the sidequest response. It uses **Kingfisher** (`KFImage(url)`) to fetch and cache the image. Kingfisher handles:

- Async downloading
- Disk + memory caching
- Cache expiration
- Memory pressure
- Retry on failure

The image is fetched once from Google, then served from local cache on all subsequent loads. The Cloud Function never touches the image data — it just constructs the URL.

### If no photos are available:

Some places may not have photos. If `photos` is empty or missing in the Places API response, set `photoURL` to `null` in the sidequest response. The app will fall back to bundled placeholder images.

---

## Rate Limiting

Rate limits are enforced server-side per device identifier. The app sends a device identifier (vendor ID or similar) with each request, and the Cloud Function tracks usage.

### Suggested limits:

| Endpoint                  | Limit             |
| ------------------------- | ----------------- |
| `generateSidequests`      | 5 calls per hour  |
| `generateGetStartedGuide` | 10 calls per hour |

### Implementation approach:

- Use an in-memory store (or Firestore if persistence is needed) to track call counts per device per time window
- Return a `rate_limited` error code when exceeded (see [Error Handling](#error-handling))
- The app handles this gracefully with a user-friendly message

### Why these limits:

- `generateSidequests` at 5/hr is generous — normal usage is 1 call per session (one batch on quest completion). This limit exists to prevent abuse, not to constrain normal users
- `generateGetStartedGuide` at 10/hr is generous — one call per quest
- The swipe-to-choose model naturally limits backend calls: the user sees 10 options per batch, and batches persist until the user explicitly regenerates or exhausts all remaining quests

---

## Error Handling

All endpoints return errors in a consistent format.

### Error response shape:

```json
{
  "error": {
    "code": "string",
    "message": "string"
  }
}
```

### Error codes:

| Code                  | Meaning              | When                                                                |
| --------------------- | -------------------- | ------------------------------------------------------------------- |
| `rate_limited`        | Too many requests    | Device exceeded rate limit for this endpoint                        |
| `invalid_request`     | Malformed request    | Missing required fields, invalid values                             |
| `generation_failed`   | AI generation failed | Gemini returned an error, timed out, or returned unparseable output |
| `service_unavailable` | Backend is down      | Cloud Function infrastructure issue, dependency failure             |

### Implementation notes:

- Wrap all Gemini and Maps API calls in try/catch — these external APIs can fail
- If Gemini returns structured output that doesn't match the expected schema, treat it as `generation_failed`
- If the Maps API fails for a location-based quest, you can either: return the quest without a location (degrade gracefully), or retry once, or return `generation_failed`
- Log all errors server-side for debugging
- The `message` field should be human-readable but is primarily for debugging — the app uses the `code` to determine what UI to show

---

## Deployment & Testing

### Deployment

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy a specific function
firebase deploy --only functions:generateSidequests
```

### Testing each endpoint

Test manually before wiring up the app. You can use the Firebase console's Cloud Functions testing UI, or curl:

#### Test `generateSidequests`:

```bash
curl -X POST https://{REGION}-{PROJECT_ID}.cloudfunctions.net/generateSidequests \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
        "profile": {
            "interests": ["hiking", "street art", "coffee shops"],
            "growthAreas": ["meeting new people", "trying foods outside comfort zone"],
            "vibe": ["Social", "High Energy"],
            "experimentationLevel": 3,
            "budget": ["Moderate"],
            "transportation": ["Public Transit", "Walking"],
            "locationPreferences": ["Downtown", "Nature"],
            "additionalContext": null,
            "city": "San Francisco"
        },
        "count": 10,
        "excludeTitles": []
    }
  }'
```

#### Test `generateGetStartedGuide`:

```bash
curl -X POST https://{REGION}-{PROJECT_ID}.cloudfunctions.net/generateGetStartedGuide \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
        "sidequest": {
            "title": "Attend an open mic night",
            "description": "Find a local open mic night and either perform or watch. Push yourself to talk to at least one performer after their set.",
            "categories": ["connection", "creativity"]
        },
        "profile": {
            "interests": ["hiking", "street art", "coffee shops"],
            "growthAreas": ["meeting new people", "trying foods outside comfort zone"]
        }
    }
  }'
```

### Verification checklist:

- Both endpoints return correctly shaped responses
- `generateSidequests` returns 10 quests with good variety (difficulty, category, location vs non-location)
- Location-based quests have valid `photoURL` values that resolve to actual images when opened in a browser
- `generateGetStartedGuide` returns practical, personalized steps
- Rate limiting works and returns `rate_limited` error code when exceeded
- App Check is enforced (unauthenticated requests are rejected)
- Gemini API key is not exposed anywhere in responses
- Maps API key in `photoURL` is restricted to Places API + bundle ID

---

## Quick Reference: App <-> Backend Data Mapping

For context, here's how the backend response fields map to the iOS app's SwiftData model:

| Backend response field | iOS model field                                             | Notes                                                |
| ---------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| `title`                | `Sidequest.title`                                           | Direct mapping                                       |
| `description`          | `Sidequest.questDescription`                                | Renamed on iOS to avoid Swift reserved word conflict |
| `difficulty`           | `Sidequest.difficulty`                                      | String -> `DifficultyRating` enum on iOS             |
| `estimatedTime`        | `Sidequest.estimatedTime`                                   | Direct mapping                                       |
| `categories`           | `Sidequest.categories`                                      | Direct mapping                                       |
| `location.address`     | `Sidequest.locationAddress`                                 | `nil` if no location                                 |
| `location.latitude`    | `Sidequest.locationLatitude`                                | `nil` if no location                                 |
| `location.longitude`   | `Sidequest.locationLongitude`                               | `nil` if no location                                 |
| `location.photoURL`    | `Sidequest.heroImageURL`                                    | `nil` if no location or no photo                     |
| _(not in response)_    | `Sidequest.status`                                          | Always `.available` on creation — app-side only      |
| _(not in response)_    | `Sidequest.id`, `.createdAt`                                | Generated on device                                  |
| _(not in response)_    | `Sidequest.completedAt`, `.journalEntry`, `.photoFilenames` | Populated by user on completion                      |
| _(not in response)_    | `Sidequest.getStartedSteps`                                 | Populated by separate `generateGetStartedGuide` call |

### UserProfile mapping (collected via Guided UI):

| App Model field                      |                                       |
| ------------------------------------ | ------------------------------------- |
| `UserProfile.interests`              |                                       |
| `UserProfile.growthAreas`            |                                       |
| `UserProfile.vibe`                   |                                       |
| `UserProfile.experimentationLevel`   |                                       |
| `UserProfile.budget`                 |                                       |
| `UserProfile.transportation`         |                                       |
| `UserProfile.locationPreferences`    |                                       |
| `UserProfile.additionalContext`      |                                       |
| `UserProfile.city`                   |                                       |
| `UserProfile.hasCompletedOnboarding` | Set to `true` by app after onboarding |
