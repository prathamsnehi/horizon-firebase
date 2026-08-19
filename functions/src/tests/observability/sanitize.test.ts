import { scrubText, sanitizeProfile } from "../../observability/sanitize";
import { UserProfile } from "../../types";

const profile: UserProfile = {
  interests: ["Coffee shops"],
  comfortZoneEdges: ["Talking to strangers"],
  vibe: ["Chill"],
  experimentationLevel: 3,
  budget: ["Cheap"],
  transportation: ["walking"],
  locationPreferences: ["Downtown"],
  additionalContext: "I'm new in town, reach me at sam@example.com",
  city: "Saint Paul",
  cityLatitude: 44.954445,
  cityLongitude: -93.091301,
};

describe("scrubText", () => {
  it("strips emails, phone numbers, urls and handles", () => {
    expect(scrubText("mail me at sam.j+x@example.co.uk")).toBe("mail me at [email]");
    expect(scrubText("call 612-555-0142 after 6")).toBe("call [phone] after 6");
    expect(scrubText("see https://example.com/x?y=1")).toBe("see [url]");
    expect(scrubText("dm @sam_jones ok")).toBe("dm [handle] ok");
  });

  it("leaves ordinary quest text untouched", () => {
    const text = "something with live music tonight, ideally outdoors";
    expect(scrubText(text)).toBe(text);
  });

  it("passes through empty and undefined unchanged", () => {
    expect(scrubText(undefined)).toBeUndefined();
    expect(scrubText("")).toBe("");
  });
});

describe("sanitizeProfile", () => {
  it("drops additionalContext entirely", () => {
    expect(sanitizeProfile(profile)).not.toHaveProperty("additionalContext");
  });

  it("keeps the enumerated preference fields that carry the training signal", () => {
    const out = sanitizeProfile(profile);
    expect(out.interests).toEqual(["Coffee shops"]);
    expect(out.vibe).toEqual(["Chill"]);
    expect(out.budget).toEqual(["Cheap"]);
    expect(out.transportation).toEqual(["walking"]);
    expect(out.locationPreferences).toEqual(["Downtown"]);
    expect(out.experimentationLevel).toBe(3);
    expect(out.city).toBe("Saint Paul");
  });

  it("coarsens city coordinates to ~1km", () => {
    const out = sanitizeProfile(profile);
    expect(out.cityLatitude).toBe(44.95);
    expect(out.cityLongitude).toBe(-93.09);
  });

  it("omits coordinates when the profile has none", () => {
    const { cityLatitude, cityLongitude, ...rest } = profile;
    void cityLatitude;
    void cityLongitude;
    const out = sanitizeProfile(rest as UserProfile);
    expect(out.cityLatitude).toBeUndefined();
    expect(out.cityLongitude).toBeUndefined();
  });

  it("scrubs a user-written comfort-zone edge", () => {
    const out = sanitizeProfile({
      ...profile,
      comfortZoneEdges: ["Messaging @someone first"],
    });
    expect(out.comfortZoneEdges).toEqual(["Messaging [handle] first"]);
  });

  it("carries no field that could re-link two samples to one person", () => {
    const keys = Object.keys(sanitizeProfile(profile));
    for (const forbidden of ["uid", "profileHash", "hash", "deviceId", "additionalContext"]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
