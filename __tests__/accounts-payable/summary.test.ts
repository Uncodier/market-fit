import { consolidatePayables, filterPayables, payableStatus, payableTotals, type PayableInvoice } from "@/app/accounts-payable/summary"

const siteId = "site"
const vendor = { id: "vendor", name: "Supplier", email: "supplier@example.test" }
const invoice = (changes: Partial<PayableInvoice> = {}): PayableInvoice => ({
  id: "bill", site_id: siteId, vendor_company_id: vendor.id, vendor, title: "Stock",
  amount_due: 100, currency: "USD", status: "pending", purchase_date: "2026-10-01",
  due_date: "2026-10-10", created_at: "2026-10-01T00:00:00Z", updated_at: null, ...changes,
})

describe("accounts payable consolidation", () => {
  it("reuses receivable grouping for global suppliers and completed purchases with balances", () => {
    const accounts = consolidatePayables([invoice(), invoice({ id: "second", status: "completed", amount_due: "25.50" })], siteId)
    expect(accounts).toHaveLength(1)
    expect(accounts[0]).toMatchObject({ vendorId: vendor.id, invoiceCount: 2,
      balances: [{ currency: "USD", amount: 125.5 }], bills: [{ id: "bill", title: "Stock" }, { id: "second", title: "Stock" }] })
  })

  it("excludes drafts, settled, invalid, missing-vendor and foreign purchases", () => {
    expect(consolidatePayables([invoice({ status: "draft" }), invoice({ status: "cancelled" }),
      invoice({ amount_due: 0 }), invoice({ amount_due: -1 }), invoice({ amount_due: "NaN" }),
      invoice({ amount_due: Infinity }), invoice({ vendor: null }), invoice({ vendor_company_id: "other" }),
      invoice({ site_id: "foreign" })], siteId)).toEqual([])
  })

  it("isolates cancelled bills from active balances", () => {
    const rows = [invoice(), invoice({ id: "cancelled", status: "cancelled", amount_due: 20 })]
    expect(consolidatePayables(rows, siteId)[0].balances[0].amount).toBe(100)
    expect(consolidatePayables(rows, siteId, "cancelled")[0]).toMatchObject({ invoiceCount: 1,
      balances: [{ currency: "USD", amount: 20 }], bills: [{ id: "cancelled", title: "Stock" }] })
  })

  it("deduplicates invoices and keeps currencies separate without assuming USD", () => {
    const accounts = consolidatePayables([invoice(), invoice(), invoice({ id: "eur", currency: "EUR", amount_due: 50 }),
      invoice({ id: "unknown", currency: null, amount_due: 10 })], siteId)
    expect(accounts[0].invoiceCount).toBe(3)
    expect(accounts[0].bills).toHaveLength(3)
    expect(payableTotals(accounts)).toEqual([{ currency: "USD", amount: 100 }, { currency: "EUR", amount: 50 }, { currency: "Unknown", amount: 10 }])
  })

  it("preserves local date-only aging, search and filters", () => {
    const accounts = consolidatePayables([invoice(), invoice({ id: "older", due_date: "2026-10-02", purchase_date: "2026-09-01" })], siteId)
    expect(accounts[0]).toMatchObject({ earliestDueDate: "2026-10-02", oldestInvoiceDate: "2026-09-01" })
    expect(payableStatus(accounts[0], "2026-10-03")).toBe("overdue")
    expect(payableStatus(accounts[0], "2026-10-02")).toBe("current")
    expect(filterPayables(accounts, "overdue", "SUPPLIER@", "newest", "2026-10-03")).toEqual(accounts)
    expect(filterPayables(accounts, "current", "", "newest", "2026-10-03")).toEqual([])
    const undated = consolidatePayables([invoice({ due_date: "invalid" })], siteId)
    expect(payableStatus(undated[0], "2026-10-03")).toBe("no_due_date")
  })

  it("labels unnamed suppliers and applies the same created/updated sorting", () => {
    const accounts = consolidatePayables([invoice({ vendor: { ...vendor, name: "" } }),
      invoice({ id: "new", vendor_company_id: "new-vendor", vendor: { ...vendor, id: "new-vendor" },
        created_at: "2026-10-02T00:00:00Z" })], siteId)
    expect(accounts[0].name).toBe("Unknown supplier")
    expect(filterPayables(accounts, "all", "", "oldest", "2026-10-03").map(account => account.vendorId)).toEqual([vendor.id, "new-vendor"])
    expect(filterPayables(accounts, "all", "", "updated_at", "2026-10-03")[0].vendorId).toBe("new-vendor")
  })
})