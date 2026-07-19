import {
  UserProfile,
  LocationConcept,
  QuestItem,
  LocationInformation,
  DescribePlan,
} from "../types";
import {
  buildLocationConceptsPrompt,
  buildQuestWriterPrompt,
  buildGenericQuestWriterPrompt,
  buildDescribePlannerPrompt,
} from "../utils/prompts";
import { generateObjectWithRouting } from "./router";
import {
  locationConceptsSchema,
  writerQuestsSchema,
  genericQuestsSchema,
  describePlanSchema,
} from "./schemas";
import { saveLog } from "../integrations/firestore";
import { recordSpan } from "../observability/tracer";
import { RoutingResult } from "./types";

/**
 * Records a PII-free observability log for one routed AI call: which provider/
 * model served, how many attempts, and latency. No profile, prompt, response,
 * or device identifier is stored — this is only for the load/latency dashboard.
 * Best-effort (fire-and-forget inside saveLog).
 */
function logCall(
  stage: "scout" | "writer" | "generic" | "planner",
  result: RoutingResult<unknown>,
): void {
  saveLog({
    stage,
    provider: result.providerUsed,
    model: result.modelUsed,
    attempts: result.attempts,
    latencyMs: result.latencyMs,
    success: true,
    createdAt: Date.now(),
  });
}

/** Routing provider/model/attempts + failover chain, as trace-span meta. */
function routingMeta(
  result: RoutingResult<unknown>,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    provider: result.providerUsed,
    model: result.modelUsed,
    attempts: result.attempts,
    attemptLog: result.attemptLog,
    ...extra,
  };
}

/**
 * Pass 1 (Scout): generate abstract Google Maps search queries.
 */
export async function generateLocationConcepts(
  profile: UserProfile,
  count: number,
  excludeTitles: string[] = [],
): Promise<LocationConcept[]> {
  const prompt = buildLocationConceptsPrompt(profile, count, excludeTitles);
  const result = await generateObjectWithRouting("scout", {
    schema: locationConceptsSchema,
    prompt,
  });
  logCall("scout", result);
  const locationConcepts = result.object.locationConcepts ?? [];
  recordSpan("scout", {
    latencyMs: result.latencyMs,
    input: { prompt, count, excludeTitles },
    output: { locationConcepts },
    meta: routingMeta(result),
  });
  return locationConcepts;
}

/**
 * Pass 2 (Writer): generate final quests using the rich location data.
 * Re-attaches the exact, untouched Maps data by assignedLocationId and marks
 * the recommended transport mode.
 */
export async function generateQuestsWriter(
  profile: UserProfile,
  locations: LocationInformation[],
  userIntent?: string,
): Promise<QuestItem[]> {
  // Inject IDs to guarantee we map the exact untouched Maps data back later.
  const locationsWithIds = locations.map((loc, index) => ({
    id: `loc_${index}`,
    ...loc,
  }));

  const prompt = buildQuestWriterPrompt(profile, locationsWithIds, userIntent);
  const result = await generateObjectWithRouting("writer", {
    schema: writerQuestsSchema,
    prompt,
  });
  logCall("writer", result);
  const rawQuests = result.object.quests ?? [];
  recordSpan("writer", {
    latencyMs: result.latencyMs,
    input: { prompt, locations: locationsWithIds, userIntent },
    output: { quests: rawQuests },
    meta: routingMeta(result),
  });

  return rawQuests.map((sq) => {
    const originalLocation = locationsWithIds.find(
      (l) => l.id === sq.assignedLocationId,
    );

    let locationInfo: LocationInformation | undefined = undefined;
    if (originalLocation) {
      const { id, ...rest } = originalLocation;
      void id;
      locationInfo = rest as LocationInformation;

      // The model writes the short location summary (Maps no longer supplies one)
      locationInfo.locationDescription = sq.locationDescription ?? "";

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
}

/**
 * Generates generic (no-location) quests to fill deficits when Maps fails
 * to resolve enough locations.
 */
export async function generateGenericQuests(
  profile: UserProfile,
  count: number,
  excludeTitles: string[] = [],
  userIntent?: string,
  reason?: string,
): Promise<QuestItem[]> {
  if (count <= 0) return [];

  const prompt = buildGenericQuestWriterPrompt(
    profile,
    count,
    excludeTitles,
    userIntent,
  );
  const result = await generateObjectWithRouting("generic", {
    schema: genericQuestsSchema,
    prompt,
    temperature: 0.8,
  });
  logCall("generic", result);
  const rawQuests = result.object.quests ?? [];
  recordSpan("generic", {
    latencyMs: result.latencyMs,
    input: { prompt, count, excludeTitles, userIntent },
    output: { quests: rawQuests },
    meta: routingMeta(result, reason ? { reason } : undefined),
  });

  return rawQuests.map((sq) => ({
    title: sq.title,
    questDescription: sq.questDescription,
    difficulty: sq.difficulty,
    estimatedActivityMinutes: sq.estimatedActivityMinutes,
    categories: sq.categories,
  }));
}

/**
 * Pass 0 (Describe Planner): decide whether a user's freeform describe request
 * needs a specific real-world place (location) or is location-agnostic (generic).
 * Uses the fast "scout" model class.
 */
export async function planDescribedQuest(
  prompt: string,
  profile: UserProfile,
): Promise<DescribePlan> {
  const plannerPrompt = buildDescribePlannerPrompt(prompt, profile);
  const result = await generateObjectWithRouting("scout", {
    schema: describePlanSchema,
    prompt: plannerPrompt,
  });
  logCall("planner", result);
  recordSpan("planner", {
    latencyMs: result.latencyMs,
    input: { userPrompt: prompt, plannerPrompt },
    output: { plan: result.object },
    meta: routingMeta(result),
  });
  return result.object;
}
