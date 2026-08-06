import { NextRequest, NextResponse } from "next/server"

/**
 * Proxy OSRM driving route so the browser stays within CSP (connect-src 'self').
 */
export async function GET(request: NextRequest) {
  const fromLat = Number(request.nextUrl.searchParams.get("fromLat"))
  const fromLon = Number(request.nextUrl.searchParams.get("fromLon"))
  const toLat = Number(request.nextUrl.searchParams.get("toLat"))
  const toLon = Number(request.nextUrl.searchParams.get("toLon"))

  if (
    [fromLat, fromLon, toLat, toLon].some((n) => Number.isNaN(n)) ||
    fromLat < -90 ||
    fromLat > 90 ||
    toLat < -90 ||
    toLat > 90 ||
    fromLon < -180 ||
    fromLon > 180 ||
    toLon < -180 ||
    toLon > 180
  ) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
  }

  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${fromLon},${fromLat};${toLon},${toLat}` +
      `?overview=full&geometries=geojson`
    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) {
      return NextResponse.json({ error: "Routing failed" }, { status: 502 })
    }
    const data = await res.json()
    const coords = data?.routes?.[0]?.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length < 2) {
      return NextResponse.json({ error: "No route" }, { status: 404 })
    }
    // Return [lat, lon] pairs for the client
    const path = coords.map((c: number[]) => [c[1], c[0]])
    return NextResponse.json({ path })
  } catch (error) {
    console.error("[route/preview]", error)
    return NextResponse.json({ error: "Routing error" }, { status: 500 })
  }
}
