/**
 * Represents the detailed profile of the user collected
 * during the Guided UI Onboarding.
 * This is sent by the client to the Cloud Functions.
 */

// --------------
// general types:
// --------------

export type TransportationMode =
  | "walking"
  | "publicTransport"
  | "car"
  | "bike"
  | "rideshare";

export interface UserProfile {
  interests: string[];
  growthAreas: string[];
  vibe: string[];
  experimentationLevel: number; // e.g., 1 to 5
  budget: string[];
  transportation: TransportationMode[];
  locationPreferences: string[];
  additionalContext: string | null;
  city: string;
  cityLatitude?: number;
  cityLongitude?: number;
}

// -------------------------
// generateCuratedQuests types:
// -------------------------

/**
 * Request for the curated daily batch. Count is server-controlled
 * (CURATED_BATCH_SIZE), so the client does not send it.
 */
export interface CuratedQuestRequest {
  profile: UserProfile;
  excludeTitles?: string[];
}

// -------------------------
// generateUserDescribedQuest types:
// -------------------------

/**
 * Request for a single, freeform user-described quest.
 */
export interface DescribedQuestRequest {
  prompt: string;
  profile: UserProfile;
}

export interface DescribedQuestResponse {
  quest: QuestItem | null;
}

/**
 * Pass-0 (Planner) output for the describe flow: decide whether the user's
 * prompt implies a real place (location) or an at-home / abstract quest (generic).
 */
export interface DescribePlan {
  mode: "location" | "generic";
  textQuery?: string; // Google Maps query when mode === "location"
}

export interface TransportationOption {
  mode: TransportationMode;
  estimatedTravelMinutes: number;
  isRecommended: boolean;
}

export interface LocationInformation {
  name: string;
  address: string;
  locationDescription: string;
  latitude: number;
  longitude: number;
  photoReference: string; // queryable google maps photo identifier
  googleMapsURL: string;
  distanceMiles?: number;
  transportationOptions?: TransportationOption[];
  photoImageBase64?: string; // gmaps photo identifier -> image -> base64, attached just before returning Quest
  photoContentType?: string; // content type of the base64 image (image/jpeg, image/png, etc)
}

export interface QuestItem {
  title: string;
  questDescription: string;
  difficulty: "easy" | "moderate" | "hard" | "extreme";
  estimatedActivityMinutes: number;
  categories: string[];

  // Location-Based Properties:
  locationInformation?: LocationInformation;
}

export interface QuestResponse {
  quests: QuestItem[] | null;
}

// ------------------------------
// generateGetStartedGuide types:
// ------------------------------

export interface GetStartedRequest {
  quest: QuestItem;
  profile: UserProfile;
}

export interface GetStartedResponse {
  steps: string[];
}

// ------------------------------
// Gemini Orchestration Types (Two-Pass Architecture)
// ------------------------------

/**
 * Represents a single search query intended for Google Maps
 */
export interface LocationConcept {
  textQuery: string;
  intendedDifficulty: "easy" | "moderate" | "hard" | "extreme";
}

/**
 * The expected JSON structure returned by Gemini in Pass 1 (Scout)
 */
export interface LocationConceptsResponse {
  locationConcepts: LocationConcept[];
}

// ------------------------------
// Firestore Document Schemas:
// ------------------------------

/**
 * Represents a document in the `pregen_cache/{uid}` collection — an ephemeral,
 * regenerable cache holding the next pre-generated curated batch for a user. NOT
 * a durable store of user data: the batch is written by the background pre-gen
 * task, served instantly on the next request, then cleared.
 */
export interface PregenCacheDocument {
  uid: string;
  nextBatch?: QuestItem[];
  nextBatchHash?: string; // profileHash of nextBatch (invalidates on profile change)
  nextBatchCreatedAt?: number; // Unix ms, for TTL validation
}

/**
 * Payload enqueued to the Cloud Task that pre-generates the next curated batch.
 */
export interface PregenTaskPayload {
  uid: string;
  profile: UserProfile;
}

/**
 * Represents a document in the `logs` collection. PII-free observability record
 * for a single generation-pipeline stage: its latency, plus (for AI stages)
 * which provider/model served it. The raw substrate for the load/latency
 * dashboard. Intentionally stores NO profile, prompt, response, or device id.
 */
export interface LogDocument {
  stage: "scout" | "maps" | "writer" | "generic" | "planner";
  latencyMs: number; // wall-clock of the stage
  createdAt: number; // Unix timestamp in milliseconds
  // AI stages only:
  provider?: string; // e.g. "gemini", "groq"
  model?: string; // e.g. "gemini-3.5-flash"
  attempts?: number; // how many candidates were tried before success
  success?: boolean;
}

// ------------------------------
// Global rate-limiting (Firestore multi-window limiter):
// ------------------------------

export type RateWindowKind = "rps" | "rpm" | "rpd" | "tpm" | "tpd" | "monthly";

/**
 * "bucket" — smoothing token bucket (good for per-minute limits).
 * "fixed"  — fixed-window counter that resets after `windowMs` (good for hard
 *            daily/monthly caps, which don't refill gradually).
 */
export type RateWindowStrategy = "bucket" | "fixed";

export interface RateWindowConfig {
  kind: RateWindowKind;
  limit: number;
  windowMs: number;
  strategy: RateWindowStrategy;
}

export interface BucketWindowState {
  tokens: number;
  lastRefillMs: number;
}

export interface FixedWindowState {
  count: number;
  windowStartMs: number;
}

export type RateWindowState = BucketWindowState | FixedWindowState;

/** A provider's rate state, keyed by window kind (e.g. { rpm: {...}, rpd: {...} }). */
export type ProviderRateState = Record<string, RateWindowState>;
