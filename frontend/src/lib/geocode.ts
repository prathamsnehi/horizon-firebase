/**
 * Resolve a city name to coordinates using the free Open-Meteo geocoding
 * API (no key required). The backend uses cityLatitude/cityLongitude to
 * compute real distances and travel times; without them it falls back to
 * generic transport options.
 */
export interface GeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

export async function geocodeCity(
  query: string
): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", q);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.results?.[0];
    if (!hit) return null;
    return {
      name: hit.name,
      latitude: hit.latitude,
      longitude: hit.longitude,
      country: hit.country,
      admin1: hit.admin1,
    };
  } catch {
    return null;
  }
}
