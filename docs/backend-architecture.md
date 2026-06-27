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

The backend is **four Firebase Cloud Functions** (HTTPS callable). The app never talks to Gemini or Google Maps directly — the Cloud Functions are the single point of contact.

```
iOS App ←→ Firebase Cloud Functions ←→ Gemini API
                                   ←→ Google Maps Places API (New)
```

### What the backend is responsible for:

- **Onboarding conversation** — multi-turn AI chat that learns about the user, extracts a structured profile when done
- **Sidequest generation** — AI-generated real-world challenges, optionally tied to specific nearby locations with photos
- **Sidequest rerolling** — same as generation but for a single quest with custom tuning dials
- **Get Started guide generation** — on-demand step-by-step instructions for a specific quest

### What the backend is NOT responsible for:

- User authentication (no accounts in v1 — all data is local on device)
- Photo storage (user photos are stored locally on device, hero images are cached from Google Maps URLs)
- Push notifications (app uses local notifications only)
- Any UI concerns

---

## Firebase Project Setup

### Required Firebase Services

| Service                                   | Purpose                                                |
| ----------------------------------------- | ------------------------------------------------------ |
| **Cloud Functions** (2nd gen recommended) | Host the 4 HTTPS callable endpoints                    |
| **App Check**                             | Verify requests come from the genuine compiled iOS app |

That's it. No Firestore, no Auth, no Storage, no Cloud Messaging.

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
- Enforce App Check on all four Cloud Functions
- The Firebase Functions SDK handles token verification automatically when App Check is enforced

### Google Cloud Secret Manager

The **Gemini API key** must never be exposed to the client. Store it in Secret Manager and access it from Cloud Functions at runtime.

```
Secret: GEMINI_API_KEY
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

Used for all AI generation: onboarding conversation, sidequest generation, rerolling, and Get Started guides.

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

---

### 1. `onboardingChat`

A conversational endpoint for the onboarding flow. Uses **progressive summarization** to keep payloads small — instead of sending the full message history each turn, the client sends a compact summary (returned by the previous call) plus only the new message.

#### How progressive summarization works:

1. User sends their first message → `conversationSummary` is `null`
2. Cloud Function sends the message to Gemini along with system instructions about what to learn about the user
3. Gemini responds with a reply and the Cloud Function generates an `updatedSummary` — a compact text blob capturing everything learned so far
4. The app stores this summary in memory and sends it back with the next message
5. This repeats until Gemini determines it has enough information to build a profile

#### What the AI should learn during onboarding:

The conversation should naturally explore:

- How the user currently explores and experiences new things
- Where they want to grow, or what they wish they had the courage to try
- What a great week looks like for them
- What's holding them back from doing more
- What city they're based in

The tone should be warm, curious, and conversational — not a form or interrogation.

#### Request:

```json
{
  "conversationSummary": "string or null",
  "message": "string"
}
```

- `conversationSummary` — `null` for the first message, then the `updatedSummary` from the previous response
- `message` — the user's latest message

#### Response (conversation ongoing):

```json
{
  "reply": "string",
  "updatedSummary": "string",
  "isComplete": false,
  "extractedProfile": null
}
```

#### Response (conversation complete):

When the AI decides it has enough information, `isComplete` becomes `true` and `extractedProfile` is populated:

```json
{
  "reply": "Great, I've got a good picture of who you are! Let's find some adventures for you.",
  "updatedSummary": "string",
  "isComplete": true,
  "extractedProfile": {
    "onboardingSummary": "string",
    "interests": ["string"],
    "growthAreas": ["string"],
    "city": "string"
  }
}
```

#### Extracted profile fields:

| Field               | Type       | Description                                                                             |
| ------------------- | ---------- | --------------------------------------------------------------------------------------- |
| `onboardingSummary` | `string`   | AI-generated summary of who this user is — their personality, motivations, lifestyle    |
| `interests`         | `[string]` | Things they're curious about or enjoy                                                   |
| `growthAreas`       | `[string]` | Where they want to grow + things they wish they had the courage to try (merged concept) |
| `city`              | `string`   | Their base city (e.g., "San Francisco") — used for location-based quest generation      |

#### Implementation notes:

- The system prompt for Gemini should instruct it to be warm and conversational, ask follow-up questions, and avoid rapid-fire interrogation
- Gemini should aim for ~4-6 conversational turns before completing (enough to feel personal, not so many that it drags)
- The `updatedSummary` should be generated by Gemini as part of its response (instruct it to maintain a running summary alongside its reply)
- When Gemini decides it has enough, instruct it to return a structured `extractedProfile` using function calling / structured output
- If the user's messages are very short or uncooperative, the AI should still try to extract what it can and complete gracefully

---

### 2. `generateSidequests`

Generate sidequests based on the user's profile. No tuning dials — the AI uses the profile to determine appropriate variety, difficulty, and mix. This is the standard generation path.

#### When it's called:

- **Initial batch after onboarding** — `count=5`, fill all 5 slots
- **Filling an empty slot** — `count=1`, when the user taps "Generate new sidequest" after completing or rerolling one

#### Request:

```json
{
  "profile": {
    "onboardingSummary": "string",
    "interests": ["string"],
    "growthAreas": ["string"],
    "city": "string"
  },
  "count": 1,
  "excludeTitles": ["string"]
}
```

- `profile` — the user's onboarding profile (everything Gemini needs to personalize)
- `count` — how many sidequests to generate (1-5)
- `excludeTitles` — titles of the user's currently active sidequests, so the AI avoids duplicates

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
- Variety in difficulty is important — don't generate 5 hard quests or 5 easy ones
- Categories should feel natural and descriptive, not forced taxonomy. Examples: "adventure", "creativity", "connection", "wellness", "learning", "mindfulness", "spontaneity"
- `estimatedTime` should be human-readable strings, not machine-parseable durations. Examples: "30 Minutes", "1 Hour", "Half a Day", "A Weekend"

---

### 3. `rerollSidequest`

Generate a **single** sidequest with custom tuning dial overrides. Used when the user wants to replace a specific quest and tune what they get back.

#### Request:

```json
{
  "profile": {
    "onboardingSummary": "string",
    "interests": ["string"],
    "growthAreas": ["string"],
    "city": "string"
  },
  "dials": {
    "boldness": 0.0,
    "soloOrGroup": 0.0,
    "budget": "zero",
    "wildcard": 0.0
  },
  "excludeTitles": ["string"]
}
```

#### Tuning dials:

| Dial          | Type     | Range                                    | Description                                                                                                                 |
| ------------- | -------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `boldness`    | `float`  | 0.0 - 1.0                                | How far outside their comfort zone. 0 = cozy, 0.5 = challenging, 1.0 = fearless                                             |
| `soloOrGroup` | `float`  | 0.0 - 1.0                                | 0 = solo activity, 1.0 = group activity                                                                                     |
| `budget`      | `string` | `"zero"`, `"coupleDollars"`, `"splurge"` | How much the quest can cost                                                                                                 |
| `wildcard`    | `float`  | 0.0 - 1.0                                | How random/unexpected. 0 = relevant to interests, 1.0 = completely out of left field. Conceptually similar to "temperature" |

#### Response:

```json
{
    "sidequest": {
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
}
```

Same sidequest shape as `generateSidequests`, but always exactly one (not wrapped in an array).

#### Implementation notes:

- Same orchestration flow as `generateSidequests` (Gemini → optional Maps lookup → photo URL construction)
- The dials should be translated into Gemini prompt instructions. For example, `boldness: 0.9` might add "This should be something that really pushes them outside their comfort zone" to the prompt
- `wildcard: 1.0` should make the AI ignore the user's interests and generate something completely unexpected
- `budget: "zero"` should explicitly constrain the quest to be free

---

### 4. `generateGetStartedGuide`

Generate a step-by-step guide for how to approach and complete a specific sidequest. Called on-demand when the user taps "Get Started" on a quest detail screen.

#### Request:

```json
{
  "sidequest": {
    "title": "string",
    "description": "string",
    "categories": ["string"]
  },
  "profileSummary": "string"
}
```

- `sidequest` — the quest to generate a guide for (only the fields Gemini needs for context)
- `profileSummary` — the user's `onboardingSummary` (so the guide can be personalized)

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

### Sidequest generation flow (used by `generateSidequests` and `rerollSidequest`)

This is the core orchestration pattern. The Cloud Function coordinates between Gemini and Google Maps:

```
Cloud Function                         External APIs
    │                                       │
    ├── 1. Build prompt from user profile   │
    │      + dial overrides (if reroll)     │
    │      + excludeTitles                  │
    │                                       │
    ├── 2. Call Gemini ────────────────────→ Gemini API
    │      (with function declaration       │
    │       for place searching)            │
    │                                       │
    │ ←─── Gemini returns structured        │
    │      sidequest data + optionally      │
    │      requests a place search          │
    │      (place types, keywords,          │
    │      rank preference)                 │
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
- Quality guidelines: quests should be specific, actionable, interesting — not generic bucket-list items
- Difficulty rating criteria (easy = within comfort zone, moderate = meaningful stretch, hard = significant challenge, extreme = way outside comfort zone)

#### User context in the prompt:

- `onboardingSummary` — who this person is
- `interests` — what they're curious about
- `growthAreas` — where they want to grow / what they wish they had courage to try
- `city` — where they're based (for location-based quests)
- `excludeTitles` — quests to avoid duplicating
- Dial overrides (reroll only): boldness, soloOrGroup, budget, wildcard

#### Structured output / function calling:

Use Gemini's structured output or function calling capabilities to get well-typed responses. The AI should return:

For each sidequest:

```
{
    title: string,
    description: string,
    difficulty: "easy" | "moderate" | "hard" | "extreme",
    estimatedTime: string,
    categories: [string],
    needsLocation: boolean,
    placeSearchParams: {              // only if needsLocation is true
        includedTypes: [string],      // Google Maps place types (e.g., "park", "art_gallery")
        keywords: string,            // text query to refine search
        rankPreference: "DISTANCE" | "RELEVANCE"
    } | null
}
```

The `placeSearchParams` are what the Cloud Function uses to call the Google Maps Places API. Gemini decides _what kind of place_ would be good for this quest, and the Cloud Function finds a specific one.

---

## Google Maps Places API Integration

### API Version

Use the **Places API (New)** — NOT the legacy Places API. The new API uses field masks for efficient requests and has a different URL structure.

### Nearby Search (New)

When Gemini says a quest needs a location, call the Places API Nearby Search with the params Gemini provided.

#### Endpoint:

```
POST https://places.googleapis.com/v1/places:searchNearby
```

#### Headers:

```
Content-Type: application/json
X-Goog-Api-Key: {MAPS_API_KEY}
X-Goog-FieldMask: places.displayName,places.formattedAddress,places.location,places.editorialSummary,places.photos
```

The **field mask is critical** — it controls which fields are returned and what you're billed for. Only request what you need.

#### Request body:

```json
{
  "includedTypes": ["park"],
  "maxResultCount": 1,
  "rankPreference": "RELEVANCE",
  "locationRestriction": {
    "circle": {
      "center": {
        "latitude": 37.7749,
        "longitude": -122.4194
      },
      "radius": 10000.0
    }
  }
}
```

- `includedTypes` — from Gemini's `placeSearchParams.includedTypes`
- `rankPreference` — from Gemini's `placeSearchParams.rankPreference`
- `locationRestriction` — center on the user's city. You'll need to geocode the city name to lat/lng (can be done once and cached, or use the Geocoding API)
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

```
places/ChIJN1t.../photos/AUacShh3Z_6SpKRaHer2sFGsNr_WjJhfOpkU...
```

You must construct a media URL from this identifier. See next section.

---

## Photo URL Construction

The Google Maps Places API returns photo **resource identifiers**, not URLs. The Cloud Function must construct a media URL that the app can use to fetch the image directly.

### Media URL format:

```
https://places.googleapis.com/v1/{PHOTO_RESOURCE_NAME}/media?key={MAPS_API_KEY}&maxHeightPx=600
```

### Example:

Given a photo resource name of:

```
places/ChIJN1t_tDeuEmsRUsoyG83frY4/photos/AUacShh3Z_6SpKRaHer2sFGsNr_WjJhfOpkU
```

The constructed URL would be:

```
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

| Endpoint                  | Limit                   |
| ------------------------- | ----------------------- |
| `generateSidequests`      | 10 calls per hour       |
| `rerollSidequest`         | 20 calls per hour       |
| `onboardingChat`          | 30 messages per session |
| `generateGetStartedGuide` | 10 calls per hour       |

### Implementation approach:

- Use an in-memory store (or Firestore if persistence is needed) to track call counts per device per time window
- Return a `rate_limited` error code when exceeded (see [Error Handling](#error-handling))
- The app handles this gracefully with a user-friendly message

### Why these limits:

- `generateSidequests` at 10/hr is generous — normal usage is ~1-2 calls per session
- `rerollSidequest` at 20/hr accounts for users experimenting with dials
- `onboardingChat` at 30/session prevents infinite conversation loops (onboarding should complete in ~4-6 turns)
- These limits primarily protect against API cost abuse, not normal user behavior

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

#### Test `onboardingChat`:

```bash
# First message (no summary)
curl -X POST https://{REGION}-{PROJECT_ID}.cloudfunctions.net/onboardingChat \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
        "conversationSummary": null,
        "message": "Hey! I just moved to San Francisco and I want to get out more."
    }
  }'
```

#### Test `generateSidequests`:

```bash
curl -X POST https://{REGION}-{PROJECT_ID}.cloudfunctions.net/generateSidequests \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
        "profile": {
            "onboardingSummary": "Adventurous 25-year-old software developer who wants to explore more of SF. Loves hiking and art.",
            "interests": ["hiking", "street art", "coffee shops", "live music"],
            "growthAreas": ["public speaking", "meeting new people", "trying foods outside comfort zone"],
            "city": "San Francisco"
        },
        "count": 3,
        "excludeTitles": []
    }
  }'
```

#### Test `rerollSidequest`:

```bash
curl -X POST https://{REGION}-{PROJECT_ID}.cloudfunctions.net/rerollSidequest \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
        "profile": {
            "onboardingSummary": "Adventurous 25-year-old...",
            "interests": ["hiking", "street art"],
            "growthAreas": ["public speaking"],
            "city": "San Francisco"
        },
        "dials": {
            "boldness": 0.8,
            "soloOrGroup": 0.3,
            "budget": "coupleDollars",
            "wildcard": 0.5
        },
        "excludeTitles": ["Visit Dolores Park at sunset"]
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
        "profileSummary": "Adventurous 25-year-old software developer who wants to explore more of SF."
    }
  }'
```

### Verification checklist:

- [ ] All 4 endpoints return correctly shaped responses
- [ ] `onboardingChat` maintains conversation context via progressive summarization
- [ ] `onboardingChat` eventually returns `isComplete: true` with a populated `extractedProfile`
- [ ] `generateSidequests` returns a mix of location-based and non-location quests
- [ ] Location-based quests have valid `photoURL` values that resolve to actual images when opened in a browser
- [ ] `rerollSidequest` respects dial values (high boldness → harder quest, budget zero → free quest, etc.)
- [ ] `generateGetStartedGuide` returns practical, personalized steps
- [ ] Rate limiting works and returns `rate_limited` error code when exceeded
- [ ] App Check is enforced (unauthenticated requests are rejected)
- [ ] Gemini API key is not exposed anywhere in responses
- [ ] Maps API key in `photoURL` is restricted to Places API + bundle ID

---

## Quick Reference: App ↔ Backend Data Mapping

For context, here's how the backend response fields map to the iOS app's SwiftData model:

| Backend response field | iOS model field                                             | Notes                                                |
| ---------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| `title`                | `Sidequest.title`                                           | Direct mapping                                       |
| `description`          | `Sidequest.questDescription`                                | Renamed on iOS to avoid Swift reserved word conflict |
| `difficulty`           | `Sidequest.difficulty`                                      | String → `DifficultyRating` enum on iOS              |
| `estimatedTime`        | `Sidequest.estimatedTime`                                   | Direct mapping                                       |
| `categories`           | `Sidequest.categories`                                      | Direct mapping                                       |
| `location.address`     | `Sidequest.locationAddress`                                 | `nil` if no location                                 |
| `location.latitude`    | `Sidequest.locationLatitude`                                | `nil` if no location                                 |
| `location.longitude`   | `Sidequest.locationLongitude`                               | `nil` if no location                                 |
| `location.photoURL`    | `Sidequest.heroImageURL`                                    | `nil` if no location or no photo                     |
| _(not in response)_    | `Sidequest.status`                                          | Always `.inbox` on creation — app-side only          |
| _(not in response)_    | `Sidequest.id`, `.createdAt`                                | Generated on device                                  |
| _(not in response)_    | `Sidequest.completedAt`, `.journalEntry`, `.photoFilenames` | Populated by user on completion                      |
| _(not in response)_    | `Sidequest.getStartedSteps`                                 | Populated by separate `generateGetStartedGuide` call |

### UserProfile mapping (from `onboardingChat` extractedProfile):

| Backend response field               | iOS model field                      |
| ------------------------------------ | ------------------------------------ | --------------------------------------------- |
| `extractedProfile.onboardingSummary` | `UserProfile.onboardingSummary`      |
| `extractedProfile.interests`         | `UserProfile.interests`              |
| `extractedProfile.growthAreas`       | `UserProfile.growthAreas`            |
| `extractedProfile.city`              | `UserProfile.city`                   |
| _(not in response)_                  | `UserProfile.hasCompletedOnboarding` | Set to `true` by app after profile extraction |
