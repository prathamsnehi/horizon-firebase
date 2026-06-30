import * as functions from "firebase-functions/v2";
import { SidequestRequest, SidequestResponse } from "../types";
import { generateLocationConcepts, generateSidequestsWriter } from "../integrations/gemini";
import { getRandomLocation } from "../integrations/maps";
import { calculateDistanceMiles, calculateAllTransportOptions } from "../utils/distance";

/**
 * Validates the incoming payload structure.
 */
function validateRequest(data: any): data is SidequestRequest {
    if (!data || typeof data !== "object") return false;
    if (!data.profile || typeof data.profile !== "object") return false;
    if (typeof data.count !== "number") return false;
    if (typeof data.deviceId !== "string") return false;
    return true;
}

/**
 * Core orchestrator for generating sidequests using the Two-Pass Distance-Aware architecture.
 */
export const generateSidequests = functions.https.onCall(async (request) => {
    // 1. Validation & Auth
    if (!validateRequest(request.data)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid request payload.");
    }

    const sidequestReq = request.data as SidequestRequest;
    const { profile, count, deviceId } = sidequestReq;

    // Optional: App Check verification (Uncomment when ready for production)
    // if (request.app?.appId == null) {
    //     throw new functions.https.HttpsError("unauthenticated", "App Check token missing.");
    // }

    try {
        console.log(`[generateSidequests] Starting generation for device: ${deviceId}, count: ${count}`);

        // --- PASS 1: SCOUT (Gemini generates abstract search queries) ---
        console.log(`[generateSidequests] Invoking Pass 1 (Scout)...`);
        const locationConcepts = await generateLocationConcepts(profile, count);
        console.log(`[generateSidequests] Pass 1 generated ${locationConcepts.length} concepts.`);

        if (locationConcepts.length === 0) {
             throw new Error("Pass 1 failed to generate location concepts.");
        }

        // --- STEP 2: LOCATION RESOLUTION (Maps API in parallel) ---
        console.log(`[generateSidequests] Resolving concepts via Google Maps API in parallel...`);
        // TODO: choosing a random location, but implement a mechanism that decides if the randomLocation is called
        // or the topLocation is called from /integrations/maps.ts
        const mapsPromises = locationConcepts.map(concept => getRandomLocation(concept.textQuery));
        const rawMapsResults = await Promise.all(mapsPromises);
        
        // Filter out any failed Maps queries
        const validLocations = rawMapsResults.filter(loc => loc !== null);
        console.log(`[generateSidequests] Maps returned ${validLocations.length} valid locations.`);

        // --- STEP 3: DISTANCE & TRANSPORT MATH (Local Calculation) ---
        console.log(`[generateSidequests] Calculating distance and heuristic travel times...`);
        const enrichedLocations = validLocations.map(loc => {
            // If the user's city coordinates are provided, compute distance.
            // Otherwise, we cannot calculate distance and skip transport options.
            if (profile.cityLatitude != null && profile.cityLongitude != null) {
                const distance = calculateDistanceMiles(
                    profile.cityLatitude,
                    profile.cityLongitude,
                    loc.latitude,
                    loc.longitude
                );
                const transportOpts = calculateAllTransportOptions(distance, profile.transportation);
                return {
                    ...loc,
                    distanceMiles: distance,
                    transportationOptions: transportOpts
                };
            } else {
                return loc; // Passthrough if we lack base coordinates
            }
        });

        // --- PASS 4: WRITER (Gemini writes final sidequests) ---
        console.log(`[generateSidequests] Invoking Pass 2 (Writer)...`);
        const finalSidequests = await generateSidequestsWriter(profile, enrichedLocations);
        console.log(`[generateSidequests] Pass 2 generated ${finalSidequests.length} sidequests.`);

        // Validate we got at least some back
        if (finalSidequests.length === 0) {
            throw new Error("Pass 2 failed to write any sidequests.");
        }

        // --- STEP 5: RETURN ---
        const response: SidequestResponse = { sidequests: finalSidequests };
        return response;

    } catch (error) {
        console.error("[generateSidequests] Fatal error:", error);
        throw new functions.https.HttpsError("internal", "An error occurred while generating sidequests.");
    }
});
