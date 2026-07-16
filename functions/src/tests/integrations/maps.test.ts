import {getTopLocation, getRandomLocation, getBestLocation, fetchPlacePhotoBytes} from "../../integrations/maps";

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
    expect(result?.locationDescription).toBe(""); // Maps no longer supplies a summary; the Writer LLM fills it
    expect(result?.latitude).toBe(46.6);
    expect(result?.longitude).toBe(-92.3);
    expect(result?.googleMapsURL).toBe("https://maps.google.com/?cid=123");
    expect(result?.photoReference).toBe("places/123/photos/456");
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
    expect(result?.photoReference).toBe(""); // Should default to empty string
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

  describe("getBestLocation (middle-ground selection over relevance order)", () => {
    // Force the "pick within the top window" randomness to a deterministic index.
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

    function openPlace(text: string) {
      return {displayName: {text}, businessStatus: "OPERATIONAL"};
    }

    it("only picks from the top 5 of Google's relevance order, never below", async () => {
      // 7 open results already in relevance order; the window is the first 5.
      mockPlaces(["P1", "P2", "P3", "P4", "P5", "P6", "P7"].map(openPlace));

      for (const r of [0, 0.34, 0.66, 0.99]) {
        mockRandom(r);
        const result = await getBestLocation("cafes");
        expect(["P1", "P2", "P3", "P4", "P5"]).toContain(result?.name);
        expect(["P6", "P7"]).not.toContain(result?.name);
        jest.restoreAllMocks();
      }
    });

    it("randomizes within the window (random draw maps to index)", async () => {
      mockPlaces(["P1", "P2", "P3", "P4", "P5"].map(openPlace));

      mockRandom(0);
      expect((await getBestLocation("x"))?.name).toBe("P1"); // index 0
      jest.restoreAllMocks();

      mockRandom(0.99);
      expect((await getBestLocation("x"))?.name).toBe("P5"); // floor(0.99*5) = 4
    });

    it("drops closed places before forming the window", async () => {
      // The two highest-relevance results are closed, so the window starts at P3.
      mockPlaces([
        {displayName: {text: "P1"}, businessStatus: "CLOSED_PERMANENTLY"},
        {displayName: {text: "P2"}, businessStatus: "CLOSED_TEMPORARILY"},
        openPlace("P3"), openPlace("P4"), openPlace("P5"),
        openPlace("P6"), openPlace("P7"), openPlace("P8"),
      ]);

      mockRandom(0);
      expect((await getBestLocation("x"))?.name).toBe("P3"); // first open
      jest.restoreAllMocks();

      // Window is the open P3..P7; closed P1/P2 and below-window P8 never appear.
      for (const r of [0, 0.5, 0.99]) {
        mockRandom(r);
        const result = await getBestLocation("x");
        expect(["P3", "P4", "P5", "P6", "P7"]).toContain(result?.name);
        expect(["P1", "P2", "P8"]).not.toContain(result?.name);
        jest.restoreAllMocks();
      }
    });

    it("randomizes across all open results when fewer than the window size", async () => {
      mockPlaces([openPlace("A"), openPlace("B")]);

      mockRandom(0);
      expect((await getBestLocation("x"))?.name).toBe("A");
      jest.restoreAllMocks();
      mockRandom(0.99);
      expect((await getBestLocation("x"))?.name).toBe("B");
    });

    it("returns null when every candidate is closed", async () => {
      mockPlaces([
        {displayName: {text: "Closed A"}, businessStatus: "CLOSED_PERMANENTLY"},
        {displayName: {text: "Closed B"}, businessStatus: "CLOSED_TEMPORARILY"},
      ]);

      expect(await getBestLocation("nightclubs")).toBeNull();
    });

    it("returns null when the pool is empty", async () => {
      mockPlaces([]);

      expect(await getBestLocation("nonexistent place")).toBeNull();
    });
  });

  describe("fetchPlacePhotoBytes", () => {
    const validRef = "places/ChIJ_abc/photos/AUac_xyz";

    it("returns null for an invalid reference without hitting the network", async () => {
      (global.fetch as jest.Mock).mockClear();
      expect(await fetchPlacePhotoBytes("not-a-reference")).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("returns base64 bytes + content type on a successful fetch", async () => {
      const bytes = new TextEncoder().encode("hello");
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: {get: () => "image/png"},
        arrayBuffer: async () => bytes.buffer,
      });

      const result = await fetchPlacePhotoBytes(validRef);

      expect(result).toEqual({
        base64: Buffer.from("hello").toString("base64"),
        contentType: "image/png",
        bytes: 5,
      });
    });

    it("returns null on a non-OK response", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });
      expect(await fetchPlacePhotoBytes(validRef)).toBeNull();
    });
  });
});
