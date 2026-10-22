/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/app/commerce/self-service", () => ({ resolveSelfServiceLocation: jest.fn(), resolveSelfServiceBuyer: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/lib/redis/control-plane", () => ({
  checkRateLimit: jest.fn(), hashRedisKeyPart: jest.fn(async () => "hashed-client"),
  rateLimitError: jest.fn(() => Response.json({ error: "Too many requests" }, { status: 429 })),
}))
import { POST, OPTIONS } from "@/app/api/commerce/buyer-identity/route"
import { resolveSelfServiceLocation, resolveSelfServiceBuyer } from "@/app/commerce/self-service"
import { createServiceClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/redis/control-plane"
import { issueBuyerIdentityToken } from "@/app/commerce/buyer-identity-token"

const locationId = "11111111-1111-4111-8111-111111111111"
const buyerId = "33333333-3333-4333-8333-333333333333"
const oldSecret = process.env.SUPABASE_SERVICE_ROLE_KEY

function request(body: unknown, origin = "https://app.makinari.com", host = "https://app.makinari.com") {
  return new Request(`${host}/api/commerce/buyer-identity`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.SUPABASE_SERVICE_ROLE_KEY = "isolated-test-key"
  ;(checkRateLimit as jest.Mock).mockResolvedValue({ allowed: true })
  ;(createServiceClient as jest.Mock).mockResolvedValue({})
  ;(resolveSelfServiceLocation as jest.Mock).mockResolvedValue({ site: { id: "site" } })
  ;(resolveSelfServiceBuyer as jest.Mock).mockResolvedValue({ userId: buyerId, name: "Buyer", email: "private@example.test", orders: ["private-order"] })
})
afterAll(() => {
  if (oldSecret === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = oldSecret
})

it("requires trusted origin and signed identity before service access", async () => {
  expect((await POST(request({ code: issueBuyerIdentityToken(buyerId).code, locationId }, "https://attacker.example"))).status).toBe(403)
  expect((await POST(request({ code: `mf:user:${buyerId}`, locationId }))).status).toBe(400)
  expect(createServiceClient).not.toHaveBeenCalled()
})

it("returns only display name without account IDs, email or history and disables caching", async () => {
  const response = await POST(request({ code: issueBuyerIdentityToken(buyerId).code, locationId }))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ name: "Buyer" })
  expect(response.headers.get("Cache-Control")).toBe("no-store, private")
  expect(checkRateLimit).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ failureMode: "closed" }))
})

it("limits identity attempts and denies invalid locations", async () => {
  const body = { code: issueBuyerIdentityToken(buyerId).code, locationId }
  ;(checkRateLimit as jest.Mock).mockResolvedValueOnce({ allowed: false })
  expect((await POST(request(body))).status).toBe(429)
  expect(createServiceClient).not.toHaveBeenCalled()
  ;(resolveSelfServiceLocation as jest.Mock).mockResolvedValue(null)
  expect((await POST(request(body))).status).toBe(404)
  expect(resolveSelfServiceBuyer).not.toHaveBeenCalled()
})

it("rejects malformed/oversized input and unexpected identity fields", async () => {
  for (const body of [{ code: "x", locationId: "bad" }, { code: "x", locationId, userId: buyerId }, { code: "x".repeat(3000), locationId }]) {
    expect([400, 413]).toContain((await POST(request(body))).status)
  }
  expect(createServiceClient).not.toHaveBeenCalled()
})

it("supports only the explicit www/app CORS pair without credentials", async () => {
  const response = await POST(request({ code: issueBuyerIdentityToken(buyerId).code, locationId }, "https://www.makinari.com"))
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://www.makinari.com")
  expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull()
  const preflight = OPTIONS(new Request("https://app.makinari.com/api/commerce/buyer-identity", { method: "OPTIONS", headers: {
    origin: "https://www.makinari.com", "access-control-request-method": "POST", "access-control-request-headers": "Content-Type",
  } }))
  expect(preflight.status).toBe(204)
})