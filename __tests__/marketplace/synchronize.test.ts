/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/lib/marketplace/configuration", () => ({ loadMarketplaceIntegration: jest.fn() }))
jest.mock("@/lib/marketplace/providers", () => ({
  ...jest.requireActual("@/lib/marketplace/providers/types"),
  fetchOrder: jest.fn(), fetchOrderEvents: jest.fn(),
}))
import { createServiceClient } from "@/lib/supabase/server"
import { loadMarketplaceIntegration } from "@/lib/marketplace/configuration"
import { fetchOrder, fetchOrderEvents, MarketplaceProviderError } from "@/lib/marketplace/providers"
import { synchronizeMarketplaceOrder } from "@/lib/marketplace/synchronize"
import { randomBytes, randomUUID } from "node:crypto"
import { config, uberOrder } from "./provider-fixtures"
import { normalizeUberOrder } from "@/lib/marketplace/providers/uber-normalize"

describe("read-only marketplace reconciliation", () => {
  beforeEach(() => { jest.clearAllMocks() })
  it("does not infer acceptance from Rappi courier visibility", async () => {
    const integrationId = randomUUID()
    const config = {
      id: integrationId, site_id: randomUUID(), provider: "rappi" as const, environment: "sandbox" as const,
      country: "MX" as const, external_store_id: "test-store", origin_location_id: randomUUID(),
      secret_id: randomUUID(), enabled: true, manual_ready: false, created_by_user_id: randomUUID(),
    }
    jest.mocked(loadMarketplaceIntegration).mockResolvedValue({ config, credentials: {
      client_id: randomUUID(), client_secret: randomBytes(32).toString("hex"), webhook_secret: randomBytes(32).toString("hex"),
    } })
    jest.mocked(fetchOrder).mockRejectedValue(new MarketplaceProviderError("not_found", "Unavailable in lists"))
    jest.mocked(fetchOrderEvents).mockResolvedValue([{
      external_order_id: "test-order", external_store_id: "test-store", event_type: "taken_visible_order", kind: "delivery",
      delivery: { provider_event: "taken_visible_order", courier: { name: "Test courier" } },
    }])
    const rpc = jest.fn<Promise<{ error: null }>, [string, { p_order: Record<string, unknown> }]>(async () => ({ error: null }))
    jest.mocked(createServiceClient).mockResolvedValue({ rpc })
    expect(await synchronizeMarketplaceOrder(integrationId, "test-order")).toMatchObject({ refreshed: false })
    expect(rpc).toHaveBeenCalledWith("ingest_marketplace_event", expect.objectContaining({
      p_order: expect.objectContaining({ event_kind: "delivery" }),
    }))
    const payload = rpc.mock.calls[0][1]
    expect(payload.p_order.status).toBeUndefined()
  })
  it("does not deduplicate separate observations solely because provider data matches", async () => {
    const provider = config()
    const integrationId = randomUUID()
    jest.mocked(loadMarketplaceIntegration).mockResolvedValue({
      credentials: { client_id: provider.client_id, client_secret: provider.client_secret },
      config: { id: integrationId, site_id: randomUUID(), provider: "uber_eats", environment: "sandbox", country: "MX",
        external_store_id: provider.store_id, origin_location_id: randomUUID(), secret_id: randomUUID(), enabled: true,
        manual_ready: false, created_by_user_id: randomUUID() },
    })
    const order = normalizeUberOrder(provider, uberOrder(provider.store_id))
    jest.mocked(fetchOrder).mockResolvedValue(order)
    const rpc = jest.fn<Promise<{error: null}>, [string, {p_event_key: string}]>(async () => ({ error: null }))
    jest.mocked(createServiceClient).mockResolvedValue({ rpc })
    await synchronizeMarketplaceOrder(integrationId, order.external_order_id)
    await synchronizeMarketplaceOrder(integrationId, order.external_order_id)
    expect(rpc.mock.calls[0][1].p_event_key).not.toBe(rpc.mock.calls[1][1].p_event_key)
  })
})