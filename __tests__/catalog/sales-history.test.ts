/** @jest-environment node */
import { catalogSaleRows, loadCatalogSalesHistory, type CatalogSaleLine } from "@/app/catalog/load-sales-history"
import { summarizeCatalogSales } from "@/app/catalog/sales-history-types"
import { salesTestClient } from "@/__tests__/app/api/revenue/sales-test-client"
import type { SupabaseClient } from "@supabase/supabase-js"

jest.mock("server-only", () => ({}))
const siteId = "site"
const line = (id: string, extra: Partial<CatalogSaleLine> = {}): CatalogSaleLine => ({
  id, site_id: siteId, catalog_item_id: "item", name: "Cowork", quantity: "2", subtotal: "45.50", status: "pending",
  order: { id: "order", site_id: siteId, order_number: "SO-1", status: "completed", currency: "EUR",
    sale: { id: "sale", site_id: siteId, status: "completed", source: "pos", sale_date: "2026-11-03",
      created_at: "2026-11-02T12:00:00Z", currency: "EUR" } }, ...extra,
})
const convert = (lines: CatalogSaleLine[]) => catalogSaleRows(lines, siteId, "2026-11-01", "2026-11-30")

it("uses persisted line subtotals and unique orders, not whole-order totals", () => {
  const rows = convert([line("a"), line("b")])
  expect(rows[0]).toMatchObject({ revenue: 45.5, quantity: 2, currency: "EUR", date: "2026-11-03T00:00:00.000Z" })
  expect(summarizeCatalogSales(rows)).toEqual({ revenue: 91, units: 4, orders: 1, averagePrice: 22.75,
    trend: [{ date: "2026-11-03", revenue: 91, units: 4 }] })
})

it.each(["cancelled", "refunded", "draft"])("excludes %s orders", status => {
  const row = line("a")
  row.order!.status = status
  expect(convert([row])).toEqual([])
})

it.each(["cancelled", "refunded"])("excludes %s lines", status => {
  expect(convert([line("a", { status })])).toEqual([])
})

it("excludes unpaid and foreign relations defensively", () => {
  const pending = line("a"); pending.order!.sale.status = "pending"
  const foreignOrder = line("b"); foreignOrder.order!.site_id = "foreign"
  const foreignSale = line("c"); foreignSale.order!.sale.site_id = "foreign"
  expect(convert([pending, foreignOrder, foreignSale, line("d", { site_id: "foreign" })])).toEqual([])
})

it("uses sale date with created_at fallback and inclusive UTC boundaries", () => {
  const fallback = line("a"); fallback.order!.sale.sale_date = null
  const outside = line("b"); outside.order!.sale.sale_date = "2026-10-31"
  const end = line("c"); end.order!.sale.sale_date = "2026-11-30T23:59:59Z"
  expect(convert([fallback, outside, end]).map(row => row.id)).toEqual(["c", "a"])
})

it.each([null, "invalid", Infinity])("rejects incomplete amounts (%s) rather than fabricating zero revenue", subtotal => {
  expect(() => convert([line("a", { subtotal })])).toThrow("Invalid sale line amounts")
})

it("rejects conflicting currencies and preserves unknown currency", () => {
  const conflict = line("a"); conflict.order!.sale.currency = "USD"
  expect(() => convert([conflict])).toThrow("Inconsistent sale currency")
  const unknown = line("b"); unknown.order!.currency = null; unknown.order!.sale.currency = null
  expect(convert([unknown])[0].currency).toBe("UNSPECIFIED")
})

it("reads variants and lines with bounded keyset pages and explicit site scope", async () => {
  const first = line("a")
  const variant = line("b", { catalog_item_id: "variant" })
  const client = salesTestClient({ catalog_items: [{ id: "variant", site_id: siteId, parent_id: "item" }],
    sale_order_items: [first, variant].map(row => ({ ...row, "order.site_id": siteId,
      "order.sale.site_id": siteId, "order.sale.status": "completed" })) }, 1)
  const result = await loadCatalogSalesHistory(client as unknown as SupabaseClient, siteId, "item", "2026-11-01", "2026-11-30")
  expect(result.rows).toHaveLength(2)
  expect(result.availableCurrencies).toEqual(["EUR"])
  for (const table of ["catalog_items", "sale_order_items"]) {
    expect(client.calls).toContainEqual({ table, method: "eq", args: ["site_id", siteId] })
  }
  expect(client.calls).toContainEqual({ table: "sale_order_items", method: "in", args: ["catalog_item_id", ["item", "variant"]] })
  expect(client.calls).toContainEqual({ table: "sale_order_items", method: "is", args: ["parent_sale_order_item_id", null] })
})