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
  ctx?: LogContext,
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
  ctx?: LogContext,
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
 * Pass 2 (Writer): generate final quests using the rich location data.
 * Re-attaches the exact, untouched Maps data by assignedLocationId and marks
 * the recommended transport mode — unchanged from the original implementation.
 */
export async function generateQuestsWriter(
  profile: UserProfile,
  locations: LocationInformation[],
  ctx?: LogContext,
  userIntent?: string,
): Promise<QuestItem[]> {
  // Inject IDs to guarantee we map the exact untouched Maps data back later.
  const locationsWithIds = locations.map((loc, index) => ({
    id: `loc_${index}`,
    ...loc,
  }));

  const prompt = buildQuestWriterPrompt(
    profile,
    locationsWithIds,
    userIntent,
  );
  const result = await generateObjectWithRouting("writer", {
    schema: writerQuestsSchema,
    prompt,
  });
  const rawQuests = result.object.quests ?? [];

  const finalQuests: QuestItem[] = rawQuests.map((sq) => {
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

  logCall("writer", result, rawQuests, ctx);
  return finalQuests;
}

/**
 * Generates generic (no-location) quests to fill deficits when Maps fails
 * to resolve enough locations.
 */
export async function generateGenericQuests(
  profile: UserProfile,
  count: number,
  excludeTitles: string[] = [],
  ctx?: LogContext,
  userIntent?: string,
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
  const rawQuests = result.object.quests ?? [];

  const finalQuests: QuestItem[] = rawQuests.map((sq) => ({
    title: sq.title,
    questDescription: sq.questDescription,
    difficulty: sq.difficulty,
    estimatedActivityMinutes: sq.estimatedActivityMinutes,
    categories: sq.categories,
  }));

  logCall("generic", result, rawQuests, ctx);
  return finalQuests;
}

/**
 * Pass 0 (Describe Planner): decide whether a user's freeform describe request
 * needs a specific real-world place (location) or is location-agnostic (generic).
 * Uses the fast "scout" model class. Logged under the "scout" stage.
 */
export async function planDescribedQuest(
  prompt: string,
  profile: UserProfile,
  ctx?: LogContext,
): Promise<DescribePlan> {
  const plannerPrompt = buildDescribePlannerPrompt(prompt, profile);
  const result = await generateObjectWithRouting("scout", {
    schema: describePlanSchema,
    prompt: plannerPrompt,
  });
  logCall("scout", result, result.object, ctx);
  return result.object;
}
