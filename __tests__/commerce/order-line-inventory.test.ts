import { reconcileOrderLineInventory } from "@/app/commerce/order-line-inventory"

const response = { review_required: false, skipped: false, debited_quantity: 2, restocked_quantity: 0, applied_quantity: 2 }
const params = { siteId: "site", orderId: "order", lineId: "line", locationId: "location", targetQuantity: 2 }
describe("order line inventory RPC helper", () => {
  it("sends cumulative quantities and preserves durable review results", async () => {
    const client = { rpc: jest.fn().mockResolvedValue({ data: { ...response, review_required: true }, error: null }) }
    expect(await reconcileOrderLineInventory(client, params)).toMatchObject({ reviewRequired: true, debitedQuantity: 2 })
    expect(client.rpc).toHaveBeenCalledWith("reconcile_order_line_inventory", {
      p_site_id: "site", p_order_id: "order", p_line_id: "line", p_location_id: "location", p_target_quantity: 2, p_mode: "debit",
    })
    await reconcileOrderLineInventory(client, { ...params, mode: "restock" })
    expect(client.rpc).toHaveBeenLastCalledWith("reconcile_order_line_inventory", expect.objectContaining({ p_mode: "restock" }))
  })
  it.each([-1, NaN, Infinity, 1_000_000_001])("rejects invalid quantities before RPC: %s", async quantity => {
    const client = { rpc: jest.fn() }
    await expect(reconcileOrderLineInventory(client, { ...params, targetQuantity: quantity })).rejects.toThrow("Invalid")
    expect(client.rpc).not.toHaveBeenCalled()
  })
  it.each([null, [], {}, { ...response, restocked_quantity: 3 }, { ...response, skipped: null }, { ...response, applied_quantity: NaN }])(
    "rejects invalid RPC data %p", async data => {
      await expect(reconcileOrderLineInventory({ rpc: jest.fn().mockResolvedValue({ data, error: null }) }, params)).rejects.toThrow("Invalid")
    })
  it("does not fall back to a non-idempotent delta or retry an RPC error", async () => {
    const client = { rpc: jest.fn().mockResolvedValue({ data: null, error: { message: "private error" } }) }
    await expect(reconcileOrderLineInventory(client, params)).rejects.toThrow("Failed to reconcile order line inventory")
    expect(client.rpc).toHaveBeenCalledTimes(1)
  })
})