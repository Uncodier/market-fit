import { NextRequest, NextResponse } from "next/server"
import { geocodeVenueLocation } from "@/app/commerce/geocode-venue"
import { reverseGeocodePlace, searchPlaces } from "@/app/commerce/geocode-search"

const cacheHeaders = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const q = searchParams.get("q")
  const lat = searchParams.get("lat")
  const lon = searchParams.get("lon")
  const address = searchParams.get("address")
  const city = searchParams.get("city")
  const name = searchParams.get("name")

  try {
    if (q) {
      const normalizedQuery = q.trim()
      if (!normalizedQuery || normalizedQuery.length > 200) {
        return NextResponse.json({ error: "Invalid query" }, { status: 400 })
      }
      const places = await searchPlaces(normalizedQuery, 5)
      return NextResponse.json({ places }, { headers: cacheHeaders })
    }

    if (lat && lon) {
      const latitude = Number(lat)
      const longitude = Number(lon)
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
      }
      const place = await reverseGeocodePlace(latitude, longitude)
      return NextResponse.json({ place }, { headers: cacheHeaders })
    }

    if (!address && !city) {
      return NextResponse.json(
        { error: "address, city, q, or lat/lon is required" },
        { status: 400 }
      )
    }
    if (
      (address && address.length > 300) ||
      (city && city.length > 120) ||
      (name && name.length > 160)
    ) {
      return NextResponse.json({ error: "Location input is too long" }, { status: 400 })
    }

    const coords = await geocodeVenueLocation({ address, city, name })
    return NextResponse.json({ coords }, { headers: cacheHeaders })
  } catch (error) {
    console.error("[geocode] Error:", error)
    return NextResponse.json(
      { error: "Geocoding provider request failed" },
      { status: 502 }
    )
  }
}
