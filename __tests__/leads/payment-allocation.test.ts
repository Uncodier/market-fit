import { allocateLeadPayment, invoiceTotal, leadInvoicePaymentSchema, type LeadOpenInvoice } from "@/app/leads/payment-allocation"

const invoice = (id: string, amountDue: number, saleDate: string, currency = "USD"): LeadOpenInvoice => ({
  id, amountDue, saleDate, currency, title: id, invoiceNumber: null,
  createdAt: "2026-10-06T10:00:00Z", updatedAt: "2026-10-06T10:00:00Z", status: "pending",
})
const invoices = [invoice("older", 100, "2026-09-01"), invoice("newest", 80, "2026-10-01"), invoice("foreign", 50, "2026-10-05", "MXN")]

describe("lead invoice payment preview", () => {
  it("settles newest invoices first and applies the remainder to the next", () => {
    expect(allocateLeadPayment(invoices, 110, "USD")).toEqual([
      { invoiceId: "newest", amount: 80, amountDue: 0 },
      { invoiceId: "older", amount: 30, amountDue: 70 },
    ])
    expect(invoices[0].id).toBe("older")
  })
  it("settles the total of one currency without mixing balances", () => {
    expect(invoiceTotal(invoices, "USD")).toBe(180)
    expect(allocateLeadPayment(invoices, 180, "USD")).toHaveLength(2)
    expect(allocateLeadPayment(invoices, 50, "MXN")).toEqual([{ invoiceId: "foreign", amount: 50, amountDue: 0 }])
  })
  it("handles cent arithmetic and rejects invalid or excessive amounts", () => {
    expect(allocateLeadPayment([invoice("a", 0.1, "2026-10-01"), invoice("b", 0.2, "2026-10-02")], 0.3, "USD"))
      .toEqual([{ invoiceId: "b", amount: 0.2, amountDue: 0 }, { invoiceId: "a", amount: 0.1, amountDue: 0 }])
    for (const amount of [0, -1, NaN, Infinity, 181]) expect(allocateLeadPayment(invoices, amount, "USD")).toEqual([])
  })
  it("breaks ties deterministically by creation time and invoice ID", () => {
    expect(allocateLeadPayment([invoice("a", 10, "2026-10-01"), invoice("b", 10, "2026-10-01")], 10, "USD")[0].invoiceId).toBe("b")
  })
})

describe("lead invoice payment validation", () => {
  const input = {
    siteId: "11111111-1111-4111-8111-111111111111", leadId: "22222222-2222-4222-8222-222222222222",
    requestId: "33333333-3333-4333-8333-333333333333", version: "a".repeat(32),
    currency: "USD", mode: "partial", amount: 12.34, method: "cash", notes: " Received ",
  }
  it("validates and normalizes a receipt", () => {
    expect(leadInvoicePaymentSchema.parse(input).notes).toBe("Received")
    expect(leadInvoicePaymentSchema.safeParse({ ...input, mode: "full", amount: undefined }).success).toBe(true)
  })
  it.each([undefined, 0, -1, NaN, Infinity, 12.345])("rejects invalid partial amount %s", amount => {
    expect(leadInvoicePaymentSchema.safeParse({ ...input, amount }).success).toBe(false)
  })
  it.each([{ siteId: "demo-test" }, { leadId: "foreign" }, { requestId: "bad" }, { version: "bad" }, { currency: "usd" }, { method: "forged" }, { notes: "x".repeat(2001) }])("rejects malformed input %s", change => {
    expect(leadInvoicePaymentSchema.safeParse({ ...input, ...change }).success).toBe(false)
  })
})