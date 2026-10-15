/** @jest-environment node */
import { getAccountsReceivable } from "@/app/accounts-receivable/actions"
import { requireAccountingAccess } from "@/app/accounting/access"

jest.mock("@/app/accounting/access", () => ({ requireAccountingAccess: jest.fn() }))
const siteId = "11111111-1111-4111-8111-111111111111"
const leadId = "22222222-2222-4222-8222-222222222222"
const invoice = (id: string) => ({ id, site_id: siteId, lead_id: leadId, amount_due: "12.50", currency: "USD", status: "completed",
  due_date: "2026-10-10", sale_date: "2026-10-01", created_at: "2026-10-01T00:00:00Z", updated_at: null,
  lead: { id: leadId, site_id: siteId, name: "Avery", email: null, phone: null },
  orders: [] as { site_id: string; status: string }[] })

describe("accounts receivable server boundary", () => {
  const from = jest.fn()
  let query: Record<string, jest.Mock>
  let responses: { data?: ReturnType<typeof invoice>[]; error?: { message: string } }[]
  beforeEach(() => {
    jest.clearAllMocks()
    responses = [{ data: [invoice("a"), invoice("b")] }, { data: [] }]
    query = Object.fromEntries(["select", "eq", "in", "gt", "order", "range"].map(name => [name, jest.fn().mockReturnThis()]))
    from.mockImplementation(() => Object.assign(query, {
      then: (resolve: (result: typeof responses[number]) => unknown) => Promise.resolve(responses.shift()!).then(resolve),
    }))
    jest.mocked(requireAccountingAccess).mockResolvedValue({ from } as never)
  })

  it("validates the site before requesting access", async () => {
    expect(await getAccountsReceivable("invalid")).toHaveProperty("error", "Invalid accounts receivable request")
    expect(requireAccountingAccess).not.toHaveBeenCalled()
  })

  it("validates the order filter before requesting access", async () => {
    expect(await getAccountsReceivable(siteId, "all" as never)).toEqual({ data: [], error: "Invalid accounts receivable request" })
    expect(requireAccountingAccess).not.toHaveBeenCalled()
  })

  it.each(["Authentication required", "Not authorized", "Foreign site"])("denies %s without reading invoices", async message => {
    jest.mocked(requireAccountingAccess).mockRejectedValue(new Error(message))
    expect(await getAccountsReceivable(siteId)).toEqual({ data: [], error: "Unable to access accounts receivable" })
    expect(from).not.toHaveBeenCalled()
  })

  it("uses authorized RLS reads, filters both tenant relationships and reads beyond the first page", async () => {
    const result = await getAccountsReceivable(siteId)
    expect(result.data[0]).toMatchObject({ invoiceCount: 2, balances: [{ currency: "USD", amount: 25 }] })
    expect(requireAccountingAccess).toHaveBeenCalledWith(siteId)
    expect(from).toHaveBeenCalledWith("sales")
    expect(query.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(query.eq).toHaveBeenCalledWith("lead.site_id", siteId)
    expect(query.eq).toHaveBeenCalledWith("orders.site_id", siteId)
    expect(query.in).toHaveBeenCalledWith("status", ["pending", "completed"])
    expect(query.gt).toHaveBeenCalledWith("amount_due", 0)
    expect(query.gt).toHaveBeenCalledWith("id", "b")
    expect(query.range).toHaveBeenCalledWith(0, 499)
    expect(from).toHaveBeenCalledTimes(2)
    expect(query.select.mock.calls[0][0]).not.toContain("*")
    expect(query.select.mock.calls[0][0]).toContain("orders:sale_orders!sale_orders_sale_id_fkey(site_id, status)")
    expect(query.select.mock.calls[0][0]).not.toContain("sale_orders!inner")
  })

  it.each([undefined, "active", "cancelled"] as const)("separates cancelled-order invoices for the %s scope", async scope => {
    responses = [{ data: [invoice("a"), { ...invoice("b"), orders: [{ site_id: siteId, status: "cancelled" }], amount_due: "40" }] }, { data: [] }]
    const result = await getAccountsReceivable(siteId, scope)
    expect(result.data[0]).toMatchObject({ invoiceCount: 1,
      balances: [{ currency: "USD", amount: scope === "cancelled" ? 40 : 12.5 }] })
  })

  it("keeps paginating when the first page only contains cancelled-order invoices", async () => {
    responses = [{ data: [{ ...invoice("a"), orders: [{ site_id: siteId, status: "cancelled" }] }] },
      { data: [invoice("b")] }, { data: [] }]
    expect((await getAccountsReceivable(siteId)).data[0]).toMatchObject({ invoiceCount: 1, balances: [{ currency: "USD", amount: 12.5 }] })
    expect(from).toHaveBeenCalledTimes(3)
  })

  it("continues after short provider pages, rather than treating the provider row cap as completion", async () => {
    responses = [{ data: [invoice("a")] }, { data: [invoice("b")] }, { data: [] }]
    expect((await getAccountsReceivable(siteId)).data[0].invoiceCount).toBe(2)
    expect(from).toHaveBeenCalledTimes(3)
  })

  it("never returns partial totals or raw provider errors when a later page fails", async () => {
    responses = [{ data: [invoice("a")] }, { error: { message: "private database details" } }]
    expect(await getAccountsReceivable(siteId)).toEqual({ data: [], error: "Failed to load accounts receivable" })
  })

  it("fails safely if a provider returns a page without advancing the cursor", async () => {
    responses = [{ data: [invoice("a")] }, { data: [invoice("a")] }]
    expect(await getAccountsReceivable(siteId)).toEqual({ data: [], error: "Unable to load all open invoices. Please retry." })
    expect(from).toHaveBeenCalledTimes(2)
  })
})