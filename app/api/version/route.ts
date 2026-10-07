import { NextResponse } from "next/server"
import { versionCorsHeaders, versionPreflight } from "./cors"

export async function GET(request: Request) {
  // Public deployment metadata only; no authentication or tenant data is needed.
  const version = process.env.NEXT_PUBLIC_BUILD_ID ?? ""
  const etag = version ? `"${version}"` : undefined
  const ifNoneMatch = request.headers.get("if-none-match")
  const headers = versionCorsHeaders(request)
  // Keep browser caching, not shared CDN entries with origin-specific CORS.
  headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=300")
  if (etag) headers.set("ETag", etag)

  if (etag && (ifNoneMatch === etag || ifNoneMatch === version)) {
    return new NextResponse(null, {
      status: 304,
      headers,
    })
  }

  return NextResponse.json({ version }, { headers })
}

export function OPTIONS(request: Request) {
  return versionPreflight(request)
}
