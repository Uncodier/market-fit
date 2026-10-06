/** @jest-environment node */
import { getLeadOpenInvoices, registerLeadInvoicePayment } from "@/app/leads/payment-actions"
import { requireAccountingAccess } from "@/app/accounting/access"
import { tryUpsertPolizaForSale } from "@/app/accounting/ensure"
import { fulfillLinkedOrderAfterPayment } from "@/app/commerce/order-fulfillment-sync"
import { revalidatePath } from "next/cache"

jest.mock("@/app/accounting/access", () => ({ requireAccountingAccess: jest.fn() }))
jest.mock("@/app/accounting/ensure", () => ({ tryUpsertPolizaForSale: jest.fn() }))
jest.mock("@/app/commerce/order-fulfillment-sync", () => ({ fulfillLinkedOrderAfterPayment: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

const siteId = "11111111-1111-4111-8111-111111111111"
const leadId = "22222222-2222-4222-8222-222222222222"
const input = { siteId, leadId, requestId: "33333333-3333-4333-8333-333333333333", version: "a".repeat(32), currency: "USD", mode: "partial" as const, amount: 50, method: "cash", notes: "received" }
const payment = { requestId: input.requestId, amount: 50, currency: "USD", allocations: [
  { invoiceId: "sale1", amount: 30, amountDue: 0, previousStatus: "pending", status: "completed" },
  { invoiceId: "sale2", amount: 20, amountDue: 30, previousStatus: "pending", status: "pending" },
] }

describe("lead invoice payment actions", () => {
  let client: { rpc: jest.Mock; from: jest.Mock }
  beforeEach(() => {
    jest.clearAllMocks()
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { user_id: "trusted-creator", status: "completed", amount_due: 0 } }) }
    client = { rpc: jest.fn().mockResolvedValue({ data: payment, error: null }), from: jest.fn().mockReturnValue(query) }
    jest.mocked(requireAccountingAccess).mockResolvedValue(client as never)
    jest.mocked(tryUpsertPolizaForSale).mockResolvedValue(undefined)
    jest.mocked(fulfillLinkedOrderAfterPayment).mockResolvedValue(undefined)
  })
  it("loads an authorized lead-scoped snapshot without site-wide pagination", async () => {
    const snapshot = { invoices: [], version: input.version }
    client.rpc.mockResolvedValue({ data: snapshot })
    expect(await getLeadOpenInvoices(siteId, leadId)).toEqual({ snapshot })
    expect(requireAccountingAccess).toHaveBeenCalledWith(siteId, "update")
    expect(client.rpc).toHaveBeenCalledWith("lead_open_invoice_snapshot", { p_site_id: siteId, p_lead_id: leadId })
  })
  it("validates IDs and amounts before touching the database", async () => {
    expect(await getLeadOpenInvoices("bad", leadId)).toHaveProperty("error")
    expect(await registerLeadInvoicePayment({ ...input, amount: -1 })).toHaveProperty("error")
    expect(requireAccountingAccess).not.toHaveBeenCalled()
    expect(client.rpc).not.toHaveBeenCalled()
  })
  it("fails closed when an invoice has missing currency or malformed balances", async () => {
    client.rpc.mockResolvedValue({ data: { version: input.version, invoices: [{ id: leadId, currency: null, amountDue: 10 }] } })
    expect((await getLeadOpenInvoices(siteId, leadId)).error).toMatch(/require review/)
  })
  it("does not write when unauthenticated, view-only or cross-site authorization fails", async () => {
    jest.mocked(requireAccountingAccess).mockRejectedValue(new Error("Not authorized"))
    expect(await registerLeadInvoicePayment(input)).toHaveProperty("error")
    expect(client.rpc).not.toHaveBeenCalled()
    expect(await getLeadOpenInvoices(siteId, leadId)).toHaveProperty("error")
  })
  it("uses one transactional RPC and server-selected allocation/creator for effects", async () => {
    expect(await registerLeadInvoicePayment(input)).toEqual({ payment })
    expect(client.rpc).toHaveBeenCalledWith("record_lead_invoice_payment", {
      p_site_id: siteId, p_lead_id: leadId, p_request_id: input.requestId, p_version: input.version,
      p_currency: "USD", p_mode: "partial", p_amount: 50, p_method: "cash", p_notes: "received",
    })
    expect(fulfillLinkedOrderAfterPayment).toHaveBeenCalledTimes(1)
    expect(fulfillLinkedOrderAfterPayment).toHaveBeenCalledWith({ supabase: client, siteId, saleId: "sale1", leadId, userId: "trusted-creator" })
    expect(tryUpsertPolizaForSale).toHaveBeenCalledTimes(2)
    expect(revalidatePath).toHaveBeenCalledWith(`/leads/${leadId}`)
  })
  it("ignores the client amount for full settlement", async () => {
    await registerLeadInvoicePayment({ ...input, mode: "full", amount: 1 })
    expect(client.rpc.mock.calls[0][1].p_amount).toBeNull()
  })
  it("returns safe stale and deployment errors without performing secondary writes", async () => {
    client.rpc.mockResolvedValueOnce({ error: { code: "40001", message: "private database data" } })
    expect((await registerLeadInvoicePayment(input)).error).toMatch(/balances changed/)
    client.rpc.mockResolvedValueOnce({ error: { code: "PGRST202" } })
    expect((await getLeadOpenInvoices(siteId, leadId)).error).toMatch(/migration/)
    expect(tryUpsertPolizaForSale).not.toHaveBeenCalled()
  })
  it("keeps a committed payment successful even if secondary effects fail", async () => {
    jest.mocked(fulfillLinkedOrderAfterPayment).mockRejectedValue(new Error("temporary failure"))
    const result = await registerLeadInvoicePayment(input)
    expect(result.payment).toEqual(payment)
    expect(result.warning).toMatch(/Payment recorded/)
    expect(result.error).toBeUndefined()
  })
  it("makes ambiguous transport failure retryable without inventing a new request", async () => {
    client.rpc.mockRejectedValueOnce(new Error("network disconnected"))
    expect((await registerLeadInvoicePayment(input)).error).toMatch(/same payment details/)
    await registerLeadInvoicePayment(input)
    expect(client.rpc.mock.calls.map(call => call[1].p_request_id)).toEqual([input.requestId, input.requestId])
  })
})