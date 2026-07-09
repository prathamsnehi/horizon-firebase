# Horizon Backend Implementation Roadmap

Here is a logical roadmap to build out the Horizon backend, ordered from the foundational setup up to the most complex orchestration. This approach allows you to test and verify each piece in isolation before moving on to the next.

### Phase 1: Foundation & Keys

Before writing logic, get your environment and external APIs ready.

1. **Initialize Firebase & Firestore:** Run `firebase init` in your project if you haven't, ensuring you select Functions (TypeScript, 2nd Gen) and Firestore. ✅
2. **Provision Gemini:** Get a Gemini API key from Google AI Studio or Google Cloud Vertex AI. ✅
3. **Provision Google Maps:** Enable the **Places API (New)** in Google Cloud Console. Restrict the API key to just the Places API.✅
4. **Set Up Secret Manager:** Add your `GEMINI_API_KEY` to Google Cloud Secret Manager (Firebase 2nd Gen functions integrate well with this). You can also store your `PLACES_API_KEY` securely here or in a `.env` file for local development.✅
5. **Install Dependencies:** Inside the `functions` folder, run `npm install @google/generative-ai` to get the Gemini SDK.✅

### Phase 2: Types & Configuration

Define the data contracts first so TypeScript can guide your implementation.

1. **Define API Contracts (types.ts):** Translate the JSON shapes from `api-contracts.md` into TypeScript `interfaces`. Create types for the detailed `UserProfile`, the quest object, and the quest generation request/response. ✅
2. **Define Firestore Schema:** Create a type for the `pregenerated_batches` document so you get type safety when reading/writing to the cache. ✅
3. **Setup Config (config.ts):** Export constants for your Secret names and any tuning parameters (like the 7-day expiration time, or the Maps API endpoint URL).✅

### Phase 3: External API Helpers

Build the wrappers for Gemini and Google Maps in isolation. Test these locally using simple node scripts before wiring them into Firebase.

1. **Google Maps Helper (maps.ts):**
   - Write a function that takes a text query (e.g. "State parks in Wisconsin") and uses `fetch` to call the `places:searchText` endpoint. ✅
   - Implement the URL construction logic that takes the `photos[].name` resource identifier and builds the final `photoURL` for the client. ✅
2. **Gemini Helper (gemini.ts):**
   - Initialize the `GoogleGenerativeAI` client.
   - Create a helper for `generateGetStartedGuide`.
   - Create the core `generateQuests` helper. This is the hardest part: configure Gemini to use **Structured Output** (or function calling) to return an array of 10 quests, optionally including a text query string if a quest needs a location.

### Phase 4: The Simple Cloud Functions

Wire up the endpoints that don't rely on Firestore or complex orchestration.

1. **generateGetStartedGuide:** Create this Firebase HTTPS callable function. It should simply take the request, pass it to your Gemini helper, and return the steps.

### Phase 5: The Pre-Generation Engine

This is the most complex endpoint (`generateQuests`), combining Gemini, Maps, and Firestore.

1. **Build the Orchestrator (Two-Pass Architecture):** Write a private function that executes the full orchestration:
   - **Pass 1 (Scout):** Call the Gemini helper to generate 10 location concepts or search queries based on the user profile.
   - **Location Fetch:** Use `Promise.all()` to call your Maps helper in _parallel_ for the concepts, fetching Pro-tier location details (name, address, coordinates, photo). The place summary is written later by the Writer LLM, not fetched from Maps.
   - **Pass 2 (Writer):** Feed the rich location objects back to Gemini to generate the final, highly-tailored quests.
   - Merge the Maps `photoURL` and coordinates back into the final quest objects.
2. **Implement Profile Hashing:** Write a small utility function to generate a stable string hash from the user's `UserProfile` (interests, growthAreas, vibe, experimentationLevel, budget, transportation, locationPreferences, additionalContext, city).
3. **Implement the Cache Check:** In the `generateQuests` callable function, write the logic to read `pregenerated_batches/{deviceId}` from Firestore. Compare the stored `profileHash` with the current one.
4. **Implement the Background Job:** Use Firebase's ability to run code after returning a response (in Node.js, you can start a Promise and return the HTTP response without awaiting it, though Firebase provides specific background task patterns as well). After serving the batch, asynchronously call your orchestrator to build the _next_ batch, and write it to Firestore.

### Phase 6: Security & Polish

1. **App Check Verification:** Enforce Firebase App Check in the Firebase Console for your functions to reject unauthorized traffic.
2. **Rate Limiting (Optional for v1):** Add simple in-memory or Firestore-backed rate limiting if you want to strictly enforce the limits mentioned in the docs.
3. **Deploy:** Run `firebase deploy --only functions,firestore` to push everything to production and test it live with your client app.
