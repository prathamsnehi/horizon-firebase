import {GoogleGenAI} from '@google/genai';
import { geminiApiKey } from "../config";
import { UserProfile, LocationConcept, SidequestItem, LocationInformation } from "../types";
import { buildLocationConceptsPrompt, buildSidequestWriterPrompt } from "../utils/prompts";

let aiClient: GoogleGenAI | null = null;

/**
 * Lazily initializes the Gemini client so it caches across warm invocations,
 * but only accesses the Secret Manager value when actively executing.
 */
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    // This is safe because it only runs when a function is actively executing
    aiClient = new GoogleGenAI({
        apiKey: geminiApiKey.value()
    });
  }
  return aiClient;
}

// Then in your helper functions, just call getAIClient():
export async function generateLocationConcepts(
  profile: UserProfile,
  count: number
): Promise<LocationConcept[]> {
  const ai = getAIClient();
  
  const conceptsSchema = {
    type: "object",
    properties: {
      locationConcepts: {
        type: "array",
        description: `Exactly ${count} diverse location search queries.`,
        items: {
          type: "object",
          properties: {
            textQuery: {
              type: "string",
              description: "A natural language search query for Google Maps Places API."
            },
            intendedDifficulty: {
              type: "string",
              enum: ["easy", "moderate", "hard", "extreme"],
              description: "The intended difficulty/geographic scale of this location."
            }
          },
          required: ["textQuery", "intendedDifficulty"]
        }
      }
    },
    required: ["locationConcepts"]
  };

  const prompt = buildLocationConceptsPrompt(profile, count);

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: conceptsSchema
    }
  });

  if (!response.text) {
      throw new Error("Gemini returned empty text.");
  }

  const parsed = JSON.parse(response.text);
  return parsed.locationConcepts || [];
}

/**
 * Pass 2 (Writer): Generates final sidequests using the rich location data.
 */
export async function generateSidequestsWriter(
  profile: UserProfile,
  locations: LocationInformation[]
): Promise<SidequestItem[]> {
  const ai = getAIClient();

  // Inject IDs to guarantee we map the exact untouched Maps data back later
  const locationsWithIds = locations.map((loc, index) => ({
    id: `loc_${index}`,
    ...loc
  }));

  const writerSchema = {
    type: "object",
    properties: {
      sidequests: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            questDescription: { type: "string" },
            difficulty: { 
              type: "string", 
              enum: ["easy", "moderate", "hard", "extreme"] 
            },
            estimatedActivityMinutes: { 
              type: "integer",
              description: "The time to complete the activity itself in minutes (do NOT include travel time)."
            },
            categories: { 
              type: "array", 
              items: { type: "string" } 
            },
            assignedLocationId: { 
              type: "string",
              description: "The id of the location provided in the prompt that this sidequest is based on."
            },
            recommendedTransportationMode: {
              type: "string",
              enum: ["walking", "publicTransport", "car", "bike", "rideshare"],
              description: "The transportation mode you recommend for this specific sidequest, chosen from the location's available options."
            }
          },
          required: ["title", "questDescription", "difficulty", "estimatedActivityMinutes", "categories", "assignedLocationId", "recommendedTransportationMode"]
        }
      }
    },
    required: ["sidequests"]
  };

  const prompt = buildSidequestWriterPrompt(profile, locationsWithIds);

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: writerSchema
    }
  });

  if (!response.text) {
    throw new Error("Gemini returned empty text.");
  }

  const parsed = JSON.parse(response.text);
  const rawSidequests = parsed.sidequests || [];

  // Re-attach the exact, untouched location data using the assignedLocationId
  const finalSidequests: SidequestItem[] = rawSidequests.map((sq: any) => {
    const originalLocation = locationsWithIds.find(l => l.id === sq.assignedLocationId);
    
    // Create a deep copy of the location without the temporary ID
    let locationInfo: LocationInformation | undefined = undefined;
    if (originalLocation) {
        const { id, ...rest } = originalLocation;
        locationInfo = rest as LocationInformation;
        
        // Apply the recommended mode to the transportationOptions array
        if (locationInfo.transportationOptions) {
            locationInfo.transportationOptions = locationInfo.transportationOptions.map(opt => ({
                ...opt,
                isRecommended: opt.mode === sq.recommendedTransportationMode
            }));
        }
    }

    return {
      title: sq.title,
      questDescription: sq.questDescription,
      difficulty: sq.difficulty,
      estimatedActivityMinutes: sq.estimatedActivityMinutes,
      categories: sq.categories,
      locationInformation: locationInfo
    };
  });

  return finalSidequests;
}
