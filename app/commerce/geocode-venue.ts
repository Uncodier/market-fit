"use server"

const geocodeCache = new Map<string, { lat: number, lon: number } | null>();

export async function geocodeVenueLocation(params: { address?: string | null, city?: string | null, name?: string | null }) {
  const { address, city, name } = params;
  
  if (!address && !city) {
    return null;
  }

  const queryParts = [address, city].filter(Boolean).join(", ");
  const fallbackQuery = [name, address, city].filter(Boolean).join(", ");
  
  const cacheKey = fallbackQuery.toLowerCase().trim();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  try {
    // Try precise query first
    let result = await fetchNominatim(queryParts);
    
    // If not found and we have a name, try the fallback query
    if (!result && name) {
      result = await fetchNominatim(fallbackQuery);
    }
    
    geocodeCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

async function fetchNominatim(query: string): Promise<{ lat: number, lon: number } | null> {
  if (!query) return null;
  
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "market-fit/1.0",
      "Accept-Language": "en-US,en;q=0.9",
    },
    next: { revalidate: 86400 } // cache at Next.js level for 24h as well
  });

  if (!response.ok) {
    throw new Error(`Nominatim API returned ${response.status}`);
  }

  const data = await response.json();
  if (data && data.length > 0) {
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };
  }

  return null;
}
