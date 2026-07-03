import { z } from "zod";

/**
 * Zod schemas for the three AI stages. These are portable across providers via
 * the AI SDK's `generateObject` (which enforces + validates structured output),
 * replacing the hand-written provider-native JSON schemas.
 */

const difficultyEnum = z.enum(["easy", "moderate", "hard", "extreme"]);
const transportModeEnum = z.enum([
  "walking",
  "publicTransport",
  "car",
  "bike",
  "rideshare",
]);

// Pass 1 (Scout): abstract Google Maps search queries.
export const locationConceptsSchema = z.object({
  locationConcepts: z.array(
    z.object({
      textQuery: z.string(),
      intendedDifficulty: difficultyEnum,
    })
  ),
});

// Pass 2 (Writer): final sidequests tied to resolved locations.
export const writerSidequestsSchema = z.object({
  sidequests: z.array(
    z.object({
      title: z.string(),
      questDescription: z.string(),
      difficulty: difficultyEnum,
      estimatedActivityMinutes: z.number().int(),
      categories: z.array(z.string()),
      assignedLocationId: z.string(),
      recommendedTransportationMode: transportModeEnum,
    })
  ),
});

// Pass 0 (Describe Planner): does the user's freeform prompt need a real place?
export const describePlanSchema = z.object({
  mode: z.enum(["location", "generic"]),
  textQuery: z.string().optional(),
});

// Generic fallback: location-agnostic sidequests (no assignedLocationId).
export const genericSidequestsSchema = z.object({
  sidequests: z.array(
    z.object({
      title: z.string(),
      questDescription: z.string(),
      difficulty: difficultyEnum,
      estimatedActivityMinutes: z.number().int(),
      categories: z.array(z.string()),
    })
  ),
});
