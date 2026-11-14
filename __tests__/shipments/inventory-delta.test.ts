import { updateShipmentStatus } from "@/app/shipments/actions"
import { createClient } from "@/lib/supabase/server"
import { userCanOnSite } from '@/lib/permissions/site-access'

jest.mock("server-only", () => ({}))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/app/shipments/create-shipment", () => ({ createAuthorizedShipment: jest.fn() }))
jest.mock("@/lib/permissions/site-access", () => ({ userCanOnSite: jest.fn() }))
jest.mock("@/lib/marketplace/mutation-guards", () => ({ assertInternalShipment: jest.fn() }))

function fixture(options: { tracked?: boolean; decremented?: boolean; policy?: string; rpcError?: boolean } = {}) {
  const chain = (data: unknown) => {
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve) }
    return query
  }
  const shipments = chain({ status: "preparing", stock_decremented: options.decremented ?? false,
    sale_order_id: "order", origin_location_id: "origin" })
  const client = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'actor' } } }) },
    rpc: jest.fn().mockResolvedValue({ data: { quantity: 0 }, error: options.rpcError ? { message: "denied" } : null }),
    from: jest.fn((table: string) => {
      if (table === "inventory_levels") throw new Error("Legacy stock access")
      if (table === "shipments") return shipments
      if (table === 'sale_orders') return { maybeSingle: jest.fn().mockResolvedValue({ data: { sale: { source: 'shop' } } }),
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
      if (table === "settings") return chain({ commerce: { decrement_stock_on: options.policy ?? "ship" } })
      if (table === "sale_order_items") return chain([{ catalog_item_id: "sku", quantity: 3 }])
      if (table === "catalog_items") return chain({ track_inventory: options.tracked ?? true })
      throw new Error(`Unexpected table ${table}`)
    }),
  }
  jest.mocked(createClient).mockResolvedValue(client as never)
  jest.mocked(userCanOnSite).mockResolvedValue(true)
  return { client, shipments }
}

describe("shipment inventory delta", () => {
  beforeEach(() => jest.clearAllMocks())

  it("applies a floor-zero delta before marking shipment stock decremented", async () => {
    const { client, shipments } = fixture()
    await expect(updateShipmentStatus("site", "shipment", "shipped")).resolves.toHaveProperty("data")
    expect(client.rpc).toHaveBeenCalledWith("apply_location_inventory_delta", {
      p_site_id: "site", p_catalog_item_id: "sku", p_location_id: "origin", p_delta: -3, p_floor_zero: true,
    })
    expect(shipments.update).toHaveBeenCalledWith(expect.objectContaining({ stock_decremented: true }))
    expect(shipments.update.mock.invocationCallOrder[0]).toBeGreaterThan(client.rpc.mock.invocationCallOrder[0])
    expect(client.from).not.toHaveBeenCalledWith("inventory_levels")
  })

  it("returns failure without marking the shipment or retrying the RPC", async () => {
    const { client, shipments } = fixture({ rpcError: true })
    await expect(updateShipmentStatus("site", "shipment", "shipped"))
      .resolves.toEqual({ error: "Failed to apply inventory delta" })
    expect(shipments.update).not.toHaveBeenCalled()
    expect(client.rpc).toHaveBeenCalledTimes(1)
  })

  it.each([{ tracked: false }, { decremented: true }, { policy: "never" }, { policy: "order_complete" }])(
    "preserves shipment stock gates %p", async (options) => {
      const { client } = fixture(options)
      await updateShipmentStatus("site", "shipment", "shipped")
      expect(client.rpc).not.toHaveBeenCalled()
    },
  )
})