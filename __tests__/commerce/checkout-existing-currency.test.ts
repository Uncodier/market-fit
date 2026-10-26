/** @jest-environment node */
import { processCheckoutLines } from "@/app/commerce/checkout-lines"
import { resolveExistingCheckoutCurrency } from "@/app/commerce/checkout-existing-currency"
import { buildCartFromSaleOrderItems } from "@/app/pos/populate-cart-from-order"
import { posCheckoutLines } from "@/app/pos/checkout-lines"
import { posCartSubtotalInSiteCurrency, posCartTaxLinesInSiteCurrency } from "@/app/pos/cart-totals"
import { repricePosCart } from "@/app/pos/reprice-cart"
import { getUsdFxRates } from "@/app/lib/fx-rates"
import type { CatalogItem } from "@/app/types"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { CheckoutLine } from "@/app/commerce/checkout-types"

jest.mock("@/app/commerce/checkout-availability", () => ({
  revalidateCheckoutAvailability: jest.fn(), allocateCheckoutBackorders: (lines: unknown) => lines,
}))
jest.mock("@/app/catalog/tax-actions", () => ({ getTaxesByCatalogItemIds: jest.fn().mockResolvedValue({ data: {} }) }))
jest.mock("@/app/commerce/pass-round-robin-server", () => ({ assertCommerceReservationSlot: jest.fn() }))
jest.mock("@/app/price-lists/actions", () => ({ resolveUnitPrice: jest.fn().mockResolvedValue({ price: 9 }) }))
jest.mock("@/app/lib/fx-rates", () => ({ getUsdFxRates: jest.fn().mockResolvedValue({ rates: { EUR: 0.9 } }) }))

const catalog = [
  { id: "eur", name: "Euro product", currency: "EUR", kind: "product" },
  { id: "usd", name: "Dollar product", currency: "USD", kind: "product" },
  { id: "new", name: "New product", currency: "EUR", kind: "product" },
  { id: "extra", name: "Extra", currency: "EUR", kind: "product" },
] as CatalogItem[]
const rows = catalog.slice(0, 2).map((item, index) => ({
  id: `line-${index}`, catalog_item_id: item.id, name: item.name,
  quantity: 1, unit_price: 10 * (index + 1), status: "sent", metadata: {}, parent_sale_order_item_id: null,
}))
const persisted = { currency: "USD", sale_order_items: rows }
function client(order: unknown = persisted, readError = false) {
  const reads: Array<{ table: string; fields?: string; filters: Record<string, unknown> }> = []
  return { reads, from: jest.fn((table: string) => {
    const read = { table, fields: undefined as string | undefined, filters: {} as Record<string, unknown> }
    reads.push(read)
    const query = {
      select: (fields: string) => { read.fields = fields; return query },
      eq: (key: string, value: unknown) => { read.filters[key] = value; return query },
      in: (_key: string, ids: string[]) => Promise.resolve({
        data: catalog.filter((item) => ids.includes(item.id)), error: null,
      }),
      single: async () => ({ data: table === "sale_orders" ? order : catalog.find((item) => item.id === read.filters.id),
        error: readError ? { message: "Database error" } : null }),
    }
    return query
  }) }
}
function params(lines: CheckoutLine[], db = client()) {
  return { supabase: db as unknown as SupabaseClient, supabaseAdmin: db,
    siteId: "site", lines, isAdmin: false, isStaffCheckout: true,
    siteSettings: { currency: "USD" }, priceListChannel: "pos", fulfillment: "none" as const,
    effectiveExistingOrderId: "order" }
}

describe("existing POS order currency", () => {
  beforeEach(() => jest.clearAllMocks())

  it("keeps the reproduced $30 display and backend total identical without double conversion", async () => {
    const cart = buildCartFromSaleOrderItems(rows, catalog, "USD")
    const result = await processCheckoutLines(params(posCheckoutLines(cart)))
    expect(posCartSubtotalInSiteCurrency(cart, "USD", { EUR: 0.9 })).toBe(30)
    expect(result.orderSubtotal).toBe(30)
    expect(result.orderCurrency).toBe("USD")
    expect(result.processedLines.map((line) => line.unit_price)).toEqual([10, 20])
    expect(getUsdFxRates).not.toHaveBeenCalled()
  })

  it("uses the persisted currency even when all current catalog products use another currency", async () => {
    const cart = buildCartFromSaleOrderItems(rows.slice(0, 1), catalog, "USD")
    const result = await processCheckoutLines(params(posCheckoutLines(cart)))
    expect(result.orderCurrency).toBe("USD")
    expect(result.orderSubtotal).toBe(10)
  })

  it("converts new catalog-priced lines into the existing order currency", async () => {
    const cart = buildCartFromSaleOrderItems(rows, catalog, "USD")
    cart.push({ ...catalog[2], cartQty: 1, cartPrice: 9 })
    const result = await processCheckoutLines(params(posCheckoutLines(cart)))
    expect(result.orderCurrency).toBe("USD")
    expect(result.orderSubtotal).toBe(40)
    expect(posCartSubtotalInSiteCurrency(cart, "USD", { EUR: 0.9 })).toBe(40)
  })

  it("retains stored modifier prices while converting a new modifier's catalog currency", async () => {
    const child = { ...rows[0], id: "extra-line", catalog_item_id: "extra",
      parent_sale_order_item_id: "line-0", name: "Extra", unit_price: 2 }
    const saved = [...rows, child]
    const cart = buildCartFromSaleOrderItems(saved, catalog, "USD")
    expect((await processCheckoutLines(params(posCheckoutLines(cart), client({ currency: "USD", sale_order_items: saved }))))
      .orderSubtotal).toBe(32)
    cart[0].modifiers!.push({ catalogItemId: "extra", groupId: "new", name: "Extra",
      cartPrice: 9, cartQty: 1, currency: "EUR" })
    const result = await processCheckoutLines(params(posCheckoutLines(cart), client({ currency: "USD", sale_order_items: saved })))
    expect(result.orderSubtotal).toBe(42)
    expect(posCartSubtotalInSiteCurrency(cart, "USD", { EUR: 0.9 })).toBe(42)
    expect(posCartTaxLinesInSiteCurrency(cart, "USD", { EUR: 0.9 })
      .filter((line) => line.catalogItemId === "extra").map((line) => line.subtotal)).toEqual([2, 10])
  })

  it("converts catalog repricing once and retains the persisted price reference", async () => {
    const restored = buildCartFromSaleOrderItems(rows, catalog, "USD")
    const repriced = repricePosCart(restored, catalog, () => 9, { EUR: 0.9 })
    expect(repriced[0]).toMatchObject({ cartPrice: 10, currency: "USD", saleOrderItemId: "line-0" })
    expect((await processCheckoutLines(params(posCheckoutLines(repriced)))).orderSubtotal).toBe(19)
  })

  it("does not apply a price-list change when conversion rates are unavailable", () => {
    const restored = buildCartFromSaleOrderItems(rows, catalog, "USD")
    expect(() => repricePosCart(restored, catalog, () => 9, {})).toThrow("Unable to convert")
    expect(restored[0].cartPrice).toBe(10)
  })

  it("requires the host and modifier reference to belong to the selected tenant/order/product", async () => {
    const db = client()
    await resolveExistingCheckoutCurrency(params(posCheckoutLines(buildCartFromSaleOrderItems(rows, catalog, "USD")), db))
    expect(db.reads[0].filters).toEqual({ site_id: "site", id: "order" })
    await expect(resolveExistingCheckoutCurrency(params([{ catalogItemId: "usd", quantity: 1, saleOrderItemId: "line-0" }])))
      .rejects.toThrow("does not belong")
    await expect(resolveExistingCheckoutCurrency(params([{ catalogItemId: "eur", quantity: 1, saleOrderItemId: "foreign" }])))
      .rejects.toThrow("does not belong")
    await expect(resolveExistingCheckoutCurrency(params([{ catalogItemId: "eur", quantity: 1,
      modifiers: [{ catalogItemId: "extra", quantity: 1, saleOrderItemId: "line-0" }] }])))
      .rejects.toThrow("modifier price")
  })

  it.each([null, { currency: null }, { currency: "" }])("fails closed on unavailable or invalid existing currency %p", async (order) => {
    await expect(resolveExistingCheckoutCurrency(params([], client(order)))).rejects.toThrow("Unable to verify")
  })

  it("ignores forged client currency fields and disallows references outside existing staff POS", async () => {
    const lines = [{ catalogItemId: "eur", quantity: 1, unitPriceOverride: 10,
      saleOrderItemId: "line-0", currency: "JPY" }]
    expect(await resolveExistingCheckoutCurrency(params(lines))).toEqual({ currency: "USD" })
    await expect(resolveExistingCheckoutCurrency({ ...params(lines), isStaffCheckout: false })).rejects.toThrow("existing POS")
    await expect(resolveExistingCheckoutCurrency({ ...params(lines), effectiveExistingOrderId: undefined })).rejects.toThrow("existing POS")
    const db = client()
    expect(await resolveExistingCheckoutCurrency({ ...params([{ catalogItemId: "eur", quantity: 1 }], db),
      effectiveExistingOrderId: undefined })).toBeUndefined()
    expect(db.from).not.toHaveBeenCalled()
  })
})