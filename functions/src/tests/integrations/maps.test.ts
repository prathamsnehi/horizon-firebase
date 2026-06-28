import {getTopLocation, getRandomLocation} from "../../integrations/maps";

// Mock the config so we don't try to read real Secret Manager values
jest.mock("../../config", () => ({
  placesApiKey: {
    value: () => "mock-api-key",
  },
  PLACES_API_BASE_URL: "https://places.googleapis.com/v1/places:searchText",
}));

// Mock the global fetch
global.fetch = jest.fn();

describe("Maps Integration", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it("should correctly map a Place to LocationInformation in getTopLocation", async () => {
    const mockApiResponse = {
      places: [
        {
          displayName: {text: "Jay Cooke State Park"},
          formattedAddress: "780 E Hwy 210, Carlton, MN",
          editorialSummary: {text: "Beautiful park"},
          location: {latitude: 46.6, longitude: -92.3},
          googleMapsUri: "https://maps.google.com/?cid=123",
          photos: [{name: "places/123/photos/456"}],
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });

    const result = await getTopLocation("Best hiking spots");

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Jay Cooke State Park");
    expect(result?.address).toBe("780 E Hwy 210, Carlton, MN");
    expect(result?.description).toBe("Beautiful park");
    expect(result?.latitude).toBe(46.6);
    expect(result?.longitude).toBe(-92.3);
    expect(result?.googleMapsURL).toBe("https://maps.google.com/?cid=123");
    expect(result?.photoURL).toBe("https://places.googleapis.com/v1/places/123/photos/456/media?key=mock-api-key&maxHeightPx=600");
  });

  it("should gracefully handle missing optional fields (like photos or descriptions)", async () => {
    const mockApiResponse = {
      places: [
        {
          displayName: {text: "Obscure Park"},
          formattedAddress: "123 Middle of Nowhere",
          location: {latitude: 45.0, longitude: -90.0},
          googleMapsUri: "https://maps.google.com/?cid=abc",
          // Intentionally omitting photos and editorialSummary
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });

    const result = await getTopLocation("Obscure park");

    expect(result).not.toBeNull();
    expect(result?.description).toBe(""); // Should default to empty string
    expect(result?.photoURL).toBe(""); // Should default to empty string
  });

  it("should return null if no places are found", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({places: []}),
    });

    const result = await getTopLocation("Fake place that doesn't exist");
    expect(result).toBeNull();
  });

  it("should return a random location from the fetched pool", async () => {
    const mockApiResponse = {
      places: [
        {displayName: {text: "Place A"}},
        {displayName: {text: "Place B"}},
        {displayName: {text: "Place C"}},
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });

    const result = await getRandomLocation("Some spots");

    expect(result).not.toBeNull();
    expect(["Place A", "Place B", "Place C"]).toContain(result?.name);
  });
});
