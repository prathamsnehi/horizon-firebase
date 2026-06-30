/**
 * Represents the detailed profile of the user collected 
 * during the Guided UI Onboarding.
 * This is sent by the client to the Cloud Functions.
 */

// --------------
// general types:
// --------------

export type TransportationMode = "walking" | "publicTransport" | "car" | "bike" | "rideshare";

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
// generateSidequests types:
// -------------------------

export interface SidequestRequest {
    profile: UserProfile;
    count: number;
    excludeTitles: string[];
    deviceId: string;
}

export interface TransportationOption {
    mode: TransportationMode
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
    difficulty: "easy" | "moderate" | "hard" | "extreme";
    estimatedActivityMinutes: number;
    categories: string[];
    
    // Location-Based Properties:
    locationInformation?: LocationInformation;
}

export interface SidequestResponse {
    sidequests: SidequestItem[] | null;
}

// ------------------------------
// generateGetStartedGuide types:
// ------------------------------

export interface GetStartedRequest {
    sidequest: SidequestItem;
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
 * Represents a document in the `pregenerated_batches/{deviceId}` collection.
 */

export interface PregeneratedBatchDocument {
    profileHash: string; // based on user's current preferences. pregen batch invalidates if user preferences change
    sidequests: SidequestItem[];
    createdAt: number; // Unix timestamp in milliseconds for easy TTL/expiration checks
}
