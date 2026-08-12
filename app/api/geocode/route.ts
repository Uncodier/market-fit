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
      const places = await searchPlaces(q, 5)
      return NextResponse.json({ places }, { headers: cacheHeaders })
    }

    if (lat && lon) {
      const place = await reverseGeocodePlace(parseFloat(lat), parseFloat(lon))
      return NextResponse.json({ place }, { headers: cacheHeaders })
    }

    if (!address && !city) {
      return NextResponse.json(
        { error: "address, city, q, or lat/lon is required" },
        { status: 400 }
      )
    }

    const coords = await geocodeVenueLocation({ address, city, name })
    return NextResponse.json({ coords }, { headers: cacheHeaders })
  } catch (error) {
    console.error("[geocode] Error:", error)
    if (q) return NextResponse.json({ places: [] }, { status: 200 })
    if (lat && lon) return NextResponse.json({ place: null }, { status: 200 })
    return NextResponse.json({ coords: null }, { status: 200 })
  }
}
