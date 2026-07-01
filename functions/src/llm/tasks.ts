import {
  UserProfile,
  LocationConcept,
  SidequestItem,
  LocationInformation,
} from "../types";
import {
  buildLocationConceptsPrompt,
  buildSidequestWriterPrompt,
  buildGenericSidequestWriterPrompt,
} from "../utils/prompts";
import { generateObjectWithRouting } from "./router";
import {
  locationConceptsSchema,
  writerSidequestsSchema,
  genericSidequestsSchema,
} from "./schemas";
import { saveAiCallLog } from "../integrations/firestore";
import { RoutingResult } from "./types";

/**
 * Context needed to persist an AI-call log. Carries the full input profile so
 * logs capture exactly what drove each output (debugging). Optional on each task
 * so callers that don't want logging (e.g. tests) can skip it.
 */
export interface LogContext {
  deviceId: string;
  profile: UserProfile;
}

function logCall(
  stage: "scout" | "writer" | "generic",
  result: RoutingResult<unknown>,
  response: unknown,
  ctx?: LogContext
): void {
  if (!ctx) return;
  saveAiCallLog({
    stage,
    provider: result.providerUsed,
    model: result.modelUsed,
    attempts: result.attempts,
    latencyMs: result.latencyMs,
    success: true,
    deviceId: ctx.deviceId,
    city: ctx.profile.city,
    profile: ctx.profile,
    response,
    createdAt: Date.now(),
  });
}

/**
 * Pass 1 (Scout): generate abstract Google Maps search queries.
 */
export async function generateLocationConcepts(
  profile: UserProfile,
  count: number,
  excludeTitles: string[] = [],
  ctx?: LogContext
): Promise<LocationConcept[]> {
  const prompt = buildLocationConceptsPrompt(profile, count, excludeTitles);
  const result = await generateObjectWithRouting("scout", {
    schema: locationConceptsSchema,
    prompt,
  });
  const concepts = result.object.locationConcepts ?? [];
  logCall("scout", result, concepts, ctx);
  return concepts;
}

/**
 * Pass 2 (Writer): generate final sidequests using the rich location data.
 * Re-attaches the exact, untouched Maps data by assignedLocationId and marks
 * the recommended transport mode — unchanged from the original implementation.
 */
export async function generateSidequestsWriter(
  profile: UserProfile,
  locations: LocationInformation[],
  ctx?: LogContext
): Promise<SidequestItem[]> {
  // Inject IDs to guarantee we map the exact untouched Maps data back later.
  const locationsWithIds = locations.map((loc, index) => ({
    id: `loc_${index}`,
    ...loc,
  }));

  const prompt = buildSidequestWriterPrompt(profile, locationsWithIds);
  const result = await generateObjectWithRouting("writer", {
    schema: writerSidequestsSchema,
    prompt,
  });
  const rawSidequests = result.object.sidequests ?? [];

  const finalSidequests: SidequestItem[] = rawSidequests.map((sq) => {
    const originalLocation = locationsWithIds.find(
      (l) => l.id === sq.assignedLocationId
    );

    let locationInfo: LocationInformation | undefined = undefined;
    if (originalLocation) {
      const { id, ...rest } = originalLocation;
      void id;
      locationInfo = rest as LocationInformation;

      // Apply the recommended mode to the transportationOptions array.
      if (locationInfo.transportationOptions) {
        locationInfo.transportationOptions =
          locationInfo.transportationOptions.map((opt) => ({
            ...opt,
            isRecommended: opt.mode === sq.recommendedTransportationMode,
          }));
      }
    }

    return {
      title: sq.title,
      questDescription: sq.questDescription,
      difficulty: sq.difficulty,
      estimatedActivityMinutes: sq.estimatedActivityMinutes,
      categories: sq.categories,
      locationInformation: locationInfo,
    };
  });

  logCall("writer", result, rawSidequests, ctx);
  return finalSidequests;
}

/**
 * Generates generic (no-location) sidequests to fill deficits when Maps fails
 * to resolve enough locations.
 */
export async function generateGenericSidequests(
  profile: UserProfile,
  count: number,
  excludeTitles: string[] = [],
  ctx?: LogContext
): Promise<SidequestItem[]> {
  if (count <= 0) return [];

  const prompt = buildGenericSidequestWriterPrompt(profile, count, excludeTitles);
  const result = await generateObjectWithRouting("generic", {
    schema: genericSidequestsSchema,
    prompt,
    temperature: 0.8,
  });
  const rawSidequests = result.object.sidequests ?? [];

  const finalSidequests: SidequestItem[] = rawSidequests.map((sq) => ({
    title: sq.title,
    questDescription: sq.questDescription,
    difficulty: sq.difficulty,
    estimatedActivityMinutes: sq.estimatedActivityMinutes,
    categories: sq.categories,
  }));

  logCall("generic", result, rawSidequests, ctx);
  return finalSidequests;
}
