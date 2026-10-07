/** @jest-environment node */

import { GET, OPTIONS } from "@/app/api/version/route"

const endpoint = "https://app.makinari.com/api/version"
const originalBuildId = process.env.NEXT_PUBLIC_BUILD_ID
const allowedOrigins = [
  "https://www.makinari.com", "https://makinari.com",
  "https://app.makinari.com", "https://demo.makinari.com",
]
const untrustedOrigins = [
  "https://evil.test", "https://www.makinari.com.evil.test", "null",
  "http://www.makinari.com", "https://www.makinari.com:444", "https://unknown.makinari.com",
]

beforeEach(() => {
  process.env.NEXT_PUBLIC_BUILD_ID = "test-deployment"
})

afterEach(() => {
  if (originalBuildId === undefined) delete process.env.NEXT_PUBLIC_BUILD_ID
  else process.env.NEXT_PUBLIC_BUILD_ID = originalBuildId
})

function request(headers: Record<string, string> = {}, method = "GET") {
  return new Request(endpoint, { method, headers })
}

function preflight(headers: Record<string, string> = {}) {
  return request({
    origin: allowedOrigins[0], "access-control-request-method": "GET", ...headers,
  }, "OPTIONS")
}

it.each(allowedOrigins)("allows anonymous version reads from %s", async origin => {
  const response = await GET(request({ origin }))
  expect(response.status).toBe(200)
  expect(response.headers.get("access-control-allow-origin")).toBe(origin)
  expect(response.headers.get("access-control-expose-headers")).toBe("ETag")
  expect(response.headers.get("access-control-allow-credentials")).toBeNull()
  expect(response.headers.get("vary")).toBe("Origin")
  expect(response.headers.get("cache-control")).toBe("private, max-age=60, stale-while-revalidate=300")
  const body = await response.json()
  expect(Object.keys(body)).toEqual(["version"])
  expect(typeof body.version).toBe("string")
  expect(response.headers.get("etag")).toBe(body.version ? `"${body.version}"` : null)
})

it.each(allowedOrigins)("preserves CORS, validators and an empty body on 304 from %s", async origin => {
  const initial = await GET(request({ origin }))
  const { version } = await initial.json()
  expect(version).toBeTruthy()

  for (const validator of [`"${version}"`, version]) {
    const response = await GET(request({ origin, "if-none-match": validator }))
    expect(response.status).toBe(304)
    expect(await response.text()).toBe("")
    for (const header of ["access-control-allow-origin", "access-control-expose-headers", "vary", "etag", "cache-control"]) {
      expect(response.headers.get(header)).toBe(initial.headers.get(header))
    }
    expect(response.headers.get("access-control-allow-credentials")).toBeNull()
  }
})

it("returns the current version when the validator is stale", async () => {
  const response = await GET(request({ origin: allowedOrigins[0], "if-none-match": '"old-deployment"' }))
  expect(response.status).toBe(200)
  expect(response.headers.get("access-control-allow-origin")).toBe(allowedOrigins[0])
  expect(Object.keys(await response.json())).toEqual(["version"])
})

it.each([undefined, ...untrustedOrigins])("does not grant CORS to %s and still varies the cache", async origin => {
  const initial = await GET(request(origin ? { origin } : {}))
  const { version } = await initial.json()
  const conditional = await GET(request({ ...(origin ? { origin } : {}), "if-none-match": `"${version}"` }))
  expect(conditional.status).toBe(304)
  for (const response of [initial, conditional]) {
    expect(response.headers.get("access-control-allow-origin")).toBeNull()
    expect(response.headers.get("access-control-allow-credentials")).toBeNull()
    expect(response.headers.get("vary")).toBe("Origin")
    expect(response.headers.get("cache-control")).toContain("private")
  }
})

it("keeps CORS when no build identifier is configured and does not emit a false 304", async () => {
  delete process.env.NEXT_PUBLIC_BUILD_ID
  const response = await GET(request({ origin: allowedOrigins[0], "if-none-match": '"test-deployment"' }))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ version: "" })
  expect(response.headers.get("etag")).toBeNull()
  expect(response.headers.get("access-control-allow-origin")).toBe(allowedOrigins[0])
})

it.each(allowedOrigins)("permits only read-only preflight from %s", async origin => {
  for (const method of ["GET", "HEAD"]) {
    const response = OPTIONS(preflight({
      origin, "access-control-request-method": method,
      "access-control-request-headers": "If-None-Match, CACHE-CONTROL",
    }))
    expect(response.status).toBe(204)
    expect(await response.text()).toBe("")
    expect(response.headers.get("access-control-allow-origin")).toBe(origin)
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, HEAD, OPTIONS")
    expect(response.headers.get("access-control-allow-headers")).toBe("If-None-Match, Cache-Control")
    expect(response.headers.get("access-control-allow-credentials")).toBeNull()
    expect(response.headers.get("access-control-max-age")).toBe("600")
    expect(response.headers.get("cache-control")).toBe("no-store, private")
    expect(response.headers.get("vary")).toBe("Origin, Access-Control-Request-Method, Access-Control-Request-Headers")
  }
})

it.each(untrustedOrigins)("rejects preflight from %s without reflecting the origin", origin => {
  const response = OPTIONS(preflight({ origin }))
  expect(response.status).toBe(403)
  expect(response.headers.get("access-control-allow-origin")).toBeNull()
  expect(response.headers.get("access-control-allow-methods")).toBeNull()
  expect(response.headers.get("cache-control")).toBe("no-store, private")
})

it.each<Record<string, string>>([
  { origin: "" }, { "access-control-request-method": "POST" },
  { "access-control-request-method": "" },
  { "access-control-request-headers": "Authorization" },
  { "access-control-request-headers": "If-None-Match, x-api-key" },
])("rejects missing origins, writes and credential headers: %j", headers => {
  const response = OPTIONS(preflight(headers))
  expect(response.status).toBe(403)
  expect(response.headers.get("access-control-allow-methods")).toBeNull()
  expect(response.headers.get("access-control-allow-credentials")).toBeNull()
})

it("accepts a simple read preflight without requested headers", () => {
  expect(OPTIONS(preflight()).status).toBe(204)
})