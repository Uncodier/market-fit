export type GeocodedPlace = {
  lat: number
  lon: number
  city?: string
  state?: string
  zip?: string
  country?: string
  countryCode?: string
  displayName?: string
}

type NominatimAddress = {
  city?: string
  town?: string
  village?: string
  municipality?: string
  county?: string
  state?: string
  postcode?: string
  country?: string
  country_code?: string
}

type NominatimResult = {
  lat: string
  lon: string
  display_name?: string
  address?: NominatimAddress
}

function placeFromNominatim(row: NominatimResult): GeocodedPlace {
  const addr = row.address || {}
  const city =
    addr.city || addr.town || addr.village || addr.municipality || addr.county || undefined
  return {
    lat: parseFloat(row.lat),
    lon: parseFloat(row.lon),
    city,
    state: addr.state,
    zip: addr.postcode,
    country: addr.country,
    countryCode: addr.country_code?.toUpperCase(),
    displayName: row.display_name,
  }
}

async function nominatimFetch(url: URL): Promise<NominatimResult[]> {
  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "market-fit/1.0",
      "Accept-Language": "en-US,en;q=0.9",
    },
    next: { revalidate: 86400 },
  })
  if (!response.ok) {
    throw new Error(`Nominatim API returned ${response.status}`)
  }
  const data = await response.json()
  return Array.isArray(data) ? data : data ? [data] : []
}

/** Forward search with structured address parts for restriction matching. */
export async function searchPlaces(query: string, limit = 5): Promise<GeocodedPlace[]> {
  const q = query.trim()
  if (!q) return []

  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("format", "json")
  url.searchParams.set("addressdetails", "1")
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("q", q)

  try {
    const rows = await nominatimFetch(url)
    return rows.map(placeFromNominatim)
  } catch (error) {
    console.error("Place search error:", error)
    return []
  }
}

/** Reverse geocode lat/lon → city/country. */
export async function reverseGeocodePlace(
  lat: number,
  lon: number
): Promise<GeocodedPlace | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  const url = new URL("https://nominatim.openstreetmap.org/reverse")
  url.searchParams.set("format", "json")
  url.searchParams.set("addressdetails", "1")
  url.searchParams.set("lat", String(lat))
  url.searchParams.set("lon", String(lon))

  try {
    const rows = await nominatimFetch(url)
    if (rows.length === 0) return null
    return placeFromNominatim(rows[0])
  } catch (error) {
    console.error("Reverse geocode error:", error)
    return null
  }
}
