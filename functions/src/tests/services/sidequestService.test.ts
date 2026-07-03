import { UserProfile, SidequestItem, LocationInformation } from "../../types";

// Mock the LLM layer and Maps so no network/secrets are touched.
jest.mock("../../llm", () => ({
  planDescribedSidequest: jest.fn(),
  generateSidequestsWriter: jest.fn(),
  generateGenericSidequests: jest.fn(),
  generateLocationConcepts: jest.fn(),
}));
jest.mock("../../integrations/maps", () => ({ getBestLocation: jest.fn() }));

import { generateDescribed } from "../../services/sidequestService";
import {
  planDescribedSidequest,
  generateSidequestsWriter,
  generateGenericSidequests,
} from "../../llm";
import { getBestLocation } from "../../integrations/maps";

const profile: UserProfile = {
  interests: ["food"],
  growthAreas: [],
  vibe: ["chill"],
  experimentationLevel: 3,
  budget: ["moderate"],
  transportation: ["walking"],
  locationPreferences: ["neighborhood"],
  additionalContext: null,
  city: "San Francisco",
};

function item(title: string): SidequestItem {
  return {
    title,
    questDescription: "d",
    difficulty: "easy",
    estimatedActivityMinutes: 30,
    categories: [],
  };
}

const loc = {
  name: "Sushi Place",
  address: "1 Main St",
  locationDescription: "",
  latitude: 37.7,
  longitude: -122.4,
  photoURL: "",
  googleMapsURL: "",
} as LocationInformation;

const plan = planDescribedSidequest as jest.Mock;
const writer = generateSidequestsWriter as jest.Mock;
const generic = generateGenericSidequests as jest.Mock;
const maps = getBestLocation as jest.Mock;

describe("generateDescribed", () => {
  beforeEach(() => {
    plan.mockReset();
    writer.mockReset();
    generic.mockReset();
    maps.mockReset();
  });

  it("location mode + Maps resolves → uses the location writer with the user intent", async () => {
    plan.mockResolvedValue({ mode: "location", textQuery: "sushi in SF" });
    maps.mockResolvedValue(loc);
    writer.mockResolvedValue([item("Sushi Quest")]);

    const res = await generateDescribed("I want great sushi", profile);

    expect(res?.title).toBe("Sushi Quest");
    // userIntent is the 4th positional arg to the writer.
    expect(writer.mock.calls[0][3]).toBe("I want great sushi");
    expect(generic).not.toHaveBeenCalled();
  });

  it("location mode but Maps returns null → falls back to generic", async () => {
    plan.mockResolvedValue({ mode: "location", textQuery: "nowhere" });
    maps.mockResolvedValue(null);
    generic.mockResolvedValue([item("At-home Quest")]);

    const res = await generateDescribed("something local", profile);

    expect(res?.title).toBe("At-home Quest");
    expect(writer).not.toHaveBeenCalled();
    expect(generic.mock.calls[0][4]).toBe("something local"); // userIntent
  });

  it("generic mode → never touches Maps", async () => {
    plan.mockResolvedValue({ mode: "generic" });
    generic.mockResolvedValue([item("Journal")]);

    const res = await generateDescribed("help me journal at home", profile);

    expect(res?.title).toBe("Journal");
    expect(maps).not.toHaveBeenCalled();
  });

  it("returns null when generation yields nothing", async () => {
    plan.mockResolvedValue({ mode: "generic" });
    generic.mockResolvedValue([]);

    const res = await generateDescribed("x", profile);
    expect(res).toBeNull();
  });
});
