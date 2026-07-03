import {getTopLocation, getRandomLocation, getBestLocation} from "../../integrations/maps";

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
    expect(result?.locationDescription).toBe("Beautiful park");
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
    expect(result?.locationDescription).toBe(""); // Should default to empty string
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

  describe("getBestLocation", () => {
    // Force the "pick among top pool" randomness to a deterministic index so we
    // can assert on ranking. 0 -> the top-ranked candidate.
    function mockRandom(value: number) {
      return jest.spyOn(Math, "random").mockReturnValue(value);
    }

    afterEach(() => {
      jest.restoreAllMocks();
    });

    function mockPlaces(places: any[]) {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({places}),
      });
    }

    it("ranks by rating weighted by review volume and returns the strongest place", async () => {
      mockRandom(0); // pick the #1 ranked candidate
      mockPlaces([
        // High rating but almost no reviews — should NOT win.
        {displayName: {text: "New Trap Cafe"}, rating: 4.9, userRatingCount: 3},
        // Slightly lower rating but a huge, trustworthy review base — should win.
        {displayName: {text: "Beloved Institution"}, rating: 4.6, userRatingCount: 2000},
        {displayName: {text: "Mediocre Spot"}, rating: 3.8, userRatingCount: 500},
      ]);

      const result = await getBestLocation("cafes");

      expect(result?.name).toBe("Beloved Institution");
    });

    it("excludes permanently and temporarily closed places even if top-rated", async () => {
      mockRandom(0);
      mockPlaces([
        {displayName: {text: "Great But Gone"}, rating: 4.8, userRatingCount: 5000, businessStatus: "CLOSED_PERMANENTLY"},
        {displayName: {text: "On Vacation"}, rating: 4.7, userRatingCount: 4000, businessStatus: "CLOSED_TEMPORARILY"},
        {displayName: {text: "Open For Business"}, rating: 4.5, userRatingCount: 1000, businessStatus: "OPERATIONAL"},
      ]);

      const result = await getBestLocation("bakeries");

      expect(result?.name).toBe("Open For Business");
    });

    it("only ever returns a place from the top pool, never a low-ranked one", async () => {
      // Five places with strictly descending quality scores. Top pool is 3, so
      // P4/P5 must never surface regardless of the random draw.
      mockPlaces([
        {displayName: {text: "P1"}, rating: 4.9, userRatingCount: 5000},
        {displayName: {text: "P2"}, rating: 4.7, userRatingCount: 4000},
        {displayName: {text: "P3"}, rating: 4.5, userRatingCount: 3000},
        {displayName: {text: "P4"}, rating: 4.2, userRatingCount: 100},
        {displayName: {text: "P5"}, rating: 3.9, userRatingCount: 50},
      ]);

      // Sweep the random draw across the whole [0,1) range.
      for (const r of [0, 0.34, 0.66, 0.99]) {
        mockRandom(r);
        const result = await getBestLocation("parks");
        expect(["P1", "P2", "P3"]).toContain(result?.name);
        expect(["P4", "P5"]).not.toContain(result?.name);
        jest.restoreAllMocks();
      }
    });

    it("treats missing rating/review fields as lowest quality", async () => {
      mockRandom(0);
      mockPlaces([
        {displayName: {text: "Unrated"}}, // no rating/count -> score 0
        {displayName: {text: "Rated"}, rating: 4.0, userRatingCount: 200},
      ]);

      const result = await getBestLocation("shops");

      expect(result?.name).toBe("Rated");
    });

    it("returns null when every candidate is closed", async () => {
      mockPlaces([
        {displayName: {text: "Closed A"}, rating: 4.8, userRatingCount: 900, businessStatus: "CLOSED_PERMANENTLY"},
        {displayName: {text: "Closed B"}, rating: 4.6, userRatingCount: 700, businessStatus: "CLOSED_TEMPORARILY"},
      ]);

      const result = await getBestLocation("nightclubs");

      expect(result).toBeNull();
    });

    it("returns null when the pool is empty", async () => {
      mockPlaces([]);

      const result = await getBestLocation("nonexistent place");

      expect(result).toBeNull();
    });
  });
});
