const allowedOrigins = new Set([
  "https://www.makinari.com",
  "https://makinari.com",
  "https://app.makinari.com",
  "https://demo.makinari.com",
])

const allowedRequestHeaders = new Set(["if-none-match", "cache-control"])

export function versionCorsHeaders(request: Request): Headers {
  // Vary even without Origin so a cached same-origin response cannot serve www.
  const headers = new Headers({ Vary: "Origin" })
  const origin = request.headers.get("origin")
  if (origin && allowedOrigins.has(origin)) {
    // This public build identifier does not require cookies or bearer tokens.
    headers.set("Access-Control-Allow-Origin", origin)
    headers.set("Access-Control-Expose-Headers", "ETag")
  }
  return headers
}

export function versionPreflight(request: Request): Response {
  const headers = versionCorsHeaders(request)
  headers.set("Cache-Control", "no-store, private")
  headers.set("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers")

  const method = request.headers.get("access-control-request-method")
  const requestedHeaders = request.headers.get("access-control-request-headers")
    ?.split(",").map(header => header.trim().toLowerCase()).filter(Boolean) ?? []

  if (!headers.has("Access-Control-Allow-Origin")
    || (method !== "GET" && method !== "HEAD")
    || requestedHeaders.some(header => !allowedRequestHeaders.has(header))) {
    return new Response(null, { status: 403, headers })
  }

  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
  headers.set("Access-Control-Allow-Headers", "If-None-Match, Cache-Control")
  headers.set("Access-Control-Max-Age", "600")
  return new Response(null, { status: 204, headers })
}