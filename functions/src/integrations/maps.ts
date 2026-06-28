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
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.editorialSummary,places.photos,places.googleMapsUri",
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
    description: place.editorialSummary?.text || "",
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
