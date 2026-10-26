/** @jest-environment node */
import { loadCheckoutCatalogItems, loadCheckoutResolvedPrices } from "@/app/commerce/checkout-line-reads"
import { processCheckoutLines } from "@/app/commerce/checkout-lines"
import { resolveUnitPrice } from "@/app/price-lists/actions"
import { assertCommerceReservationSlot } from "@/app/commerce/pass-round-robin-server"
import { loadSelfServicePricing } from "@/app/commerce/self-service-pricing"
import { revalidateCheckoutAvailability } from "@/app/commerce/checkout-availability"
import type { CheckoutLine } from "@/app/commerce/checkout-types"

jest.mock("server-only", () => ({}))
jest.mock("@/app/price-lists/actions", () => ({ resolveUnitPrice: jest.fn() }))
jest.mock("@/app/commerce/checkout-availability", () => ({
  revalidateCheckoutAvailability: jest.fn(), allocateCheckoutBackorders: (lines: unknown) => lines,
}))
jest.mock("@/app/catalog/tax-actions", () => ({ getTaxesByCatalogItemIds: jest.fn().mockResolvedValue({ data: {} }) }))
jest.mock("@/app/commerce/pass-round-robin-server", () => ({ assertCommerceReservationSlot: jest.fn() }))
jest.mock("@/app/commerce/self-service-pricing", () => ({ loadSelfServicePricing: jest.fn() }))
jest.mock("@/app/lib/fx-rates", () => ({ getUsdFxRates: jest.fn().mockResolvedValue({ rates: { EUR: 0.5 } }) }))

type Row = { id: string; site_id: string; [key: string]: unknown }
function client(rows: Row[], error: unknown = null, rowLimit = Infinity) {
  const reads: { siteId?: string; ids: string[]; fields: string }[] = []
  return { reads, from: jest.fn((table: string) => {
    expect(table).toBe("catalog_items")
    const read = { siteId: undefined as string | undefined, ids: [] as string[], fields: "" }
    let singleId: string | undefined
    const query = {
      select: (fields: string) => { read.fields = fields; return query },
      eq: (key: string, value: string) => {
        if (key === "id") singleId = value
        else { expect(key).toBe("site_id"); read.siteId = value }
        return query
      },
      single: async () => ({ data: rows.find((row) => row.id === singleId && row.site_id === read.siteId) || null }),
      in: async (key: string, ids: string[]) => {
        expect(key).toBe("id")
        read.ids = ids
        reads.push(read)
        return { data: rows.filter((row) => row.site_id === read.siteId && ids.includes(row.id)).slice(0, rowLimit), error }
      },
    }
    return query
  }) }
}
const item = (id: string, extra: Record<string, unknown> = {}): Row => ({
  id, site_id: "site", name: id, kind: "product", currency: "USD", target_sale_price: 10, ...extra,
})
function params(lines: CheckoutLine[], db = client([item("a"), item("b")])) {
  return { supabase: db, supabaseAdmin: db, siteId: "site", lines, isAdmin: false,
    isStaffCheckout: true, siteSettings: { currency: "USD" }, priceListChannel: "pos", fulfillment: "none" as const }
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(resolveUnitPrice).mockResolvedValue({ price: 10, priceListId: undefined })
  jest.mocked(revalidateCheckoutAvailability).mockResolvedValue(null)
})

it("batches and deduplicates host/modifier IDs in tenant-scoped bounded chunks", async () => {
  const rows = Array.from({ length: 205 }, (_, index) => item(`${index}`))
  const db = client([...rows, item("foreign", { site_id: "other" })])
  const lines = rows.map((row) => ({ catalogItemId: row.id, quantity: 1,
    modifiers: [{ catalogItemId: "0", quantity: 1 }] }))
  const result = await loadCheckoutCatalogItems(db, "site", [...lines, { catalogItemId: "foreign", quantity: 1 }])
  expect(result.size).toBe(205)
  expect(result.has("foreign")).toBe(false)
  expect(db.reads.map((read) => read.ids.length)).toEqual([100, 100, 6])
  expect(db.reads.every((read) => read.siteId === "site")).toBe(true)
})

it("does no empty-cart reads and recovers individual metadata when a batch fails", async () => {
  const db = client([])
  expect((await loadCheckoutCatalogItems(db, "site", [])).size).toBe(0)
  expect(db.from).not.toHaveBeenCalled()
  const result = await loadCheckoutCatalogItems(client([item("a")], { message: "private error" }), "site",
    [{ catalogItemId: "a", quantity: 1 }, { catalogItemId: "missing", quantity: 1 }])
  expect(result.get("a")?.name).toBe("a")
  expect(result.has("missing")).toBe(false)
})

it("recovers rows omitted by a server row cap rather than skipping reservation metadata", async () => {
  const db = client([item("a"), item("b", { is_reservation: true })], null, 1)
  const result = await loadCheckoutCatalogItems(db, "site", [
    { catalogItemId: "a", quantity: 1 }, { catalogItemId: "b", quantity: 1 },
  ])
  expect(result.get("b")?.is_reservation).toBe(true)
})

it.each([false, true])("retains the authorized metadata client selection for isAdmin=%s", async (isAdmin) => {
  const user = client([item("a")])
  const admin = client([item("a")])
  await processCheckoutLines({ ...params([{ catalogItemId: "a", quantity: 1 }], user), supabaseAdmin: admin, isAdmin })
  expect((isAdmin ? admin : user).from).toHaveBeenCalled()
  expect((isAdmin ? user : admin).from).not.toHaveBeenCalled()
})

it("resolves each non-overridden SKU once, concurrently but with at most eight reads", async () => {
  let active = 0
  let maximum = 0
  jest.mocked(resolveUnitPrice).mockImplementation(async () => {
    active++
    maximum = Math.max(maximum, active)
    await new Promise((resolve) => setTimeout(resolve, 1))
    active--
    return { price: 12, priceListId: undefined }
  })
  const lines = Array.from({ length: 25 }, (_, index) => ({ catalogItemId: `${index}`, quantity: 1,
    modifiers: [{ catalogItemId: "0", quantity: 1 }, { catalogItemId: "override", quantity: 1, unitPriceOverride: 0 }] }))
  const request = { siteId: "site", lines, isAdmin: true, finalPriceListId: "list", priceListChannel: "pos" as const }
  expect((await loadCheckoutResolvedPrices(request)).size).toBe(25)
  expect(resolveUnitPrice).toHaveBeenCalledTimes(25)
  expect(resolveUnitPrice).toHaveBeenCalledWith("site", "0", "list", true, "pos")
  expect(maximum).toBe(8)
  await loadCheckoutResolvedPrices(request)
  expect(resolveUnitPrice).toHaveBeenCalledTimes(50)
})

it("keeps per-occurrence zero/different overrides, modifier multiplication, and line order", async () => {
  const result = await processCheckoutLines(params([
    { catalogItemId: "a", quantity: 2, unitPriceOverride: 0, modifiers: [
      { catalogItemId: "b", quantity: 3, groupId: "one" },
      { catalogItemId: "b", quantity: 1, unitPriceOverride: 2, groupId: "two" },
    ] },
    { catalogItemId: "a", quantity: 1, unitPriceOverride: 5 },
    { catalogItemId: "a", quantity: 1 },
  ]))
  expect(result.processedLines.map((line) => [line.catalog_item_id, line.quantity, line.unit_price]))
    .toEqual([["a", 2, 0], ["b", 6, 10], ["b", 2, 2], ["a", 1, 5], ["a", 1, 10]])
  expect(result.orderSubtotal).toBe(79)
  expect(result.processedLines.map((line) => line.client_line_key))
    .toEqual(["a:0", "a:0:mod:one:b", "a:0:mod:two:b", "a:3", "a:4"])
  expect(resolveUnitPrice).toHaveBeenCalledTimes(2)
})

it.each(["shop", "marketplace"])("keeps authoritative %s prices, currencies, taxes and fallback without resolver calls", async (channel) => {
  jest.mocked(loadSelfServicePricing).mockResolvedValue({
    priceByItemId: new Map([["a", 5]]), currencyBySiteId: new Map([["site", "EUR"]]),
    listIdBySiteId: new Map(), taxesByItem: {},
  })
  const db = client([item("a"), item("b", { currency: "EUR", target_sale_price: 3 })])
  const result = await processCheckoutLines({ ...params([
    { catalogItemId: "a", quantity: 2, unitPriceOverride: 999, modifiers: [
      { catalogItemId: "b", quantity: 2, unitPriceOverride: 999 },
    ] },
  ], db), publicCheckout: true, priceListChannel: channel })
  expect(result.orderSubtotal).toBe(22)
  expect(result.orderCurrency).toBe("EUR")
  expect(resolveUnitPrice).not.toHaveBeenCalled()
  expect(db.reads).toHaveLength(1)
})

it.each([-1, Infinity, "invalid"])("rejects invalid public fallback %s", async (price) => {
  jest.mocked(loadSelfServicePricing).mockResolvedValue({
    priceByItemId: new Map(), currencyBySiteId: new Map(), listIdBySiteId: new Map(), taxesByItem: {},
  })
  await expect(processCheckoutLines({ ...params([{ catalogItemId: "a", quantity: 1 }],
    client([item("a", { target_sale_price: price })])), selfServiceLocationId: "location" }))
    .rejects.toThrow("Unable to verify item price.")
})

it("batches parent modes while validating every reservation in input order", async () => {
  const db = client([item("a", { is_reservation: true, parent_id: "parent", parent: { name: "Parent" } }),
    item("parent", { redeem_assignment_mode: "round_robin" })])
  const lines = [1, 2].map((quantity) => ({ catalogItemId: "a", quantity,
    reservationStart: "2026-01-01T10:00:00Z", reservationEnd: "2026-01-01T11:00:00Z" }))
  const result = await processCheckoutLines({ ...params(lines, db), finalLeadId: "lead", existingReservationId: "reservation" })
  expect(db.reads.map((read) => read.ids)).toEqual([["a"], ["parent"]])
  expect(result.processedLines.every((line) => line.isRoundRobinDropin && line.parent_name === "Parent")).toBe(true)
  expect(jest.mocked(assertCommerceReservationSlot).mock.calls.map(([call]) => call.quantity)).toEqual([1, 2])
  expect(assertCommerceReservationSlot).toHaveBeenCalledWith(expect.objectContaining({
    isAdmin: true, ignoreReservationId: "reservation", catalogItem: expect.objectContaining({ redeem_assignment_mode: "round_robin" }),
  }))
})

it("keeps reservation date/customer guards and recurring access exemptions", async () => {
  const db = client([item("a", { is_reservation: true })])
  await expect(processCheckoutLines(params([{ catalogItemId: "a", quantity: 1 }], db))).rejects.toThrow("Reservation dates")
  await expect(processCheckoutLines({ ...params([{ catalogItemId: "a", quantity: 1 }], db),
    existingReservationId: "linked" })).rejects.toThrow("require a customer")
  const result = await processCheckoutLines(params([{ catalogItemId: "a", quantity: 1 }],
    client([item("a", { is_reservation: true, is_recurring: true, parent_id: "parent" })])))
  expect(result.processedLines[0].is_reservation_dropin).toBe(false)
  expect(assertCommerceReservationSlot).not.toHaveBeenCalled()
})

it("keeps stock/variant rejection ahead of new reads and price resolution", async () => {
  jest.mocked(revalidateCheckoutAvailability).mockRejectedValueOnce(new Error("Item requires variant selection"))
  const db = client([])
  await expect(processCheckoutLines(params([{ catalogItemId: "a", quantity: 1 }], db))).rejects.toThrow("variant selection")
  expect(db.from).not.toHaveBeenCalled()
  expect(resolveUnitPrice).not.toHaveBeenCalled()
})

it("defers preloaded price failures until after the original reservation guards", async () => {
  jest.mocked(resolveUnitPrice).mockRejectedValue(new Error("Price read failed"))
  await expect(processCheckoutLines(params([{ catalogItemId: "a", quantity: 1 }],
    client([item("a", { is_reservation: true })])))).rejects.toThrow("Reservation dates")
  await expect(processCheckoutLines(params([{ catalogItemId: "a", quantity: 1 }]))).rejects.toThrow("Price read failed")
})