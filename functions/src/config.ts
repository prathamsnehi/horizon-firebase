import {defineSecret} from "firebase-functions/params";

// ------------------------------
// Secrets:
// ------------------------------

// pulled directly from GC secrets manager
export const geminiApiKey = defineSecret("GEMINI_API_KEY");
export const placesApiKey = defineSecret("PLACES_API_KEY");

// Additional LLM providers for the multi-provider routing layer (all free-tier).
export const groqApiKey = defineSecret("GROQ_API_KEY");
export const mistralApiKey = defineSecret("MISTRAL_API_KEY");
export const cerebrasApiKey = defineSecret("CEREBRAS_API_KEY");

// ------------------------------
// Constants:
// ------------------------------

// How many quests a curated batch contains (server-controlled).
export const CURATED_BATCH_SIZE = 3;

// Maximum age of a pre-generated batch before it's considered stale (7 days).
export const BATCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// The base URL for calling the Places API (New)
export const PLACES_API_BASE_URL = "https://places.googleapis.com/v1/places:searchText";

// ------------------------------
// Cloud Tasks (background pre-generation):
// ------------------------------

// Region the functions are deployed to; the task queue must match. Default 2nd-gen region.
export const FUNCTIONS_REGION = "us-central1";

// The onTaskDispatched function name that generates the next batch in the background.
export const PREGEN_TASK_NAME = "pregenerateCuratedBatch";
