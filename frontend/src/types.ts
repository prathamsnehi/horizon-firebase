/**
 * Types mirrored from the Cloud Functions backend (functions/src/types.ts)
 * plus web-only view models. The web client talks to `generateSidequests`
 * and must match the ACTUAL function contract, not the older API docs.
 */

// ---- Shared enums (match functions/src/types.ts) ----

export type TransportationMode =
  | "walking"
  | "publicTransport"
  | "car"
  | "bike"
  | "rideshare";

export type Difficulty = "easy" | "moderate" | "hard" | "extreme";

// ---- Profile sent to the backend ----

export interface UserProfile {
  interests: string[];
  growthAreas: string[];
  vibe: string[];
  experimentationLevel: number; // 1..5
  budget: string[];
  transportation: TransportationMode[];
  locationPreferences: string[];
  additionalContext: string | null;
  city: string;
  cityLatitude?: number;
  cityLongitude?: number;
}

// ---- Request / response shapes (match controllers/sidequests.ts) ----

export interface SidequestRequest {
  profile: UserProfile;
  count: number;
  excludeTitles: string[];
  deviceId: string;
}

export interface TransportationOption {
  mode: TransportationMode;
  estimatedTravelMinutes: number;
  isRecommended: boolean;
}

export interface LocationInformation {
  name: string;
  address: string;
  description: string;
  latitude: number;
  longitude: number;
  photoURL: string;
  googleMapsURL: string;
  distanceMiles?: number;
  transportationOptions?: TransportationOption[];
}

export interface SidequestItem {
  title: string;
  questDescription: string;
  difficulty: Difficulty;
  estimatedActivityMinutes: number;
  categories: string[];
  locationInformation?: LocationInformation;
}

/** Per-stage server timings (ms), mirrored from functions/src/types.ts. */
export interface SidequestTimings {
  scoutMs: number;
  mapsMs: number;
  writerMs: number;
  genericFallbackMs: number;
  totalServerMs: number;
  coldStart: boolean;
}

export interface SidequestResponse {
  sidequests: SidequestItem[] | null;
  timings?: SidequestTimings;
}

// ---- Web-only view models (the iOS app's SwiftData equivalent) ----

export type SidequestStatus = "available" | "skipped" | "active" | "completed";

/** A sidequest as stored locally in the browser, extending the backend item. */
export interface Quest extends SidequestItem {
  id: string;
  createdAt: number;
  batchId: string;
  status: SidequestStatus;
  /** Stable placeholder image index for non-location quests. */
  placeholderIndex: number;
  // Get Started guide (mocked client-side, cached after first generation)
  getStartedSteps?: string[];
  // Completion data
  completedAt?: number;
  journalEntry?: string;
  /** IndexedDB keys for completion photos. */
  photoIds: string[];
}

/** Onboarding draft persisted as the user progresses through steps. */
export interface ProfileDraft extends Partial<UserProfile> {}
