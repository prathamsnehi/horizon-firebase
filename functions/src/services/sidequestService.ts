import {
  UserProfile,
  SidequestItem,
  LocationInformation,
  TransportationMode,
} from "../types";
import {
  generateLocationConcepts,
  generateSidequestsWriter,
  generateGenericSidequests,
  planDescribedSidequest,
  LogContext,
} from "../llm";
import { getBestLocation } from "../integrations/maps";
import {
  calculateDistanceMiles,
  calculateAllTransportOptions,
} from "../utils/distance";

/** Per-stage timings for a single batch generation (milliseconds). */
export interface BatchStageTimings {
  scoutMs: number;
  mapsMs: number;
  writerMs: number;
  genericFallbackMs: number;
}

export interface GenerateBatchResult {
  sidequests: SidequestItem[];
  stageTimings: BatchStageTimings;
}

/**
 * Attach distance + heuristic transport options to resolved Maps locations.
 * When the profile has city coordinates we compute a real Haversine distance;
 * otherwise we supply 0-minute placeholder options so the Writer still has valid
 * transport enums to choose from.
 */
export function enrichLocations(
  profile: UserProfile,
  locations: LocationInformation[]
): LocationInformation[] {
  return locations.map((loc) => {
    if (profile.cityLatitude != null && profile.cityLongitude != null) {
      const distance = calculateDistanceMiles(
        profile.cityLatitude,
        profile.cityLongitude,
        loc.latitude,
        loc.longitude
      );
      return {
        ...loc,
        distanceMiles: distance,
        transportationOptions: calculateAllTransportOptions(
          distance,
          profile.transportation
        ),
      };
    }

    const fallbackModes: TransportationMode[] =
      profile.transportation.length > 0 ? profile.transportation : ["car"];
    return {
      ...loc,
      transportationOptions: fallbackModes.map((mode) => ({
        mode,
        estimatedTravelMinutes: 0,
        isRecommended: false,
      })),
    };
  });
}

/**
 * Core two-pass, distance-aware batch generator (Scout → Maps → Writer → generic
 * deficit-fill). Provider-agnostic via the llm/ layer. Throws if it can't
 * produce any sidequests. Callers are responsible for flushing AI-call logs.
 */
export async function generateBatch(
  profile: UserProfile,
  count: number,
  excludeTitles: string[] = [],
  logCtx?: LogContext
): Promise<GenerateBatchResult> {
  // --- PASS 1: SCOUT ---
  const tScout = Date.now();
  const locationConcepts = await generateLocationConcepts(
    profile,
    count,
    excludeTitles,
    logCtx
  );
  const scoutMs = Date.now() - tScout;
  if (locationConcepts.length === 0) {
    throw new Error("Pass 1 failed to generate location concepts.");
  }

  // --- STEP 2: LOCATION RESOLUTION (parallel) ---
  const tMaps = Date.now();
  const rawMapsResults = await Promise.all(
    locationConcepts.map((concept) => getBestLocation(concept.textQuery))
  );
  const mapsMs = Date.now() - tMaps;
  const validLocations = rawMapsResults.filter(
    (loc): loc is LocationInformation => loc !== null
  );

  // --- STEP 3: DISTANCE & TRANSPORT MATH ---
  const enrichedLocations = enrichLocations(profile, validLocations);

  // --- PASS 4: WRITER ---
  const finalSidequests: SidequestItem[] = [];
  let writerMs = 0;
  if (enrichedLocations.length > 0) {
    const tWriter = Date.now();
    const locationSidequests = await generateSidequestsWriter(
      profile,
      enrichedLocations,
      logCtx
    );
    writerMs = Date.now() - tWriter;
    finalSidequests.push(...locationSidequests);
  }

  // --- STEP 4.5: GENERIC FALLBACK (deficit filling) ---
  let genericFallbackMs = 0;
  const deficit = count - finalSidequests.length;
  if (deficit > 0) {
    const tGeneric = Date.now();
    const genericSidequests = await generateGenericSidequests(
      profile,
      deficit,
      excludeTitles,
      logCtx
    );
    genericFallbackMs = Date.now() - tGeneric;
    finalSidequests.push(...genericSidequests);
  }

  if (finalSidequests.length === 0) {
    throw new Error("Writer failed to produce any sidequests.");
  }

  return {
    sidequests: finalSidequests,
    stageTimings: { scoutMs, mapsMs, writerMs, genericFallbackMs },
  };
}

/**
 * Generate a single sidequest from a user's freeform description. Plans whether
 * the request needs a real place (→ Maps + location writer) or is location-
 * agnostic (→ generic writer), falling back to generic if Maps can't resolve.
 * Returns null only if generation produced nothing.
 */
export async function generateDescribed(
  prompt: string,
  profile: UserProfile,
  logCtx?: LogContext
): Promise<SidequestItem | null> {
  const plan = await planDescribedSidequest(prompt, profile, logCtx);

  if (plan.mode === "location" && plan.textQuery) {
    const loc = await getBestLocation(plan.textQuery);
    if (loc) {
      const enriched = enrichLocations(profile, [loc]);
      const items = await generateSidequestsWriter(
        profile,
        enriched,
        logCtx,
        prompt
      );
      if (items.length > 0) return items[0];
    }
    // Maps couldn't resolve — fall through to a generic quest.
  }

  const generic = await generateGenericSidequests(
    profile,
    1,
    [],
    logCtx,
    prompt
  );
  return generic[0] ?? null;
}
