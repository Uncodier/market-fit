import { applyLocationInventoryDelta } from "@/app/commerce/inventory-delta"

jest.mock("server-only", () => ({}))

const params = { siteId: "site", catalogItemId: "sku", locationId: "origin", delta: -2, floorZero: true }

describe("applyLocationInventoryDelta", () => {
  it("uses only the agreed RPC contract and returns its finite quantity", async () => {
    const client = { rpc: jest.fn().mockResolvedValue({ data: { quantity: 3.5 }, error: null }) }
    await expect(applyLocationInventoryDelta(client, params)).resolves.toBe(3.5)
    expect(client.rpc).toHaveBeenCalledWith("apply_location_inventory_delta", {
      p_site_id: "site", p_catalog_item_id: "sku", p_location_id: "origin", p_delta: -2, p_floor_zero: true,
    })
  })

  it.each([null, [], {}, { quantity: "2" }, { quantity: NaN }, { quantity: Infinity }])(
    "rejects malformed RPC data %p without retry", async (data) => {
      const client = { rpc: jest.fn().mockResolvedValue({ data, error: null }) }
      await expect(applyLocationInventoryDelta(client, params)).rejects.toThrow("Invalid inventory delta response")
      expect(client.rpc).toHaveBeenCalledTimes(1)
    },
  )

  it("rejects RPC errors even if data looks valid, without exposing provider details", async () => {
    const client = { rpc: jest.fn().mockResolvedValue({ data: { quantity: 2 }, error: { message: "private details" } }) }
    await expect(applyLocationInventoryDelta(client, params)).rejects.toThrow("Failed to apply inventory delta")
    expect(client.rpc).toHaveBeenCalledTimes(1)
  })

  it("propagates transport failure without retry", async () => {
    const client = { rpc: jest.fn().mockRejectedValue(new Error("transport failed")) }
    await expect(applyLocationInventoryDelta(client, params)).rejects.toThrow("transport failed")
    expect(client.rpc).toHaveBeenCalledTimes(1)
  })

  it.each([NaN, Infinity, -Infinity])("rejects nonfinite delta %p before RPC", async (delta) => {
    const client = { rpc: jest.fn() }
    await expect(applyLocationInventoryDelta(client, { ...params, delta })).rejects.toThrow("must be finite")
    expect(client.rpc).not.toHaveBeenCalled()
  })
})