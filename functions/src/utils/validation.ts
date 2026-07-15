/**
 * Server-side input validation, run BEFORE any LLM call or rate-limit
 * reservation so malformed input neither costs tokens nor consumes a daily slot.
 * Pure functions returning an error message (surfaced to the client as the
 * `invalid-argument` message text) or `null` when valid.
 */

export const MAX_DESCRIBE_PROMPT_CHARS = 300;
export const MAX_PROFILE_ARRAY_ITEMS = 50;
export const MAX_PROFILE_STRING_CHARS = 120;
export const MAX_ADDITIONAL_CONTEXT_CHARS = 500;
export const MAX_EXCLUDE_TITLES = 100;

// Profile fields that must be present, non-empty string arrays.
const REQUIRED_STRING_ARRAYS = [
  "interests",
  "growthAreas",
  "vibe",
  "budget",
  "transportation",
  "locationPreferences",
] as const;

/**
 * Validate a described-quest prompt. Trims first; rejects empty or over the cap.
 */
export function validateDescribePrompt(prompt: unknown): string | null {
  if (typeof prompt !== "string") return "Prompt must be text.";
  const trimmed = prompt.trim();
  if (trimmed.length === 0) return "Prompt cannot be empty.";
  if (trimmed.length > MAX_DESCRIBE_PROMPT_CHARS) {
    return `Prompt is too long (max ${MAX_DESCRIBE_PROMPT_CHARS} characters).`;
  }
  return null;
}

/**
 * Validate the profile payload: required string arrays present, non-empty, and
 * within item/length caps; city a non-empty string; optional fields well-typed
 * and capped. Returns an error message or null.
 */
export function validateProfilePayload(profile: any): string | null {
  if (!profile || typeof profile !== "object") return "Missing profile.";

  for (const key of REQUIRED_STRING_ARRAYS) {
    const arr = profile[key];
    if (!Array.isArray(arr) || arr.length === 0) {
      return `Profile field "${key}" is required.`;
    }
    if (arr.length > MAX_PROFILE_ARRAY_ITEMS) {
      return `Profile field "${key}" has too many items (max ${MAX_PROFILE_ARRAY_ITEMS}).`;
    }
    for (const item of arr) {
      if (typeof item !== "string" || item.length === 0) {
        return `Profile field "${key}" must contain non-empty text values.`;
      }
      if (item.length > MAX_PROFILE_STRING_CHARS) {
        return `Profile field "${key}" has a value that is too long (max ${MAX_PROFILE_STRING_CHARS} characters).`;
      }
    }
  }

  if (typeof profile.city !== "string" || profile.city.trim().length === 0) {
    return 'Profile field "city" is required.';
  }
  if (profile.city.length > MAX_PROFILE_STRING_CHARS) {
    return `Profile field "city" is too long (max ${MAX_PROFILE_STRING_CHARS} characters).`;
  }

  if (
    typeof profile.experimentationLevel !== "number" ||
    Number.isNaN(profile.experimentationLevel)
  ) {
    return 'Profile field "experimentationLevel" must be a number.';
  }

  if (profile.additionalContext != null) {
    if (typeof profile.additionalContext !== "string") {
      return 'Profile field "additionalContext" must be text.';
    }
    if (profile.additionalContext.length > MAX_ADDITIONAL_CONTEXT_CHARS) {
      return `Profile field "additionalContext" is too long (max ${MAX_ADDITIONAL_CONTEXT_CHARS} characters).`;
    }
  }

  for (const coordKey of ["cityLatitude", "cityLongitude"] as const) {
    const v = profile[coordKey];
    if (v != null && (typeof v !== "number" || !Number.isFinite(v))) {
      return `Profile field "${coordKey}" must be a number.`;
    }
  }

  return null;
}

/**
 * Validates a Google Places photo reference (`name`) shape,
 * e.g. `places/X/photos/Y`. References come from Google's own Places response
 * (never client input), so this is defense-in-depth against a malformed value
 * ever reaching the media URL.
 */
export function isValidPhotoReference(ref: string): boolean {
  return /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(ref);
}

/** Validate the optional `excludeTitles` array. */
export function validateExcludeTitles(excludeTitles: unknown): string | null {
  if (excludeTitles == null) return null;
  if (!Array.isArray(excludeTitles)) return "excludeTitles must be an array.";
  if (excludeTitles.length > MAX_EXCLUDE_TITLES) {
    return `Too many excludeTitles (max ${MAX_EXCLUDE_TITLES}).`;
  }
  for (const t of excludeTitles) {
    if (typeof t !== "string") return "excludeTitles must contain only strings.";
    if (t.length > MAX_PROFILE_STRING_CHARS) return "An excludeTitle is too long.";
  }
  return null;
}
