import { buildLocationConceptsPrompt, buildQuestWriterPrompt, buildGenericQuestWriterPrompt } from "../../utils/prompts";
import { UserProfile, LocationInformation } from "../../types";

describe("prompts utils", () => {
    const mockProfile: UserProfile = {
        interests: ["coffee", "hiking"],
        comfortZoneEdges: ["Talking to strangers"],
        vibe: ["chill"],
        experimentationLevel: 3,
        budget: ["free"],
        transportation: ["walking"],
        locationPreferences: ["neighborhood"],
        additionalContext: "Looking to relax",
        city: "San Francisco"
    };

    describe("buildLocationConceptsPrompt", () => {
        it("should include the city and correct count in the prompt", () => {
            const prompt = buildLocationConceptsPrompt(mockProfile, 5);
            
            expect(prompt).toContain("Produce EXACTLY 5 Google Maps search queries");
            expect(prompt).toContain("City: San Francisco");
        });

        it("should compress the profile arrays into comma separated strings", () => {
            const prompt = buildLocationConceptsPrompt(mockProfile, 5);

            expect(prompt).toContain("Interests (flavor / where): coffee,hiking");
            expect(prompt).toContain("Vibe (tone): chill");
            expect(prompt).toContain("Location prefs: neighborhood");
        });

        it("should center the user's comfort-zone edges", () => {
            const prompt = buildLocationConceptsPrompt(mockProfile, 5);

            expect(prompt).toContain("COMFORT-ZONE EDGES (target these): Talking to strangers");
        });
    });

    describe("buildQuestWriterPrompt", () => {
        it("should pass the correct number of locations and request quests", () => {
            const mockLocations = [
                { id: "loc_0", name: "Philz Coffee", address: "123 Main St" },
                { id: "loc_1", name: "Dolores Park", address: "456 Park Ave" }
            ] as unknown as LocationInformation[]; // Casting as we're testing the stringification

            const prompt = buildQuestWriterPrompt(mockProfile, mockLocations);

            expect(prompt).toContain("Generate exactly 2 quests");
            expect(prompt).toContain("Philz Coffee");
            expect(prompt).toContain("Dolores Park");
        });

        it("should include instructions for assignedLocationId and estimatedActivityMinutes", () => {
            const prompt = buildQuestWriterPrompt(mockProfile, []);

            expect(prompt).toContain("'estimatedActivityMinutes' must reflect the activity time in minutes");
            expect(prompt).toContain("assignedLocationId");
        });

        it("should provide the edges and ask for a verbatim pushesComfortZoneEdges echo", () => {
            const prompt = buildQuestWriterPrompt(mockProfile, []);

            expect(prompt).toContain("Talking to strangers");
            expect(prompt).toContain("pushesComfortZoneEdges");
            expect(prompt).toContain("VERBATIM");
        });
    });

    describe("buildGenericQuestWriterPrompt", () => {
        it("should request the correct number of generic quests", () => {
            const prompt = buildGenericQuestWriterPrompt(mockProfile, 3);
            expect(prompt).toContain("Write exactly 3 generic");
            expect(prompt).toContain("Generate exactly 3 quests");
        });

        it("should instruct the AI to make quests generic since they lack specific locations", () => {
            const prompt = buildGenericQuestWriterPrompt(mockProfile, 3);
            expect(prompt).toContain("MUST be generic");
            expect(prompt).toContain("not be tied to a specific Google Maps location");
            expect(prompt).toContain("Interests: coffee,hiking");
            expect(prompt).toContain("Vibe: chill");
        });

        it("should include excludeTitles rule when provided", () => {
            const prompt = buildGenericQuestWriterPrompt(mockProfile, 1, ["Making Coffee", "Journaling"]);
            expect(prompt).toContain("Making Coffee, Journaling");
            expect(prompt).toContain("Do NOT generate quests similar");
        });
    });
});
