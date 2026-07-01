import * as functions from "firebase-functions/v2";
import { SidequestRequest, SidequestResponse, SidequestItem, SidequestTimings } from "../types";
import { generateLocationConcepts, generateSidequestsWriter, generateGenericSidequests, LogContext } from "../llm";
import { getBestLocation } from "../integrations/maps";
import { flushAiCallLogs } from "../integrations/firestore";
import { calculateDistanceMiles, calculateAllTransportOptions } from "../utils/distance";
import { geminiApiKey, placesApiKey, groqApiKey, mistralApiKey, cerebrasApiKey } from "../config";

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
 *
 * This is a Firebase 2nd-gen callable (`onCall`), so all inputs arrive on
 * `request.data` and must satisfy the {@link SidequestRequest} shape (enforced by
 * {@link validateRequest}). App Check is required — only the genuine iOS app and
 * website can invoke it.
 *
 * Expected `request.data` fields:
 * - `profile` ({@link UserProfile}, required) — the user's onboarding profile. Drives
 *   every stage. Notable fields the orchestrator reads directly:
 *     - `interests`, `vibe`, `locationPreferences`, `experimentationLevel` — shape the
 *       Scout (Pass 1) search queries.
 *     - `city` — anchors those queries to the correct geographic area.
 *     - `cityLatitude` / `cityLongitude` (optional) — when BOTH are present, per-location
 *       distance and heuristic travel times are computed (Step 3); when absent, distance
 *       is skipped and transport options fall back to 0-minute placeholders.
 *     - `transportation` — the candidate modes for the travel-time math.
 *     - `growthAreas`, `additionalContext` — feed the Writer (Pass 2) and generic fallback.
 * - `count` (number, required) — how many sidequests to generate. Sets the number of Scout
 *   concepts / parallel Maps calls, and the target the generic fallback fills up to. The web
 *   client currently requests 5.
 * - `deviceId` (string, required) — identifies the requesting device. Used for tagging the
 *   per-call AI logs (`ai_call_logs`); not used for rate-limiting yet.
 * - `excludeTitles` (string[], optional) — titles of recently completed sidequests to avoid
 *   repeating. Passed to both the Scout and the generic fallback. Defaults to [] when omitted.
 *
 * Returns a {@link SidequestResponse}: the generated `sidequests` plus optional per-stage
 * `timings`. Throws `invalid-argument` on a malformed payload and `internal` if generation
 * fails outright (no concepts, or no sidequests written).
 */
export const generateSidequests = functions.https.onCall(
    {
        enforceAppCheck: true, // App Check, only iOS App and Website can access
        secrets: [geminiApiKey, placesApiKey, groqApiKey, mistralApiKey, cerebrasApiKey]
    },
    async (request) => {
    // 1. Validation & Auth
    if (!validateRequest(request.data)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid request payload.");
    }

    const sidequestReq = request.data as SidequestRequest;
    const { profile, count, deviceId, excludeTitles } = sidequestReq;

    // Context passed to each AI task so it can log its call (provider + model +
    // response + input profile) to Firestore. Logs are best-effort and flushed
    // before returning.
    const logCtx: LogContext = { deviceId, profile };

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
        const locationConcepts = await generateLocationConcepts(profile, count, excludeTitles || [], logCtx);
        const scoutMs = Date.now() - tScout;
        console.log(`[generateSidequests] Pass 1 generated ${locationConcepts.length} concepts. (${scoutMs}ms)`);

        if (locationConcepts.length === 0) {
             throw new Error("Pass 1 failed to generate location concepts.");
        }

        // --- STEP 2: LOCATION RESOLUTION (Maps API in parallel) ---
        console.log(`[generateSidequests] Resolving concepts via Google Maps API in parallel...`);
        // Resolve each concept to a high-quality place: ranked by rating × review
        // volume, randomized among the top few for variety (see getBestLocation).
        const mapsPromises = locationConcepts.map(concept => getBestLocation(concept.textQuery));
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
            const locationSidequests = await generateSidequestsWriter(profile, enrichedLocations, logCtx);
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
            const genericSidequests = await generateGenericSidequests(profile, deficit, excludeTitles || [], logCtx);
            genericFallbackMs = Date.now() - tGeneric;
            finalSidequests.push(...genericSidequests);
            console.log(`[generateSidequests] Fallback generated ${genericSidequests.length} generic sidequests. (${genericFallbackMs}ms)`);
        }

        // Validate we got at least some back
        if (finalSidequests.length === 0) {
            throw new Error("Pass 2 failed to write any sidequests.");
        }

        // Ensure best-effort AI-call logs (scout/writer/generic) land before the
        // container can freeze.
        await flushAiCallLogs();

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
