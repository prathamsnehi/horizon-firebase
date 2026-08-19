/**
 * De-identification for the `generation_samples` corpus.
 *
 * The corpus is ANONYMOUS by construction: it carries no uid and nothing that
 * could re-link two records to the same person (notably no profile hash, which
 * would be a stable fingerprint wearing a digest's clothing). This module is the
 * single place that decides what survives into a sample — new capture sites
 * should pass user-supplied data through here rather than into a span directly.
 */
import { UserProfile } from "../types";

/** Contact-shaped patterns stripped from user-authored text. */
const SCRUBBERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]"],
  [/\+?\d[\d\s().-]{7,}\d/g, "[phone]"],
  [/https?:\/\/\S+/g, "[url]"],
  [/@[A-Za-z0-9_]{2,}/g, "[handle]"],
];

/**
 * Best-effort removal of obvious identifiers from freeform text. Users can type
 * anything, so this is a floor rather than a guarantee — it exists so the corpus
 * doesn't accumulate contact details, which matters doubly if it is ever used as
 * training data (models memorize verbatim strings).
 */
export function scrubText(text: string): string;
export function scrubText(text: string | undefined): string | undefined;
export function scrubText(text: string | undefined): string | undefined {
  if (!text) return text;
  return SCRUBBERS.reduce((acc, [re, replacement]) => acc.replace(re, replacement), text);
}

/** Coordinate precision retained (~1 km) — the city name carries the signal. */
const COORD_DECIMALS = 2;

function coarsen(n: number | undefined): number | undefined {
  return n == null ? undefined : Number(n.toFixed(COORD_DECIMALS));
}

/**
 * The profile as retained in a sample: the enumerated preference fields that
 * carry the training signal, minus `additionalContext` — unbounded free text
 * with the highest re-identification risk and the least value — and with city
 * coordinates coarsened. `comfortZoneEdges` can hold a user-written edge, so it
 * is scrubbed rather than trusted.
 */
export function sanitizeProfile(profile: UserProfile) {
  return {
    interests: profile.interests,
    comfortZoneEdges: profile.comfortZoneEdges.map((edge) => scrubText(edge)),
    vibe: profile.vibe,
    experimentationLevel: profile.experimentationLevel,
    budget: profile.budget,
    transportation: profile.transportation,
    locationPreferences: profile.locationPreferences,
    city: profile.city,
    cityLatitude: coarsen(profile.cityLatitude),
    cityLongitude: coarsen(profile.cityLongitude),
  };
}
