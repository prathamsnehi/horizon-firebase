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
    ├── config.ts                # Secret names + constants (CURATED_BATCH_SIZE, Cloud Tasks)
    ├── types.ts                 # TypeScript interfaces for everything
    ├── utils/
    │   ├── hash.ts              # hashProfile — stable profile hash for cache invalidation
    │   ├── distance.ts          # Haversine distance + heuristic transport times
    │   └── prompts.ts           # Prompt builders (scout, writer, generic, describe planner)
    │
    ├── controllers/             # Layer 1: Firebase Callable / Task Handlers
    │   ├── quests.ts        # generateCuratedQuests, generateUserDescribedQuest
    │   └── tasks.ts             # pregenerateCuratedBatch (onTaskDispatched)
    │
    ├── services/                # Layer 2: Core Business Logic
    │   └── questService.ts  # generateBatch, generateDescribed, enrichLocations
    │
    ├── llm/                     # Provider-agnostic LLM layer (Vercel AI SDK)
    │   ├── router.ts            # distribute + failover across providers
    │   ├── models.ts            # provider registry + per-stage model classes
    │   ├── rateLimits.ts        # per-model free-tier limits
    │   ├── schemas.ts           # Zod structured-output schemas
    │   └── tasks.ts             # scout / writer / generic / describe-planner calls
    │
    └── integrations/            # Layer 3: External APIs & Database
        ├── maps.ts              # Google Maps Places API wrapper (getBestLocation)
        └── firestore.ts         # Cache (pregen_cache), logs, rate buckets
```

_Note: the old `integrations/gemini.ts` was replaced by the multi-provider `llm/` layer._

---

## The Three Layers in Detail

### 1. Controllers (`src/controllers/`)
**Responsibility:** Interface with Firebase and the iOS app.
- This is where you define your `onCall` (Firebase 2nd Gen) functions.
- **What it does:** 
  - Extracts incoming data from `request.data`.
  - Validates the request (e.g., checks the profile payload is well-formed). Identity comes from the authenticated `request.auth.uid`, not the payload.
  - Calls the appropriate Service to do the actual work.
  - Catches any errors thrown by the Service and formats them into Firebase `HttpsError` objects so the iOS app receives clean error codes (e.g., `resource-exhausted`).
- **What it DOES NOT do:** No AI logic, no API keys, no direct database calls.

*Example:* `controllers/quests.ts` just receives the profile, passes it to `QuestService.getBatch()`, and returns the result.

### 2. Services (`src/services/`)
**Responsibility:** The brain of the backend (Business Logic).
- **What it does:**
  - Implements the core logic of the app.
  - For quests, it checks the Firestore cache (via the Integration layer). 
  - If a cache miss occurs, it asks the `llm/` layer for new quests, loops through them to fetch photos from Maps (Integration layer), and returns the final payload.
  - Triggers the background promise to pre-generate the next batch.
- **Why this layer exists:** The Service layer takes standard TypeScript arguments and returns standard objects. Because it doesn't know about Firebase's `request` and `response` objects, you can easily write unit tests for it locally.

### 3. Integrations (`src/integrations/`)
**Responsibility:** Talk to the outside world.
- **What it does:** 
  - Wraps third-party SDKs and network calls. 
  - `maps.ts`: Handles the raw `fetch` call to the Places API, passes the `X-Goog-FieldMask`, and fetches photo bytes server-side.
  - `firestore.ts`: Provides helper functions like `getPregenCache(uid)` / `savePregeneratedBatch(uid, batch, hash)`, the rate-limit reservation, and the global LLM rate-bucket limiter.
  - (LLM provider SDKs live one layer up in `llm/`, behind the router — not here.)
- **Why this layer exists:** If Google Maps changes their API endpoint, or you swap a model provider, you only have to rewrite the files in this folder (or `llm/`). The rest of the app remains untouched.

---

## Shared Resources

### `types.ts`
All TypeScript interfaces should live here (or in a dedicated `types/` folder if it gets large). This includes:
- Request/Response shapes matching `api-contracts.md`.
- Firestore document shapes.
- LLM structured-output types (the Zod schemas themselves live in `llm/schemas.ts`).

### `config.ts`
Hardcoded values and configurations go here. For example:
- Expiration time for pre-generated batches (`BATCH_TTL_MS`, currently 60 days).
- Maximum result count for the Maps API.
- The base URL for Maps photo construction.

## Example Flow: The curated daily batch (cache-first)

1. **App** calls `generateCuratedQuests`.
2. **Controller (`controllers/quests.ts`)** validates the payload, reads `pregen_cache/{uid}` via `firestore.ts`, and computes the profile hash (`utils/hash.ts`).
3. **Cache hit** (valid `nextBatch`): serves the pre-generated batch immediately.
4. **Cache miss:** calls **Service (`services/questService.ts`) → `generateBatch`**, which runs the two-pass pipeline via the **`llm/`** layer (scout → Maps `getBestLocation` → distance/transport enrich → writer → generic deficit-fill).
5. The **Controller** clears the consumed cache entry, then **enqueues a Cloud Task** (`pregenerateCuratedBatch`) to build the next batch in the background, and returns the response (with hero-image bytes attached).
6. **`controllers/tasks.ts`** later runs the task off the request path, calling the same Service and saving `nextBatch` — so the next request is instant.

The freeform `generateUserDescribedQuest` follows a similar controller → service path, using the planner + single writer instead of a batch, and is not pre-generated.
