# Horizon Backend Structure

This document outlines the desired directory structure for the Firebase Cloud Functions backend, utilizing the **Controller-Service-Integration** pattern. This structure ensures that code is scalable, testable, and cleanly separated by responsibility.

## The Directory Tree

The `functions/src` directory should be organized as follows:

```text
functions/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                 # Main entrypoint: exports all Cloud Functions
    ├── config.ts                # Environment variables, secret names, and constants
    ├── types.ts                 # TypeScript interfaces for everything
    ├── utils/
    │   └── hash.ts              # Small utilities (e.g., profile hashing)
    │
    ├── controllers/             # Layer 1: Firebase HTTP/Callable Handlers
    │   └── sidequests.ts
    │
    ├── services/                # Layer 2: Core Business Logic
    │   └── sidequestService.ts
    │
    └── integrations/            # Layer 3: External APIs & Database
        ├── gemini.ts            # Google AI Studio / Gemini SDK wrapper
        ├── maps.ts              # Google Maps Places API wrapper
        └── firestore.ts         # Firestore read/write wrappers for cache
```

---

## The Three Layers in Detail

### 1. Controllers (`src/controllers/`)
**Responsibility:** Interface with Firebase and the iOS app.
- This is where you define your `onCall` (Firebase 2nd Gen) functions.
- **What it does:** 
  - Extracts incoming data from `request.data`.
  - Validates the request (e.g., checks if `deviceId` is present).
  - Calls the appropriate Service to do the actual work.
  - Catches any errors thrown by the Service and formats them into Firebase `HttpsError` objects so the iOS app receives clean error codes (e.g., `rate_limited`).
- **What it DOES NOT do:** No AI logic, no API keys, no direct database calls.

*Example:* `controllers/sidequests.ts` just receives the profile and device ID, passes them to `SidequestService.getBatch()`, and returns the result.

### 2. Services (`src/services/`)
**Responsibility:** The brain of the backend (Business Logic).
- **What it does:**
  - Implements the core logic of the app.
  - For sidequests, it checks the Firestore cache (via the Integration layer). 
  - If a cache miss occurs, it asks Gemini (Integration layer) for new quests, loops through them to fetch photos from Maps (Integration layer), and returns the final payload.
  - Triggers the background promise to pre-generate the next batch.
- **Why this layer exists:** The Service layer takes standard TypeScript arguments and returns standard objects. Because it doesn't know about Firebase's `request` and `response` objects, you can easily write unit tests for it locally.

### 3. Integrations (`src/integrations/`)
**Responsibility:** Talk to the outside world.
- **What it does:** 
  - Wraps third-party SDKs and network calls. 
  - `gemini.ts`: Initializes the `GoogleGenerativeAI` client, contains the system prompts, and handles the Structured Output / function calling formatting.
  - `maps.ts`: Handles the raw `fetch` call to the Places API, passes the `X-Goog-FieldMask`, and constructs the final photo media URLs.
  - `firestore.ts`: Provides simple helper functions like `getCachedBatch(deviceId)` and `saveBatch(deviceId, batch)`.
- **Why this layer exists:** If Google Maps changes their API endpoint, or if you decide to swap Gemini for another model later, you only have to rewrite the files in this folder. The rest of the app remains completely untouched.

---

## Shared Resources

### `types.ts`
All TypeScript interfaces should live here (or in a dedicated `types/` folder if it gets large). This includes:
- Request/Response shapes matching `api-contracts.md`.
- Firestore document shapes.
- Gemini structured output types.

### `config.ts`
Hardcoded values and configurations go here. For example:
- Expiration time for pre-generated batches (e.g., `7 * 24 * 60 * 60 * 1000` for 7 days).
- Maximum result count for the Maps API.
- The base URL for Maps photo construction.

## Example Flow: Generating Sidequests

1. **App** calls `generateSidequests`.
2. **Controller (`controllers/sidequests.ts`)** receives the call, validates `deviceId`, and passes the data to `sidequestService.ts`.
3. **Service (`services/sidequestService.ts`)** calls `firestore.ts` to check for a pre-generated batch.
4. **Integration (`firestore.ts`)** reads the cache and returns it.
5. If valid, the **Service** returns the batch to the **Controller**, but simultaneously kicks off a background task.
6. The background task calls `gemini.ts` to generate quests, then `maps.ts` to fetch photos, and finally `firestore.ts` to save the new cache.
7. The **Controller** sends the instant response back to the **App**.
