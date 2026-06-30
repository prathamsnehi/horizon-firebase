import * as functions from "firebase-functions/v2";
import { SidequestRequest, SidequestResponse, SidequestItem, SidequestTimings } from "../types";
import { generateLocationConcepts, generateSidequestsWriter, generateGenericSidequests } from "../integrations/gemini";
import { getRandomLocation } from "../integrations/maps";
import { calculateDistanceMiles, calculateAllTransportOptions } from "../utils/distance";
import { geminiApiKey, placesApiKey } from "../config";

/**
 * Module-level flag for cold-start detection. Module scope is evaluated once
 * per container, so the first invocation on a fresh container sees `false`
 * (it paid the boot cost); every warm reuse sees `true`.
 */
let isWarm = false;

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
export const generateSidequests = functions.https.onCall(
    { 
        enforceAppCheck: true, // App Check, only iOS App and Website can access
        secrets: [geminiApiKey, placesApiKey]
    }, 
    async (request) => {
    // 1. Validation & Auth
    if (!validateRequest(request.data)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid request payload.");
    }

    const sidequestReq = request.data as SidequestRequest;
    const { profile, count, deviceId, excludeTitles } = sidequestReq;

    // Stage timing & cold-start capture. Read/flip the warm flag before any
    // await so concurrent invocations on one container still attribute the
    // boot cost to whichever request arrived first.
    const serverStart = Date.now();
    const coldStart = !isWarm;
    isWarm = true;

    try {
        console.log(`[generateSidequests] Starting generation for device: ${deviceId}, count: ${count} (coldStart=${coldStart})`);

        // --- PASS 1: SCOUT (Gemini generates abstract search queries) ---
        console.log(`[generateSidequests] Invoking Pass 1 (Scout)...`);
        const tScout = Date.now();
        const locationConcepts = await generateLocationConcepts(profile, count, excludeTitles || []);
        const scoutMs = Date.now() - tScout;
        console.log(`[generateSidequests] Pass 1 generated ${locationConcepts.length} concepts. (${scoutMs}ms)`);

        if (locationConcepts.length === 0) {
             throw new Error("Pass 1 failed to generate location concepts.");
        }

        // --- STEP 2: LOCATION RESOLUTION (Maps API in parallel) ---
        console.log(`[generateSidequests] Resolving concepts via Google Maps API in parallel...`);
        // TODO: choosing a random location, but implement a mechanism that decides if the randomLocation is called
        // or the topLocation is called from /integrations/maps.ts
        const mapsPromises = locationConcepts.map(concept => getRandomLocation(concept.textQuery));
        const tMaps = Date.now();
        const rawMapsResults = await Promise.all(mapsPromises);
        const mapsMs = Date.now() - tMaps;

        // Filter out any failed Maps queries
        const validLocations = rawMapsResults.filter(loc => loc !== null);
        console.log(`[generateSidequests] Maps returned ${validLocations.length} valid locations. (${mapsMs}ms)`);

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
                // If we lack coordinates, supply generic transportation options with 0 minutes 
                // so Gemini has valid enums to choose from.
                const fallbackModes = profile.transportation.length > 0 ? profile.transportation : ["car" as any];
                const fallbackTransportOpts = fallbackModes.map(mode => ({
                    mode,
                    estimatedTravelMinutes: 0,
                    isRecommended: false
                }));
                return {
                    ...loc,
                    transportationOptions: fallbackTransportOpts
                };
            }
        });

        // --- PASS 4: WRITER (Gemini writes final sidequests) ---
        console.log(`[generateSidequests] Invoking Pass 2 (Writer)...`);
        
        let finalSidequests: SidequestItem[] = [];

        let writerMs = 0;
        if (enrichedLocations.length > 0) {
            const tWriter = Date.now();
            const locationSidequests = await generateSidequestsWriter(profile, enrichedLocations);
            writerMs = Date.now() - tWriter;
            finalSidequests.push(...locationSidequests);
            console.log(`[generateSidequests] Pass 2 generated ${locationSidequests.length} location-based sidequests. (${writerMs}ms)`);
        }

        // --- STEP 4.5: GENERIC FALLBACK (Deficit Filling) ---
        let genericFallbackMs = 0;
        const deficit = count - finalSidequests.length;
        if (deficit > 0) {
            console.log(`[generateSidequests] Deficit of ${deficit} sidequests. Invoking Generic Fallback...`);
            const tGeneric = Date.now();
            const genericSidequests = await generateGenericSidequests(profile, deficit, excludeTitles || []);
            genericFallbackMs = Date.now() - tGeneric;
            finalSidequests.push(...genericSidequests);
            console.log(`[generateSidequests] Fallback generated ${genericSidequests.length} generic sidequests. (${genericFallbackMs}ms)`);
        }

        // Validate we got at least some back
        if (finalSidequests.length === 0) {
            throw new Error("Pass 2 failed to write any sidequests.");
        }

        // --- STEP 5: RETURN ---
        const timings: SidequestTimings = {
            scoutMs,
            mapsMs,
            writerMs,
            genericFallbackMs,
            totalServerMs: Date.now() - serverStart,
            coldStart,
        };
        console.log(`[generateSidequests] Done in ${timings.totalServerMs}ms`, timings);
        const response: SidequestResponse = { sidequests: finalSidequests, timings };
        return response;

    } catch (error) {
        console.error("[generateSidequests] Fatal error:", error);
        throw new functions.https.HttpsError("internal", "An error occurred while generating sidequests.");
    }
});
