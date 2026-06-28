import { defineSecret } from "firebase-functions/params";

// ------------------------------
// Secrets:
// ------------------------------

// pulled directly from GC secrets manager
export const geminiApiKey = defineSecret("GEMINI_API_KEY");
export const placesApiKey = defineSecret("PLACES_API_KEY");

// ------------------------------
// Constants:
// ------------------------------

// How many quests should be generated in a single batch?
export const SIDEQUEST_BATCH_SIZE = 10;

// Maximum number of days a pre-generated batch is valid before it expires (e.g., 7 days)
export const BATCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// The base URL for calling the Places API (New)
export const PLACES_API_BASE_URL = "https://places.googleapis.com/v1/places:searchText";
