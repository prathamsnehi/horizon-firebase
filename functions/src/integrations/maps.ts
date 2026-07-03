import {LocationInformation} from "../types";
import {placesApiKey, PLACES_API_BASE_URL} from "../config";

/**
 * Helper to fetch places from Google Maps API
 */
async function fetchPlaces(queryText: string, maxResults = 10) {
  const response = await fetch(PLACES_API_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": placesApiKey.value(),
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.editorialSummary,places.photos,places.googleMapsUri,places.rating,places.userRatingCount,places.businessStatus",
    },
    body: JSON.stringify({
      textQuery: queryText,
      maxResultCount: maxResults,
    }),
  });

  if (!response.ok) {
    console.error(`Places API Error: ${response.status} ${response.statusText}`);
    return [];
  }

  const data = await response.json();
  return data.places || [];
}

/**
 * Helper to map a raw Google Place object to our LocationInformation type
 */
function mapPlaceToLocation(place: any): LocationInformation {
  let photoURL = "";
  // If the place has photos, grab the first one and construct the media URL
  if (place.photos && place.photos.length > 0) {
    photoURL = `https://places.googleapis.com/v1/${place.photos[0].name}/media?key=${placesApiKey.value()}&maxHeightPx=600`;
  }

  return {
    name: place.displayName?.text || "",
    address: place.formattedAddress || "",
    locationDescription: place.editorialSummary?.text || "",
    latitude: place.location?.latitude || 0,
    longitude: place.location?.longitude || 0,
    googleMapsURL: place.googleMapsUri || "",
    photoURL: photoURL,
  };
}

/**
 * Returns information about the top location based on query text
 */
export async function getTopLocation(queryText: string): Promise<LocationInformation | null> {
  // We only need the very first result for the "top" location
  const places = await fetchPlaces(queryText, 1);

  if (places.length === 0) {
    return null;
  }

  return mapPlaceToLocation(places[0]);
}

/**
 * Returns information for a random location (non-top) based on query text
 */
export async function getRandomLocation(queryText: string): Promise<LocationInformation | null> {
  // Fetch up to 10 places so we have a good pool to pick randomly from
  const places = await fetchPlaces(queryText, 10);

  if (places.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * places.length);
  return mapPlaceToLocation(places[randomIndex]);
}

// Number of top-ranked candidates to randomize among in getBestLocation.
const QUALITY_TOP_POOL = 3;

/**
 * Computes a quality score for a raw Google Place. Rating is weighted by review
 * volume (log-dampened) so a 4.9 with 3 reviews doesn't outrank a 4.6 with
 * thousands, while runaway-popular places don't dominate purely on count.
 * Missing rating/count sink to 0.
 */
function qualityScore(place: any): number {
  const rating = typeof place.rating === "number" ? place.rating : 0;
  const count = typeof place.userRatingCount === "number" ? place.userRatingCount : 0;
  return rating * Math.log10(count + 1);
}

/**
 * Returns a high-quality location for the query. Ranks the result pool by a
 * rating × review-volume score (dropping permanently/temporarily closed
 * places), then picks randomly among the top few candidates rather than always
 * the strict #1 — so users with similar profiles in the same city don't all
 * receive the identical place (and the future global cache stays varied),
 * while keeping quality high. Diversity across a batch already comes from the
 * distinct queries, so we don't need randomness for variety here.
 */
export async function getBestLocation(queryText: string): Promise<LocationInformation | null> {
  const places = await fetchPlaces(queryText, 10);

  const openPlaces = places.filter(
    (p: any) =>
      p.businessStatus !== "CLOSED_PERMANENTLY" &&
      p.businessStatus !== "CLOSED_TEMPORARILY"
  );

  if (openPlaces.length === 0) {
    return null;
  }

  const ranked = openPlaces
    .map((place: any) => ({ place, score: qualityScore(place) }))
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

  const topPool = ranked.slice(0, QUALITY_TOP_POOL);
  const pick = topPool[Math.floor(Math.random() * topPool.length)];
  return mapPlaceToLocation(pick.place);
}
