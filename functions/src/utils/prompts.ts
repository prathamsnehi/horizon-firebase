import { UserProfile } from "../types";

/**
 * Builds the prompt for Pass 1 (Scout) to generate location concepts.
 *
 * @param profile - The user's detailed profile
 * @param count - The number of location concepts to generate
 * @returns The formatted prompt string
 */
export function buildLocationConceptsPrompt(
  profile: UserProfile,
  count: number,
  excludeTitles: string[] = [],
): string {
  // Compress profile to reduce tokens
  const interests = profile.interests.join(",") || "None";
  const vibe = profile.vibe.join(",") || "None";
  const locationPreferences = profile.locationPreferences.join(",") || "None";

  return `You are a sharp, well-traveled local in ${profile.city} with genuinely great taste — the kind of person whose recommendations people actually act on. Produce EXACTLY ${count} Google Maps search queries that each resolve to a specific, real, well-regarded place worth going out of your way for.

USER:
Interests: ${interests} | Vibe: ${vibe} | Location Prefs: ${locationPreferences}
City: ${profile.city}

HOW TO CHOOSE (this matters most):
- Quality over novelty. Recommend places you'd genuinely vouch for — not obscure things picked to seem quirky. A great neighborhood spot beats a weird one.
- Go deep, not wide. Do NOT map one interest to one query. Pick 2-3 threads from their interests to center this batch on and explore each from different angles; let the rest sit this round.
- Synthesize interests where you can (e.g. coffee + photography -> "riverside cafe known for the photography prints on its walls").
- Write FINDABLE queries. Each must target a place that exists as a real business/POI with reviews (a specific cafe, studio, trailhead, market, gallery). Avoid abstractions Maps can't resolve ("urban exploration sites", "ghost tour starting points", "rockhounding spots").
- Refrain from padding queries with hollow hype ("best hidden", "authentic", "niche").

VIBE is for tone, not obscurity. A "chaotic/quirky" vibe means lively, playful places — not weird-for-weird's-sake.

EXPERIMENTATION LEVEL (${profile.experimentationLevel}/5) — how far to roam from core interests, WITHOUT lowering the quality bar:
1: Tightly on stated interests.
2: Interests + safe adjacent picks.
3: Mostly core, some tasteful adjacent discoveries.
4: A couple of confident wildcards a friend would insist on — still genuinely good.
5: Half core, half bold discoveries — bold in kind, never in quality.

GEOGRAPHIC SCALING (Assign 'intendedDifficulty'):
- easy/moderate: Local to ${profile.city} (e.g. coffee shop, neighborhood park).
- hard: Neighboring regions/cities (1-3 hrs away).
- extreme: Remote wilderness or out-of-state road trips.

RULES:
- Include the city/region name in every query so Maps searches the correct area.
- Assign 'intendedDifficulty' to match the real geographic scale.
- You may specify a radius of search within the query, but it is not compulsory.
${excludeTitles.length > 0 ? `- IMPORTANT: Do NOT generate location concepts similar to these recently completed sidequests: ${excludeTitles.join(", ")}` : ""}
`;
}

/**
 * Builds the prompt for Pass 2 (Writer) to generate final sidequests.
 *
 * `userIntent` (optional) is the user's freeform "describe a sidequest" request;
 * when present, the sidequest should fulfill it using the provided location(s).
 */
export function buildSidequestWriterPrompt(
  profile: UserProfile,
  mapsResults: any[],
  userIntent?: string,
): string {
  return `Write the final sidequests based on the real locations provided.

USER PROFILE:
Interests: ${profile.interests.join(",")}
Growth Areas: ${profile.growthAreas.join(",")}
${userIntent ? `\nUSER REQUEST: "${userIntent}"\nThe sidequest MUST directly fulfill this request using the location(s) below.\n` : ""}
LOCATIONS:
${JSON.stringify(mapsResults, null, 2)}

RULES:
1. Generate exactly ${mapsResults.length} sidequests.
2. Calculate final difficulty holistically: factor in both physical distance (miles) AND psychological stretch (growth areas).
3. 'estimatedActivityMinutes' must reflect the activity time in minutes. Do NOT include travel time in 'estimatedActivityMinutes'.
4. For each sidequest, provide the 'assignedLocationId' of the location you are writing the sidequest for.
5. Provide the 'recommendedTransportationMode' (must be one of the modes available in that location's transportationOptions).
6. Write a 'locationDescription': a vivid but VERY short summary of the place itself (what it is and why it's worth visiting), based on its name and address. Maximum 1-2 sentences. Describe the PLACE, not the quest.`;
}

/**
 * Builds the Pass-0 (Describe Planner) prompt: decide whether the user's
 * freeform request needs a specific real-world place or can be an at-home /
 * online / abstract activity.
 */
export function buildDescribePlannerPrompt(
  userPrompt: string,
  profile: UserProfile,
): string {
  return `A user described a sidequest they want. Decide how to fulfill it.

USER REQUEST: "${userPrompt}"
City: ${profile.city}

If fulfilling it requires going to a specific real-world place, set mode="location" and provide a Google Maps "textQuery" (a specific, findable place type that includes the city/region).
If it can be done at home, online, or anywhere (no specific venue needed), set mode="generic" and omit textQuery.`;
}

/**
 * Builds the prompt for generating generic, at-home, or location-agnostic sidequests.
 * This is used as a graceful fallback when Maps API fails to resolve locations.
 */
export function buildGenericSidequestWriterPrompt(
  profile: UserProfile,
  count: number,
  excludeTitles: string[] = [],
  userIntent?: string,
): string {
  return `Write exactly ${count} generic, at-home, or location-agnostic sidequests.

USER PROFILE:
Interests: ${profile.interests.join(",")}
Growth Areas: ${profile.growthAreas.join(",")}
Vibe: ${profile.vibe.join(",")}
Context: ${profile.additionalContext || "None"}
${userIntent ? `\nUSER REQUEST: "${userIntent}"\nThe sidequest(s) MUST directly fulfill this request.\n` : ""}
RULES:
1. Generate exactly ${count} sidequests.
2. These quests can involve exploring or traveling, but they MUST be generic (e.g., "find a local cafe", "take a walk in a nearby park") because they will not be tied to a specific Google Maps location. They can also be at-home or online activities.
3. 'estimatedActivityMinutes' must reflect the activity time in minutes.
4. Integrate the user's Interests, Growth Areas, and Vibe to make these highly personalized.
${excludeTitles.length > 0 ? `- IMPORTANT: Do NOT generate quests similar to these recently completed sidequests: ${excludeTitles.join(", ")}` : ""}
`;
}
