/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/app/commerce/self-service", () => ({ resolveSelfServiceLocation: jest.fn() }))
jest.mock("@/app/commerce/public-checkout-recovery", () => ({ recoverPublicCheckout: jest.fn() }))
import { POST } from "@/app/api/commerce/checkout/recover/route"
import { createServiceClient } from "@/lib/supabase/server"
import { resolveSelfServiceLocation } from "@/app/commerce/self-service"
import { recoverPublicCheckout } from "@/app/commerce/public-checkout-recovery"

const locationId = "11111111-1111-4111-8111-111111111111"
const attemptId = "22222222-2222-4222-8222-222222222222"
const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn() }
const client = { from: jest.fn(() => query) }
const request = (body: unknown = { locationId, attemptId }, origin = "https://app.makinari.com") => new Request("https://app.makinari.com/api/commerce/checkout/recover", { method: "POST", headers: { origin }, body: JSON.stringify(body) })
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createServiceClient).mockResolvedValue(client as never)
  jest.mocked(resolveSelfServiceLocation).mockResolvedValue({ site: { id: "site" } } as never)
  jest.mocked(recoverPublicCheckout).mockResolvedValue({ success: true, orderId: "order", publicAccessToken: "token" } as never)
})

it("requires trusted origin and a random attempt credential, not an internal order ID", async () => {
  expect((await POST(request(undefined, "https://evil.test"))).status).toBe(403)
  expect((await POST(request({ locationId, orderId: attemptId }))).status).toBe(400)
  expect(createServiceClient).not.toHaveBeenCalled()
})

it("recovers only the original branch/site-bound ready order without account QR", async () => {
  const result = { state: "ready", orderId: "order", saleId: "sale", ownerToken: "owner", fingerprint: "hash", recoveryLocationId: locationId }
  query.maybeSingle.mockResolvedValue({ data: { result }, error: null })
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(response.headers.get("Cache-Control")).toBe("no-store, private")
  expect(query.eq).toHaveBeenCalledWith("site_id", "site")
  expect(query.eq).toHaveBeenCalledWith("client_mutation_id", attemptId)
  expect(recoverPublicCheckout).toHaveBeenCalledWith(client, "site", result, expect.objectContaining({ recoveryLocationId: locationId }))
})

it("cannot recover another branch or replay a partial processing attempt", async () => {
  query.maybeSingle.mockResolvedValueOnce({ data: { result: { state: "ready", recoveryLocationId: "different" } } })
  expect((await POST(request())).status).toBe(404)
  query.maybeSingle.mockResolvedValueOnce({ data: { result: { state: "processing", recoveryLocationId: locationId } } })
  expect((await POST(request())).status).toBe(409)
  expect(recoverPublicCheckout).not.toHaveBeenCalled()
})