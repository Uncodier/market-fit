import { consolidateReceivables, filterReceivables, receivableStatus, receivableTotals, type ReceivableInvoice } from "@/app/accounts-receivable/summary"

const siteId = "site"
const lead = { id: "lead", site_id: siteId, name: "Avery", email: "avery@example.test", phone: "555123" }
const invoice = (changes: Partial<ReceivableInvoice> = {}): ReceivableInvoice => ({
  id: "invoice", site_id: siteId, lead_id: lead.id, lead, amount_due: 100, currency: "USD",
  status: "pending", sale_date: "2026-10-01", due_date: "2026-10-10",
  created_at: "2026-10-01T00:00:00Z", updated_at: null, orders: [], ...changes,
})

describe("accounts receivable consolidation", () => {
  it("consolidates all open invoices per lead, including completed sales with a remaining balance", () => {
    const result = consolidateReceivables([invoice(), invoice({ id: "subscription-invoice", status: "completed", amount_due: "25.50" })], siteId)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ leadId: lead.id, invoiceCount: 2, balances: [{ currency: "USD", amount: 125.5 }] })
  })

  it("excludes settled, cancelled, refunded, malformed, anonymous, and foreign-site invoices", () => {
    const rows = [invoice({ amount_due: 0 }), invoice({ status: "cancelled" }), invoice({ status: "refunded" }),
      invoice({ amount_due: -1 }), invoice({ amount_due: "NaN" }), invoice({ amount_due: Infinity }),
      invoice({ lead: null }), invoice({ site_id: "foreign" }), invoice({ lead: { ...lead, site_id: "foreign" } }),
      invoice({ lead_id: "another-lead" })]
    expect(consolidateReceivables(rows, siteId)).toEqual([])
  })

  it.each(["pending", "completed"])("keeps %s sales on pending and completed orders in the default view", status => {
    const accounts = consolidateReceivables([
      invoice({ id: "pending-order", status, orders: [{ site_id: siteId, status: "pending" }] }),
      invoice({ id: "completed-order", status, orders: [{ site_id: siteId, status: "completed" }] }),
      invoice({ id: "no-order", status }),
      invoice({ id: "cancelled-order", status, orders: [{ site_id: siteId, status: "cancelled" }] }),
    ], siteId)
    expect(accounts[0]).toMatchObject({ invoiceCount: 3, balances: [{ currency: "USD", amount: 300 }] })
  })

  it("separates a mixed customer's invoice counts, currencies, dates and totals before consolidation", () => {
    const rows = [invoice(),
      invoice({ id: "cancelled-order", orders: [{ site_id: siteId, status: "cancelled" }], currency: "MXN", amount_due: 280,
        due_date: "2026-08-01", sale_date: "2026-07-01", created_at: "2026-10-13T00:00:00Z" })]
    const active = consolidateReceivables(rows, siteId)
    const cancelled = consolidateReceivables(rows, siteId, "cancelled")
    expect(active[0]).toMatchObject({ invoiceCount: 1, earliestDueDate: "2026-10-10", oldestInvoiceDate: "2026-10-01", createdAt: "2026-10-01T00:00:00Z" })
    expect(receivableTotals(active)).toEqual([{ currency: "USD", amount: 100 }])
    expect(cancelled[0]).toMatchObject({ invoiceCount: 1, earliestDueDate: "2026-08-01", oldestInvoiceDate: "2026-07-01", createdAt: "2026-10-13T00:00:00Z" })
    expect(receivableTotals(cancelled)).toEqual([{ currency: "MXN", amount: 280 }])
    expect(filterReceivables(cancelled, "cancelled_orders", "avery", "newest", "2026-10-14")).toEqual(cancelled)
  })

  it("does not classify a foreign-site order as this site's cancellation or duplicate an invoice with multiple orders", () => {
    const rows = [invoice({ orders: [{ site_id: "foreign", status: "cancelled" }, { site_id: siteId, status: "completed" }] })]
    expect(consolidateReceivables(rows, siteId)[0].invoiceCount).toBe(1)
    expect(consolidateReceivables(rows, siteId, "cancelled")).toEqual([])
  })

  it("does not restore cancelled or refunded sales or paid invoices in the cancelled-orders view", () => {
    const orders = [{ site_id: siteId, status: "cancelled" }]
    expect(consolidateReceivables([invoice({ orders, status: "cancelled" }),
      invoice({ orders, status: "refunded" }), invoice({ orders, amount_due: 0 })], siteId, "cancelled")).toEqual([])
  })

  it("keeps currencies separate per lead and in totals, without assuming a currency", () => {
    const accounts = consolidateReceivables([invoice(), invoice({ id: "eur", currency: "EUR", amount_due: 20 }),
      invoice({ id: "unknown", currency: null, amount_due: 5 }), invoice({ id: "malformed", currency: "bad!", amount_due: 3 }),
      invoice({ id: "second", lead_id: "second", lead: { ...lead, id: "second" }, amount_due: 10 })], siteId)
    expect(accounts).toHaveLength(2)
    expect(receivableTotals(accounts)).toEqual([
      { currency: "USD", amount: 110 }, { currency: "EUR", amount: 20 }, { currency: "Unknown", amount: 8 },
    ])
  })

  it("uses the earliest valid due and invoice dates and the latest invoice update", () => {
    const accounts = consolidateReceivables([invoice(), invoice({ id: "oldest", due_date: "2026-09-30", sale_date: "2026-09-01", updated_at: "2026-10-14T12:00:00Z" }),
      invoice({ id: "invalid", due_date: "2026-02-30", sale_date: "bad" }), invoice({ id: "no-date", due_date: null })], siteId)
    expect(accounts[0]).toMatchObject({ earliestDueDate: "2026-09-30", oldestInvoiceDate: "2026-09-01", updatedAt: "2026-10-14T12:00:00Z" })
    expect(receivableStatus(accounts[0], "2026-10-14")).toBe("overdue")
    expect(receivableStatus({ ...accounts[0], earliestDueDate: "2026-10-14" }, "2026-10-14")).toBe("current")
    expect(receivableStatus({ ...accounts[0], earliestDueDate: null }, "2026-10-14")).toBe("no_due_date")
  })

  it("deduplicates invoices and filters/searches/sorts consolidated accounts", () => {
    const accounts = consolidateReceivables([invoice(), invoice(), invoice({ id: "new", lead_id: "new", lead: { ...lead, id: "new", name: "Blair" },
      created_at: "2026-10-13T00:00:00Z", due_date: "2026-10-20" })], siteId)
    expect(accounts[0].invoiceCount).toBe(1)
    expect(filterReceivables(accounts, "overdue", "", "newest", "2026-10-14").map(a => a.name)).toEqual(["Avery"])
    expect(filterReceivables(accounts, "all", "  BLAIR  ", "newest", "2026-10-14").map(a => a.name)).toEqual(["Blair"])
    expect(filterReceivables(accounts, "all", "555123", "oldest", "2026-10-14").map(a => a.name)).toEqual(["Avery", "Blair"])
    expect(filterReceivables(accounts, "all", "example.test", "newest", "2026-10-14").map(a => a.name)).toEqual(["Blair", "Avery"])
  })
})