import {
  UserProfile,
  QuestItem,
  LocationInformation,
  TransportationMode,
} from "../types";
import {
  generateLocationConcepts,
  generateQuestsWriter,
  generateGenericQuests,
  planDescribedQuest,
} from "../llm";
import { getBestLocation, fetchPlacePhotoBytes } from "../integrations/maps";
import { saveLog } from "../integrations/firestore";
import {
  calculateDistanceMiles,
  calculateAllTransportOptions,
} from "../utils/distance";

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
 * produce any quests.
 */
export async function generateBatch(
  profile: UserProfile,
  count: number,
  excludeTitles: string[] = []
): Promise<QuestItem[]> {
  // --- PASS 1: SCOUT ---
  const locationConcepts = await generateLocationConcepts(
    profile,
    count,
    excludeTitles
  );
  if (locationConcepts.length === 0) {
    throw new Error("Pass 1 failed to generate location concepts.");
  }

  // --- STEP 2: LOCATION RESOLUTION (parallel; latency logged) ---
  const tMaps = Date.now();
  const rawMapsResults = await Promise.all(
    locationConcepts.map((concept) => getBestLocation(concept.textQuery))
  );
  saveLog({ stage: "maps", latencyMs: Date.now() - tMaps, createdAt: Date.now() });
  const validLocations = rawMapsResults.filter(
    (loc): loc is LocationInformation => loc !== null
  );

  // --- STEP 3: DISTANCE & TRANSPORT MATH ---
  const enrichedLocations = enrichLocations(profile, validLocations);

  // --- PASS 4: WRITER ---
  const finalQuests: QuestItem[] = [];
  if (enrichedLocations.length > 0) {
    finalQuests.push(...(await generateQuestsWriter(profile, enrichedLocations)));
  }

  // --- STEP 4.5: GENERIC FALLBACK (deficit filling) ---
  const deficit = count - finalQuests.length;
  if (deficit > 0) {
    finalQuests.push(
      ...(await generateGenericQuests(profile, deficit, excludeTitles))
    );
  }

  if (finalQuests.length === 0) {
    throw new Error("Writer failed to produce any quests.");
  }

  return finalQuests;
}

/**
 * Generate a single quest from a user's freeform description. Plans whether
 * the request needs a real place (→ Maps + location writer) or is location-
 * agnostic (→ generic writer), falling back to generic if Maps can't resolve.
 * Returns null only if generation produced nothing.
 */
export async function generateDescribed(
  prompt: string,
  profile: UserProfile
): Promise<QuestItem | null> {
  const plan = await planDescribedQuest(prompt, profile);

  if (plan.mode === "location" && plan.textQuery) {
    const loc = await getBestLocation(plan.textQuery);
    if (loc) {
      const enriched = enrichLocations(profile, [loc]);
      const items = await generateQuestsWriter(profile, enriched, prompt);
      if (items.length > 0) return items[0];
    }
    // Maps couldn't resolve — fall through to a generic quest.
  }

  const generic = await generateGenericQuests(profile, 1, [], prompt);
  return generic[0] ?? null;
}

/**
 * Embeds hero-image bytes into quests for the RESPONSE only, fetched from each
 * quest's `locationInformation.photoReference`. Returns new objects (originals
 * are left byte-free so the cached/stored versions stay small — Firestore 1MB —
 * and never persist Places imagery). Fetches run in parallel and are best-effort:
 * a place with no reference, or a failed fetch, simply yields a quest with no
 * embedded image (the client falls back to a placeholder). Call this AFTER
 * persisting the batch, on the value being returned to the client.
 */
export async function attachQuestPhotos(
  quests: QuestItem[]
): Promise<QuestItem[]> {
  return Promise.all(
    quests.map(async (quest) => {
      const ref = quest.locationInformation?.photoReference;
      if (!ref) return quest;

      const photo = await fetchPlacePhotoBytes(ref);
      if (!photo) return quest;

      return {
        ...quest,
        locationInformation: {
          ...quest.locationInformation!,
          photoImageBase64: photo.base64,
          photoContentType: photo.contentType,
        },
      };
    })
  );
}
