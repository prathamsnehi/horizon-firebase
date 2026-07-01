import {
  locationConceptsSchema,
  writerSidequestsSchema,
  genericSidequestsSchema,
} from "../../llm/schemas";

describe("locationConceptsSchema", () => {
  it("accepts a valid concepts object", () => {
    const parsed = locationConceptsSchema.parse({
      locationConcepts: [{ textQuery: "coffee in SF", intendedDifficulty: "easy" }],
    });
    expect(parsed.locationConcepts).toHaveLength(1);
  });

  it("rejects an invalid difficulty enum", () => {
    expect(() =>
      locationConceptsSchema.parse({
        locationConcepts: [{ textQuery: "x", intendedDifficulty: "trivial" }],
      })
    ).toThrow();
  });
});

describe("writerSidequestsSchema", () => {
  const valid = {
    sidequests: [
      {
        title: "T",
        questDescription: "D",
        difficulty: "moderate",
        estimatedActivityMinutes: 60,
        categories: ["food"],
        assignedLocationId: "loc_0",
        recommendedTransportationMode: "walking",
      },
    ],
  };

  it("accepts a valid writer object", () => {
    expect(writerSidequestsSchema.parse(valid).sidequests[0].title).toBe("T");
  });

  it("rejects a non-integer estimatedActivityMinutes", () => {
    const bad = {
      sidequests: [{ ...valid.sidequests[0], estimatedActivityMinutes: 12.5 }],
    };
    expect(() => writerSidequestsSchema.parse(bad)).toThrow();
  });

  it("rejects an out-of-enum transport mode", () => {
    const bad = {
      sidequests: [
        { ...valid.sidequests[0], recommendedTransportationMode: "teleport" },
      ],
    };
    expect(() => writerSidequestsSchema.parse(bad)).toThrow();
  });
});

describe("genericSidequestsSchema", () => {
  it("accepts a location-agnostic quest (no assignedLocationId)", () => {
    const parsed = genericSidequestsSchema.parse({
      sidequests: [
        {
          title: "T",
          questDescription: "D",
          difficulty: "easy",
          estimatedActivityMinutes: 30,
          categories: ["home"],
        },
      ],
    });
    expect(parsed.sidequests).toHaveLength(1);
  });
});
