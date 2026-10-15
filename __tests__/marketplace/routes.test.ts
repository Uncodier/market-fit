/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/marketplace/runtime", () => ({ marketplaceWebhookDependencies: {} }))
jest.mock("@/lib/marketplace/webhook", () => ({ handleMarketplaceWebhook: jest.fn() }))
jest.mock("@/lib/marketplace/configuration", () => ({ loadMarketplaceIntegration: jest.fn() }))
jest.mock("@/lib/marketplace/providers", () => ({ actOnOrder: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/lib/marketplace/authorization", () => ({ authorizeMarketplaceResource: jest.fn() }))
jest.mock("@/lib/marketplace/merchant/control-events", () => ({ receiveUberProvisioning: jest.fn(async () => false) }))

import { POST as receiveWebhook } from "@/app/api/marketplace/webhooks/[provider]/route"
import { POST as shipmentAction } from "@/app/api/marketplace/shipments/[id]/actions/route"
import { POST as orderAction } from "@/app/api/marketplace/orders/[id]/actions/route"
import { handleMarketplaceWebhook } from "@/lib/marketplace/webhook"
import { authorizeMarketplaceResource } from "@/lib/marketplace/authorization"
import { MarketplaceRequestError } from "@/lib/marketplace/request"
import { createServiceClient } from "@/lib/supabase/server"
import { randomUUID } from "node:crypto"

describe("native marketplace routes", () => {
  beforeEach(() => { jest.clearAllMocks() })

  it("returns Uber's empty 200 only after processing completes", async () => {
    jest.mocked(handleMarketplaceWebhook).mockResolvedValue(undefined)
    const result = await receiveWebhook(new Request("https://orders.example.test/webhook", { method: "POST", body: "{}" }), {
      params: Promise.resolve({ provider: "uber_eats" }),
    })
    expect(result.status).toBe(200)
    expect(await result.text()).toBe("")
  })
  it("does not acknowledge a failed persistence transaction", async () => {
    jest.mocked(handleMarketplaceWebhook).mockRejectedValue(new Error("Database unavailable"))
    const result = await receiveWebhook(new Request("https://orders.example.test/webhook", { method: "POST", body: "{}" }), {
      params: Promise.resolve({ provider: "rappi" }),
    })
    expect(result.status).toBe(503)
    expect(await result.text()).not.toContain("Database unavailable")
  })
  it("rejects invalid signatures without exposing internal errors", async () => {
    jest.mocked(handleMarketplaceWebhook).mockRejectedValue(new MarketplaceRequestError("Invalid webhook authentication", 401))
    const result = await receiveWebhook(new Request("https://orders.example.test/webhook", { method: "POST", body: "{}" }), {
      params: Promise.resolve({ provider: "rappi" }),
    })
    expect(result.status).toBe(401)
  })
  it("authorizes shipments and never dispatches a duplicate marketplace courier", async () => {
    jest.mocked(authorizeMarketplaceResource).mockResolvedValue({ resource: {}, userId: randomUUID() })
    const result = await shipmentAction(new Request("https://orders.example.test/action", {
      method: "POST", body: JSON.stringify({ action: "request" }),
    }), { params: Promise.resolve({ id: randomUUID() }) })
    expect(result.status).toBe(409)
    expect(await result.json()).toMatchObject({ success: false, operation: { status: "unsupported" } })
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  it("denies unauthorized order operators before decrypting secrets or using service role", async () => {
    jest.mocked(authorizeMarketplaceResource).mockRejectedValue(new MarketplaceRequestError("Forbidden", 403))
    const result = await orderAction(new Request("https://orders.example.test/action", {
      method: "POST", body: JSON.stringify({ action: "accept", cooking_time_minutes: 15 }),
    }), { params: Promise.resolve({ id: randomUUID() }) })
    expect(result.status).toBe(403)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})