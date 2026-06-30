import { buildLocationConceptsPrompt, buildSidequestWriterPrompt } from "../../utils/prompts";
import { UserProfile, LocationInformation } from "../../types";

describe("prompts utils", () => {
    const mockProfile: UserProfile = {
        interests: ["coffee", "hiking"],
        growthAreas: ["socializing"],
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
            
            expect(prompt).toContain("Generate EXACTLY 5 location search queries");
            expect(prompt).toContain("City: San Francisco");
        });

        it("should compress the profile arrays into comma separated strings", () => {
            const prompt = buildLocationConceptsPrompt(mockProfile, 5);

            expect(prompt).toContain("Interests: coffee,hiking");
            expect(prompt).toContain("Vibe: chill");
            expect(prompt).toContain("Location Prefs: neighborhood");
        });
    });

    describe("buildSidequestWriterPrompt", () => {
        it("should pass the correct number of locations and request sidequests", () => {
            const mockLocations = [
                { id: "loc_0", name: "Philz Coffee", address: "123 Main St" },
                { id: "loc_1", name: "Dolores Park", address: "456 Park Ave" }
            ] as unknown as LocationInformation[]; // Casting as we're testing the stringification

            const prompt = buildSidequestWriterPrompt(mockProfile, mockLocations);

            expect(prompt).toContain("Generate exactly 2 sidequests");
            expect(prompt).toContain("Philz Coffee");
            expect(prompt).toContain("Dolores Park");
        });

        it("should include instructions for assignedLocationId and estimatedActivityMinutes", () => {
            const prompt = buildSidequestWriterPrompt(mockProfile, []);
            
            expect(prompt).toContain("'estimatedActivityMinutes' must reflect the activity time in minutes");
            expect(prompt).toContain("assignedLocationId");
        });
    });
});
