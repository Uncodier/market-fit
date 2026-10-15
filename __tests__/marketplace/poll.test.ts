/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/lib/marketplace/configuration", () => ({ loadMarketplaceIntegration: jest.fn() }))
jest.mock("@/lib/marketplace/providers", () => ({ fetchNewOrders: jest.fn() }))
jest.mock("@/lib/marketplace/synchronize", () => ({ synchronizeMarketplaceOrder: jest.fn() }))
import { createServiceClient } from "@/lib/supabase/server"
import { loadMarketplaceIntegration } from "@/lib/marketplace/configuration"
import { synchronizeMarketplaceOrder } from "@/lib/marketplace/synchronize"
import { fetchNewOrders } from "@/lib/marketplace/providers"
import { pollMarketplaceStores } from "@/lib/marketplace/poll"
import { config } from "./provider-fixtures"
import type { NormalizedOrder } from "@/lib/marketplace/providers/types"
import { randomUUID } from "node:crypto"

describe("recovery polling fairness", () => {
  beforeEach(() => jest.clearAllMocks())
  it("checkpoints failures and continues to the next Uber order", async () => {
    const provider = config()
    const connectionId = randomUUID()
    jest.mocked(loadMarketplaceIntegration).mockResolvedValue({
      credentials: { client_id: provider.client_id, client_secret: provider.client_secret },
      config: { id: connectionId, site_id: randomUUID(), provider: "uber_eats", environment: "sandbox", country: "MX",
        external_store_id: provider.store_id, origin_location_id: randomUUID(), secret_id: randomUUID(),
        enabled: true, manual_ready: false, created_by_user_id: randomUUID() },
    })
    const records = [{ external_order_id: "unavailable" }, { external_order_id: "available" }]
    const updates: Record<string, unknown>[] = []
    type Query = {
      select: jest.Mock; eq: jest.Mock; not: jest.Mock; order: jest.Mock; limit: jest.Mock; update: jest.Mock;
      then: (resolve: (value: { error: null }) => unknown) => Promise<unknown>;
    }
    const query: Query = {
      select: jest.fn(), eq: jest.fn(), not: jest.fn(), order: jest.fn(),
      limit: jest.fn(async () => ({ data: records, error: null })),
      update: jest.fn((value: Record<string, unknown>) => { updates.push(value); return query }),
      then: (resolve: (value: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
    }
    for (const method of [query.select, query.eq, query.not, query.order]) method.mockReturnValue(query)
    jest.mocked(createServiceClient).mockResolvedValue({
      rpc: jest.fn(async () => ({ data: [{ integration_id: connectionId }], error: null })), from: jest.fn(() => query),
    })
    jest.mocked(synchronizeMarketplaceOrder).mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce({ refreshed: true, provider_state: "accepted" })
    expect(await pollMarketplaceStores(Date.now() + 60_000)).toEqual({ refreshed: 1, unavailable: 1 })
    expect(synchronizeMarketplaceOrder).toHaveBeenCalledTimes(2)
    expect(updates).toHaveLength(2)
  })
  it("imports beyond twenty Rappi orders and continues after one failed import", async () => {
    const provider = config("rappi")
    const connectionId = randomUUID()
    jest.mocked(loadMarketplaceIntegration).mockResolvedValue({
      credentials: { client_id: provider.client_id, client_secret: provider.client_secret },
      config: { id: connectionId, site_id: randomUUID(), provider: "rappi", environment: "sandbox", country: "MX",
        external_store_id: provider.store_id, origin_location_id: randomUUID(), secret_id: randomUUID(),
        enabled: true, manual_ready: false, created_by_user_id: randomUUID() },
    })
    const orders: NormalizedOrder[] = Array.from({ length: 25 }, (_, index) => ({
      external_order_id: `order-${index}`, external_store_id: provider.store_id, display_id: `${index}`,
      status: "pending", currency: "MXN", total: 100, subtotal: 100, discount_total: 0,
      totals_provisional: false, items: [], customer: {}, fulfillment_method: "delivery",
    }))
    jest.mocked(fetchNewOrders).mockResolvedValue(orders)
    let imports = 0
    const rpc = jest.fn(async (name: string) => {
      if (name === "claim_marketplace_poll") return { data: [{ integration_id: connectionId, order_list: "sent" }], error: null }
      imports++
      return { data: null, error: imports === 1 ? { message: "Test failed import" } : null }
    })
    jest.mocked(createServiceClient).mockResolvedValue({ rpc })
    expect(await pollMarketplaceStores(Date.now() + 60_000)).toEqual({ refreshed: 24, unavailable: 1 })
    expect(imports).toBe(25)
    expect(fetchNewOrders).toHaveBeenCalledWith(expect.anything(), "sent")
  })
})