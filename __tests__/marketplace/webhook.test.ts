/** @jest-environment node */
import { randomBytes, randomUUID } from "node:crypto"
import { handleMarketplaceWebhook, type MarketplaceWebhookDependencies } from "@/lib/marketplace/webhook"
import type { NormalizedOrder, ProviderConfig, ProviderWebhookEvent } from "@/lib/marketplace/providers/types"

function fixture() {
  const config: ProviderConfig = {
    provider: "uber_eats", environment: "sandbox", country: "MX", store_id: randomUUID(),
    client_id: randomUUID(), client_secret: randomBytes(32).toString("hex"),
  }
  const event: ProviderWebhookEvent = {
    external_store_id: config.store_id, external_order_id: randomUUID(), event_type: "orders.notification", kind: "order",
  }
  const order: NormalizedOrder = {
    external_order_id: event.external_order_id!, external_store_id: config.store_id, display_id: "TEST-ORDER",
    status: "pending", currency: "MXN", total: 50, subtotal: 50, discount_total: 0,
    totals_provisional: false, items: [], customer: {}, fulfillment_method: "delivery",
  }
  const dependencies: MarketplaceWebhookDependencies = {
    parse: jest.fn(() => event),
    resolve: jest.fn(async () => [{ id: randomUUID(), site_id: randomUUID(), manual_ready: false, config }]),
    verify: jest.fn(() => true),
    normalize: jest.fn(() => ({ ...event })),
    fetchOrder: jest.fn(async () => order),
    persist: jest.fn(async () => undefined),
  }
  const request = () => new Request("https://orders.example.test/webhook", {
    method: "POST", body: JSON.stringify({ event_id: randomUUID() }),
  })
  return { config, event, order, dependencies, request }
}

describe("marketplace signed webhook ingestion", () => {
  it("keeps fetched scheduled notifications non-operational until release", async () => {
    const { event, dependencies, request } = fixture()
    dependencies.normalize = jest.fn(() => ({ ...event, event_type: "orders.scheduled.notification" }))
    await handleMarketplaceWebhook(request(), "uber_eats", dependencies)
    expect(dependencies.persist).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      normalized_order: expect.objectContaining({ status: "scheduled", totals_provisional: true }),
    }), expect.any(String))
  })
  it("authenticates before fetching or writing and commits before acknowledging", async () => {
    const { dependencies, request } = fixture()
    await handleMarketplaceWebhook(request(), "uber_eats", dependencies)
    expect(dependencies.persist).toHaveBeenCalledTimes(1)
    const verifyOrder = (dependencies.verify as jest.Mock).mock.invocationCallOrder[0]
    expect(verifyOrder).toBeLessThan((dependencies.fetchOrder as jest.Mock).mock.invocationCallOrder[0])
    expect(dependencies.persist).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      normalized_order: expect.objectContaining({ total: 50 }),
    }), expect.stringMatching(/^[a-f0-9]{64}$/))
  })
  it("does not trust an unverified tenant selector", async () => {
    const { dependencies, request } = fixture()
    dependencies.verify = jest.fn(() => false)
    await expect(handleMarketplaceWebhook(request(), "uber_eats", dependencies)).rejects.toMatchObject({ status: 401 })
    expect(dependencies.fetchOrder).not.toHaveBeenCalled()
    expect(dependencies.persist).not.toHaveBeenCalled()
  })
  it("rejects an order fetched for a different store", async () => {
    const { dependencies, order, request } = fixture()
    dependencies.fetchOrder = jest.fn(async () => ({ ...order, external_store_id: randomUUID() }))
    await expect(handleMarketplaceWebhook(request(), "uber_eats", dependencies)).rejects.toMatchObject({ status: 403 })
    expect(dependencies.persist).not.toHaveBeenCalled()
  })
  it("keeps commit failures unacknowledged", async () => {
    const { dependencies, request } = fixture()
    dependencies.persist = jest.fn(async () => { throw new Error("Storage unavailable") })
    await expect(handleMarketplaceWebhook(request(), "uber_eats", dependencies)).rejects.toThrow("Storage unavailable")
  })
  it("does not fetch cancelled orders and only fetches Uber delivery details", async () => {
    for (const kind of ["cancel", "delivery"] as const) {
      const { event, dependencies, request } = fixture()
      dependencies.normalize = jest.fn(() => ({ ...event, kind }))
      await handleMarketplaceWebhook(request(), "uber_eats", dependencies)
      expect(dependencies.fetchOrder).toHaveBeenCalledTimes(kind === "delivery" ? 1 : 0)
      expect(dependencies.persist).toHaveBeenCalledTimes(1)
    }
  })
})