/** @jest-environment node */
import { revalidateCheckoutAvailability, allocateCheckoutBackorders } from "@/app/commerce/checkout-availability"
import { loadCheckoutCompletedQuantities } from "@/app/commerce/checkout-completed-quantities"
import { assertCanSell } from "@/app/catalog/sell-availability"
import type { CheckoutLine, ProcessedCheckoutLine } from "@/app/commerce/checkout-types"
import { buildCartFromSaleOrderItems } from "@/app/pos/populate-cart-from-order"

jest.mock("@/app/catalog/sell-availability", () => ({ assertCanSell: jest.fn() }))
const host = { id: "host", catalog_item_id: "sku", quantity: 2, status: "completed",
  parent_sale_order_item_id: null, metadata: { client_line_key: "key" } }
const child = { id: "child", catalog_item_id: "extra", quantity: 4, status: "completed",
  parent_sale_order_item_id: "host", metadata: { client_line_key: "key:mod:g:extra", modifier_group_id: "g" } }
const line: CheckoutLine = { catalogItemId: "sku", quantity: 2, saleOrderItemId: "host", clientLineKey: "key",
  modifiers: [{ catalogItemId: "extra", quantity: 2, saleOrderItemId: "child", groupId: "g" }] }
function db(rows: unknown[] = [host, child], error: unknown = null) {
  const filters: Record<string, string> = {}
  const query = {
    select: jest.fn(), eq: jest.fn(),
    single: jest.fn(async () => ({ data: error ? null : { id: "order", sale_order_items: rows }, error })) }
  query.select.mockReturnValue(query)
  query.eq.mockImplementation((key: string, value: string) => { filters[key] = value; return query })
  return { filters, query, from: jest.fn(() => query) }
}
const params = (lines: CheckoutLine[] = [line], client = db()) => ({
  siteId: "site", lines, supabase: client, isStaffCheckout: true, priceListChannel: "pos",
  isAdmin: false, effectiveExistingOrderId: "order", intent: "pay", originLocationId: "origin",
})
const processed = (sku: string, quantity: number) => ({ catalog_item_id: sku, quantity } as ProcessedCheckoutLine)
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(assertCanSell).mockImplementation(async (_site, _sku, quantity, _location, _admin, options) => {
    if (!options?.inventoryAlreadyCompleted && !options?.completedWithoutStock && (quantity || 0) > 0) {
      throw new Error("Insufficient stock")
    }
    return { sellable: true, policy: "block" }
  })
})

it("pays only persisted completed quantities and never allocates them as new backorders", async () => {
  const client = db()
  const stock = await revalidateCheckoutAvailability(params([line], client))
  expect(client.filters).toEqual({ site_id: "site", id: "order" })
  expect(assertCanSell).toHaveBeenCalledTimes(2)
  expect(allocateCheckoutBackorders([processed("sku", 2), processed("extra", 4)], stock))
    .toEqual([expect.objectContaining({ backorder_quantity: 0, inventory_completed_quantity: 2 }),
      expect.objectContaining({ backorder_quantity: 0, inventory_completed_quantity: 4 })])
})

it.each(["new", "preparing", "cancelled", "returned"])("does not exempt a persisted %s line", async (status) => {
  await expect(revalidateCheckoutAvailability(params([{ ...line, modifiers: [] }], db([{ ...host, status }]))))
    .rejects.toThrow("Insufficient stock")
})

it("checks extra and newly added quantities, including repeated SKUs", async () => {
  await expect(revalidateCheckoutAvailability(params([{ ...line, quantity: 3 }]))).rejects.toThrow("Insufficient stock")
  await expect(revalidateCheckoutAvailability(params([line, { catalogItemId: "sku", quantity: 1 }])))
    .rejects.toThrow("Insufficient stock")
  await expect(revalidateCheckoutAvailability(params([{ ...line, modifiers: [{ ...line.modifiers![0], quantity: 3 }] }])))
    .rejects.toThrow("Insufficient stock")
})

it("caps partial completed unit quantities and allocates only pending demand", async () => {
  const client = db([{ ...host, status: "preparing", quantity: 5,
    sale_order_item_units: [{ quantity: 2, status: "completed" }, { quantity: 3, status: "preparing" }] }])
  jest.mocked(assertCanSell).mockResolvedValue({ sellable: true, availableQty: 1, policy: "allow" })
  const stock = await revalidateCheckoutAvailability(params([{ ...line, quantity: 5, modifiers: [] }], client))
  expect(assertCanSell).toHaveBeenCalledWith("site", "sku", 3, "origin", false, { skipVariantSelection: false })
  expect(allocateCheckoutBackorders([processed("sku", 5)], stock)[0])
    .toMatchObject({ backorder_quantity: 2, inventory_completed_quantity: 2 })
})

it("does not transfer completion credits to another line or modifier parent", async () => {
  await expect(loadCheckoutCompletedQuantities(params([{ ...line, saleOrderItemId: "foreign" }]))).rejects.toThrow("does not belong")
  await expect(loadCheckoutCompletedQuantities(params([{ ...line, catalogItemId: "other" }]))).rejects.toThrow("does not belong")
  await expect(loadCheckoutCompletedQuantities(params([line, line]))).rejects.toThrow("does not belong")
  await expect(loadCheckoutCompletedQuantities(params([line], db([host, { ...child, parent_sale_order_item_id: "other" }]))))
    .rejects.toThrow("does not belong")
  expect(await loadCheckoutCompletedQuantities(params([{ ...line, clientLineKey: "replacement" }]))).toEqual([0, 0])
  expect(await loadCheckoutCompletedQuantities(params([{ ...line, modifiers: [{ ...line.modifiers![0], groupId: "other" }] }])))
    .toEqual([2, 0])
})

it("does not trust client status or grant exemptions to other checkout contexts", async () => {
  for (const change of [{ intent: "send" }, { isStaffCheckout: false }, { priceListChannel: "shop" }, { effectiveExistingOrderId: undefined }]) {
    const client = db()
    expect(await loadCheckoutCompletedQuantities({ ...params([line], client), ...change })).toEqual([0, 0])
    expect(client.from).not.toHaveBeenCalled()
  }
  await expect(revalidateCheckoutAvailability(params([{ catalogItemId: "sku", quantity: 2, status: "completed" } as CheckoutLine])))
    .rejects.toThrow("Insufficient stock")
})

it("does not exempt ambiguous legacy persistence identities", async () => {
  expect(await loadCheckoutCompletedQuantities(params([line], db([{ ...host, metadata: {} }, child]))))
    .toEqual([0, 0])
  expect(await loadCheckoutCompletedQuantities(params([{ ...line, modifiers: [] }], db([
    { ...host, metadata: {} }, { ...host, id: "duplicate", metadata: {} },
  ])))).toEqual([0])
})

it("fails closed on inaccessible order and malformed demand", async () => {
  await expect(revalidateCheckoutAvailability(params([line], db([], new Error("RLS")))))
    .rejects.toThrow("Unable to verify completed")
  await expect(revalidateCheckoutAvailability(params([{ ...line, quantity: NaN }]))).rejects.toThrow("positive finite")
  expect(assertCanSell).not.toHaveBeenCalled()
})

it("keeps explicit completion separate, with no credits or backorders", async () => {
  const stock = await revalidateCheckoutAvailability({ ...params([{ ...line, completedWithoutStock: true }]), effectiveExistingOrderId: undefined })
  expect(allocateCheckoutBackorders([{ ...processed("sku", 2), completed_without_stock: true }], stock)[0])
    .toMatchObject({ backorder_quantity: 0 })
  await expect(revalidateCheckoutAvailability({ ...params([{ ...line, completedWithoutStock: true }]), priceListChannel: "shop" }))
    .rejects.toThrow("POS access")
})

it("hydrates completed host/modifier quantities only from server snapshots", () => {
  const restored = buildCartFromSaleOrderItems([host, child], [])
  expect(restored[0].inventoryCompletedQty).toBe(2)
  expect(restored[0].modifiers![0].inventoryCompletedQty).toBe(4)
  expect(buildCartFromSaleOrderItems([host, child], [], "USD", true)[0].inventoryCompletedQty).toBe(0)
})