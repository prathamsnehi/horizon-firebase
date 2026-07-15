import {
  validateDescribePrompt,
  validateProfilePayload,
  validateExcludeTitles,
  isValidPhotoReference,
  MAX_DESCRIBE_PROMPT_CHARS,
} from "../../utils/validation";

const goodProfile = {
  interests: ["Coffee"],
  growthAreas: ["Trying new foods"],
  vibe: ["Chill"],
  experimentationLevel: 3,
  budget: ["Cheap"],
  transportation: ["walking"],
  locationPreferences: ["Neighborhood"],
  city: "Saint Paul",
};

describe("validateDescribePrompt", () => {
  it("accepts a normal prompt", () => {
    expect(validateDescribePrompt("Find me a cozy cafe")).toBeNull();
  });
  it("rejects empty / whitespace-only", () => {
    expect(validateDescribePrompt("")).not.toBeNull();
    expect(validateDescribePrompt("   ")).not.toBeNull();
  });
  it("rejects a non-string", () => {
    expect(validateDescribePrompt(123 as any)).not.toBeNull();
  });
  it("rejects over the length cap", () => {
    expect(
      validateDescribePrompt("x".repeat(MAX_DESCRIBE_PROMPT_CHARS + 1))
    ).not.toBeNull();
  });
  it("accepts exactly the length cap", () => {
    expect(
      validateDescribePrompt("x".repeat(MAX_DESCRIBE_PROMPT_CHARS))
    ).toBeNull();
  });
});

describe("validateProfilePayload", () => {
  it("accepts a valid profile", () => {
    expect(validateProfilePayload(goodProfile)).toBeNull();
  });
  it("rejects a non-object", () => {
    expect(validateProfilePayload(null)).not.toBeNull();
  });
  it("rejects a missing required array", () => {
    const p: any = { ...goodProfile };
    delete p.interests;
    expect(validateProfilePayload(p)).not.toBeNull();
  });
  it("rejects an empty required array", () => {
    expect(validateProfilePayload({ ...goodProfile, vibe: [] })).not.toBeNull();
  });
  it("rejects a non-string array item", () => {
    expect(
      validateProfilePayload({ ...goodProfile, interests: [123] })
    ).not.toBeNull();
  });
  it("rejects a missing city", () => {
    const p: any = { ...goodProfile };
    delete p.city;
    expect(validateProfilePayload(p)).not.toBeNull();
  });
  it("rejects a non-number experimentationLevel", () => {
    expect(
      validateProfilePayload({ ...goodProfile, experimentationLevel: "high" })
    ).not.toBeNull();
  });
  it("rejects too-long additionalContext", () => {
    expect(
      validateProfilePayload({ ...goodProfile, additionalContext: "x".repeat(1000) })
    ).not.toBeNull();
  });
  it("accepts null additionalContext", () => {
    expect(
      validateProfilePayload({ ...goodProfile, additionalContext: null })
    ).toBeNull();
  });
  it("rejects a non-numeric city coordinate", () => {
    expect(
      validateProfilePayload({ ...goodProfile, cityLatitude: "x" })
    ).not.toBeNull();
  });
});

describe("isValidPhotoReference", () => {
  it("accepts a well-formed Places photo name", () => {
    expect(isValidPhotoReference("places/ChIJN1t_abc-123/photos/AUac-Sh_h3Z")).toBe(true);
  });
  it("rejects wrong shape / path traversal / empty", () => {
    expect(isValidPhotoReference("")).toBe(false);
    expect(isValidPhotoReference("places/abc/photos")).toBe(false);
    expect(isValidPhotoReference("places/abc/photos/../../etc")).toBe(false);
    expect(isValidPhotoReference("https://evil.com/x")).toBe(false);
    expect(isValidPhotoReference("places/abc/photos/def/extra")).toBe(false);
  });
});

describe("validateExcludeTitles", () => {
  it("accepts null/undefined", () => {
    expect(validateExcludeTitles(undefined)).toBeNull();
    expect(validateExcludeTitles(null)).toBeNull();
  });
  it("accepts a small string array", () => {
    expect(validateExcludeTitles(["A", "B"])).toBeNull();
  });
  it("rejects a non-array", () => {
    expect(validateExcludeTitles("A" as any)).not.toBeNull();
  });
  it("rejects non-string items", () => {
    expect(validateExcludeTitles([1, 2] as any)).not.toBeNull();
  });
});
