/** @jest-environment node */
import { getSubscriptions } from "@/app/subscriptions/actions"
import { createClient } from "@/lib/supabase/server"
import { invoiceBalances, isOutstandingInvoice } from "@/app/subscriptions/invoice-summary"

jest.mock("server-only", () => ({}))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const siteId = "11111111-1111-4111-8111-111111111111"

describe("subscription outstanding invoice summary", () => {
  beforeEach(() => jest.clearAllMocks())

  it("includes only positive, collectible balances", () => {
    expect(isOutstandingInvoice({ status: "pending", amountDue: 25 })).toBe(true)
    expect(isOutstandingInvoice({ status: "completed", amountDue: 25 })).toBe(true)
    for (const status of ["cancelled", "refunded", "draft"]) {
      expect(isOutstandingInvoice({ status, amountDue: 25 })).toBe(false)
    }
    for (const amountDue of [0, -25, NaN, Infinity]) {
      expect(isOutstandingInvoice({ status: "pending", amountDue })).toBe(false)
    }
  })

  it("keeps outstanding totals separate by currency", () => {
    const base = { id: "invoice", title: "Invoice", invoiceNumber: null }
    expect(invoiceBalances([
      { ...base, amountDue: 25, currency: "USD" },
      { ...base, amountDue: 50, currency: "USD" },
      { ...base, amountDue: 30, currency: "EUR" },
    ])).toEqual([{ currency: "USD", amount: 75 }, { currency: "EUR", amount: 30 }])
  })

  it("loads invoice summaries with subscriptions without a per-row query", async () => {
    const base = { site_id: siteId, title: "Invoice", invoice_number: "INV-1", currency: "USD" }
    const query = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [{ id: "sub", invoices: [
        { ...base, id: "partial", status: "pending", amount_due: "25" },
        { ...base, id: "cancelled", status: "cancelled", amount_due: "50" },
        { ...base, id: "paid", status: "completed", amount_due: "0" },
        { ...base, id: "foreign", site_id: "other-site", status: "pending", amount_due: "10" },
      ] }, { id: "empty", invoices: [] }], error: null }),
    }
    const client = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "actor" } }, error: null }) },
      rpc: jest.fn().mockResolvedValue({ data: "owner", error: null }), from: jest.fn(() => query),
    }
    jest.mocked(createClient).mockResolvedValue(client)
    expect(await getSubscriptions(siteId)).toEqual({ data: [
      { id: "sub", pendingInvoices: [{ id: "partial", title: "Invoice", invoiceNumber: "INV-1", amountDue: 25, currency: "USD" }] },
      { id: "empty", pendingInvoices: [] },
    ] })
    expect(client.from).toHaveBeenCalledTimes(1)
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining("sales!sales_subscription_id_fkey"))
    expect(query.eq).toHaveBeenCalledWith("site_id", siteId)
  })

  it("returns an access error instead of a misleading empty success", async () => {
    const client = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: jest.fn(),
    }
    jest.mocked(createClient).mockResolvedValue(client)
    expect(await getSubscriptions(siteId)).toEqual({ data: [], error: "Unable to access subscriptions" })
    expect(client.from).not.toHaveBeenCalled()
  })
})