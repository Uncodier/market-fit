import { NextRequest, NextResponse } from "next/server"
import { geocodeVenueLocation } from "@/app/commerce/geocode-venue"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const address = searchParams.get("address")
  const city = searchParams.get("city")
  const name = searchParams.get("name")

  if (!address && !city) {
    return NextResponse.json({ error: "address or city is required" }, { status: 400 })
  }

  try {
    const coords = await geocodeVenueLocation({ address, city, name })
    return NextResponse.json(
      { coords },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    )
  } catch (error) {
    console.error("[geocode] Error:", error)
    return NextResponse.json({ coords: null }, { status: 200 })
  }
}
