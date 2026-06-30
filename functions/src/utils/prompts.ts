import { UserProfile } from "../types";

/**
 * Builds the prompt for Pass 1 (Scout) to generate location concepts.
 * 
 * @param profile - The user's detailed profile
 * @param count - The number of location concepts to generate
 * @returns The formatted prompt string
 */
export function buildLocationConceptsPrompt(profile: UserProfile, count: number, excludeTitles: string[] = []): string {
  // Compress profile to reduce tokens
  const interests = profile.interests.join(",") || "None";
  const vibe = profile.vibe.join(",") || "None";
  const locationPreferences = profile.locationPreferences.join(",") || "None";
  
  return `Generate EXACTLY ${count} location search queries for Google Maps Places API.

USER:
Interests: ${interests} | Vibe: ${vibe} | Location Prefs: ${locationPreferences}
City: ${profile.city}

EXPERIMENTATION LEVEL (${profile.experimentationLevel}/5):
1: Strict adherence to interests. No surprises.
2: Safe variations of interests.
3: Balanced mix of interests and related activities.
4: Generate a few wildcard queries outside stated interests.
5: Exactly half MUST strictly align with interests, half MUST completely ignore interests for extreme novelty.
If experimentation level is 5 and count is 1, go for ignoring interests

GEOGRAPHIC SCALING (Assign 'intendedDifficulty'):
- easy/moderate: Local to ${profile.city} (e.g. coffee shop, neighborhood park).
- hard: Neighboring regions/cities (1-3 hrs away).
- extreme: Remote wilderness or out-of-state road trips.

RULES:
- Be creative and specific (e.g. "late night diners in ${profile.city}", "remote cabins in neighboring county").
- Assign 'intendedDifficulty' to match the geographic scale.
- Include the city/region name in the query so Maps searches the correct area.
- You may specify a radius of search within the query, but not a compulsion
- Think out of the box. Do not just use these examples.
${excludeTitles.length > 0 ? `- IMPORTANT: Do NOT generate location concepts that are similar to these recently completed sidequests: ${excludeTitles.join(", ")}` : ""}.
`;
}

/**
 * Builds the prompt for Pass 2 (Writer) to generate final sidequests.
 */
export function buildSidequestWriterPrompt(profile: UserProfile, mapsResults: any[]): string {
  return `Write the final sidequests based on the real locations provided.

USER PROFILE:
Interests: ${profile.interests.join(",")}
Growth Areas: ${profile.growthAreas.join(",")}

LOCATIONS:
${JSON.stringify(mapsResults, null, 2)}

RULES:
1. Generate exactly ${mapsResults.length} sidequests.
2. Calculate final difficulty holistically: factor in both physical distance (miles) AND psychological stretch (growth areas).
3. 'estimatedActivityMinutes' must reflect the activity time in minutes. Do NOT include travel time in 'estimatedActivityMinutes'.
4. For each sidequest, provide the 'assignedLocationId' of the location you are writing the sidequest for.
5. Provide the 'recommendedTransportationMode' (must be one of the modes available in that location's transportationOptions).`;
}

/**
 * Builds the prompt for generating generic, at-home, or location-agnostic sidequests.
 * This is used as a graceful fallback when Maps API fails to resolve locations.
 */
export function buildGenericSidequestWriterPrompt(profile: UserProfile, count: number, excludeTitles: string[] = []): string {
  return `Write exactly ${count} generic, at-home, or location-agnostic sidequests.

USER PROFILE:
Interests: ${profile.interests.join(",")}
Growth Areas: ${profile.growthAreas.join(",")}
Vibe: ${profile.vibe.join(",")}
Context: ${profile.additionalContext || "None"}

RULES:
1. Generate exactly ${count} sidequests.
2. These quests can involve exploring or traveling, but they MUST be generic (e.g., "find a local cafe", "take a walk in a nearby park") because they will not be tied to a specific Google Maps location. They can also be at-home or online activities.
3. 'estimatedActivityMinutes' must reflect the activity time in minutes.
4. Integrate the user's Interests, Growth Areas, and Vibe to make these highly personalized.
${excludeTitles.length > 0 ? `- IMPORTANT: Do NOT generate quests similar to these recently completed sidequests: ${excludeTitles.join(", ")}` : ""}
`;
}
