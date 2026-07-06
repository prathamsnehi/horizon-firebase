import { LocationInformation } from "../types";
import { placesApiKey, PLACES_API_BASE_URL } from "../config";

/**
 * Helper to fetch places from Google Maps API
 */
async function fetchPlaces(queryText: string, maxResults = 10) {
  const response = await fetch(PLACES_API_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": placesApiKey.value(),
      // Fields received puts the project's Maps API in the Pro SKU Tier (~5k/mo free)
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.location,places.photos,places.googleMapsUri,places.businessStatus",
    },
    body: JSON.stringify({
      textQuery: queryText,
      maxResultCount: maxResults,
    }),
  });

  if (!response.ok) {
    console.error(
      `Places API Error: ${response.status} ${response.statusText}`,
    );
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
    locationDescription: "", // provided by the pass 2 writer function (no need to be in Enterprise SKU)
    latitude: place.location?.latitude || 0,
    longitude: place.location?.longitude || 0,
    googleMapsURL: place.googleMapsUri || "",
    photoURL: photoURL,
  };
}

/**
 * Returns information about the top location based on query text
 */
export async function getTopLocation(
  queryText: string,
): Promise<LocationInformation | null> {
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
export async function getRandomLocation(
  queryText: string,
): Promise<LocationInformation | null> {
  // Fetch up to 10 places so we have a good pool to pick randomly from
  const places = await fetchPlaces(queryText, 10);

  if (places.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * places.length);
  return mapPlaceToLocation(places[randomIndex]);
}

// Selection pool to pick a random top x location for quest:
const SELECTION_POOL_SIZE = 5;

/**
 * Returns a good, varied location for the query, since Places API `searchText` already
 * returns results ordered by relevance/prominence (which bakes in popularity and
 * ratings)
 */
export async function getBestLocation(
  queryText: string,
): Promise<LocationInformation | null> {
  const places = await fetchPlaces(queryText, 10);

  const openPlaces = places.filter(
    (p: any) =>
      p.businessStatus !== "CLOSED_PERMANENTLY" &&
      p.businessStatus !== "CLOSED_TEMPORARILY",
  );

  if (openPlaces.length === 0) {
    return null;
  }

  // openPlaces preserves Google's relevance order; take the top window and
  // randomize within it.
  const pool = openPlaces.slice(0, SELECTION_POOL_SIZE);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return mapPlaceToLocation(pick);
}
