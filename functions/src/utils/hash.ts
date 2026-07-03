import { createHash } from "crypto";
import { UserProfile } from "../types";

/**
 * Stable hash of the generation-relevant parts of a user's profile. Arrays are
 * sorted so order doesn't matter, and only fields that actually influence
 * generation are included. Used to invalidate a pre-generated batch when the
 * user's preferences change.
 *
 * Note: cityLatitude/cityLongitude are intentionally excluded — they affect
 * distance math but not which sidequests are generated; the `city` string change
 * (moving cities) already flips the hash.
 */
export function hashProfile(profile: UserProfile): string {
  const canonical = {
    interests: [...profile.interests].sort(),
    growthAreas: [...profile.growthAreas].sort(),
    vibe: [...profile.vibe].sort(),
    experimentationLevel: profile.experimentationLevel,
    budget: [...profile.budget].sort(),
    transportation: [...profile.transportation].sort(),
    locationPreferences: [...profile.locationPreferences].sort(),
    additionalContext: profile.additionalContext ?? null,
    city: profile.city,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
