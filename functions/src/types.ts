/**
 * Represents the detailed profile of the user collected during the Guided UI Onboarding.
 * This is sent by the client to the Cloud Functions.
 */

// --------------
// general types:
// --------------

export interface UserProfile {
    interests: string[];
    growthAreas: string[];
    vibe: string[];
    experimentationLevel: number; // e.g., 1 to 5
    budget: string[];
    transportation: string[];
    locationPreferences: string[];
    additionalContext: string | null;
    city: string;
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

export interface LocationInformation {
    name: string;
    address: string;
    description: string;
    latitude: number;
    longitude: number;
    photoURL: string;
    googleMapsURL: string;
}

export interface SidequestItem {
    title: string;
    description: string;
    difficulty: "easy" | "moderate" | "hard" | "extreme";
    estimatedTime: string;
    categories: string[];
    location: LocationInformation | null;
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