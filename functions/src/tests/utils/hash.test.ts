import { hashProfile } from "../../utils/hash";
import { UserProfile } from "../../types";

const base: UserProfile = {
  interests: ["coffee", "hiking"],
  growthAreas: ["socializing"],
  vibe: ["chill"],
  experimentationLevel: 3,
  budget: ["free"],
  transportation: ["walking"],
  locationPreferences: ["neighborhood"],
  additionalContext: null,
  city: "San Francisco",
};

describe("hashProfile", () => {
  it("is stable for identical profiles", () => {
    expect(hashProfile(base)).toBe(hashProfile({ ...base }));
  });

  it("is order-independent for array fields", () => {
    const reordered: UserProfile = { ...base, interests: ["hiking", "coffee"] };
    expect(hashProfile(reordered)).toBe(hashProfile(base));
  });

  it("changes when a generation-relevant field changes", () => {
    expect(hashProfile({ ...base, city: "Oakland" })).not.toBe(hashProfile(base));
    expect(hashProfile({ ...base, experimentationLevel: 5 })).not.toBe(
      hashProfile(base)
    );
    expect(hashProfile({ ...base, additionalContext: "new" })).not.toBe(
      hashProfile(base)
    );
  });

  it("ignores city coordinates (they don't affect which quests are generated)", () => {
    const withCoords: UserProfile = {
      ...base,
      cityLatitude: 37.77,
      cityLongitude: -122.42,
    };
    expect(hashProfile(withCoords)).toBe(hashProfile(base));
  });
});
