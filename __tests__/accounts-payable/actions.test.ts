/** @jest-environment node */
import { getAccountsPayable, getPayableBills } from "@/app/accounts-payable/actions"
import { requirePurchaseAccess } from "@/app/purchases/purchase-access"

jest.mock("@/app/purchases/purchase-access", () => ({ requirePurchaseAccess: jest.fn() }))
const siteId = "11111111-1111-4111-8111-111111111111"
const vendorId = "22222222-2222-4222-8222-222222222222"
const invoice = (id: string) => ({ id, site_id: siteId, vendor_company_id: vendorId,
  amount_due: "12.50", amount: 25, payments: [], currency: "USD", status: "completed", title: "Stock",
  due_date: "2026-10-10", purchase_date: "2026-10-01", created_at: "2026-10-01T00:00:00Z", updated_at: null,
  vendor: { id: vendorId, name: "Supplier", email: null } })

describe("accounts payable server boundary", () => {
  const from = jest.fn()
  let query: Record<string, jest.Mock>
  let responses: { data?: ReturnType<typeof invoice>[]; error?: { message: string } }[]
  beforeEach(() => {
    jest.clearAllMocks()
    responses = [{ data: [invoice("a")] }, { data: [invoice("b")] }, { data: [] }]
    query = Object.fromEntries(["select", "eq", "in", "gt", "order", "range"].map(name => [name, jest.fn().mockReturnThis()]))
    from.mockImplementation(() => Object.assign(query, {
      then: (resolve: (result: typeof responses[number]) => unknown) => Promise.resolve(responses.shift()!).then(resolve),
    }))
    jest.mocked(requirePurchaseAccess).mockResolvedValue({ supabase: { from } } as never)
  })

  it("validates site, vendor and scope before authorization", async () => {
    expect(await getAccountsPayable("invalid")).toHaveProperty("error", "Invalid accounts payable request")
    expect(await getAccountsPayable(siteId, "all" as never)).toHaveProperty("error")
    expect(await getPayableBills(siteId, "invalid")).toHaveProperty("error")
    expect(await getPayableBills(siteId, vendorId, "all" as never)).toHaveProperty("error")
    expect(requirePurchaseAccess).not.toHaveBeenCalled()
  })

  it.each(["Not authenticated", "Not authorized", "Foreign site"])("denies %s before reading", async message => {
    jest.mocked(requirePurchaseAccess).mockRejectedValue(new Error(message))
    expect(await getAccountsPayable(siteId)).toEqual({ data: [], error: "Unable to access accounts payable" })
    expect(await getPayableBills(siteId, vendorId)).toEqual({ data: [], error: "Unable to access accounts payable" })
    expect(from).not.toHaveBeenCalled()
  })

  it("reads every authorized purchase page without pretending global companies have site_id", async () => {
    expect((await getAccountsPayable(siteId)).data[0]).toMatchObject({ invoiceCount: 2, balances: [{ currency: "USD", amount: 25 }] })
    expect(requirePurchaseAccess).toHaveBeenCalledWith(siteId, "select")
    expect(from).toHaveBeenCalledWith("purchases")
    expect(query.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(query.eq).not.toHaveBeenCalledWith("vendor.site_id", siteId)
    expect(query.in).toHaveBeenCalledWith("status", ["pending", "completed"])
    expect(query.gt).toHaveBeenCalledWith("amount_due", 0)
    expect(query.gt).toHaveBeenCalledWith("id", "b")
    expect(query.range).toHaveBeenCalledWith(0, 499)
    expect(query.select.mock.calls[0][0]).not.toContain("*")
    expect(from).toHaveBeenCalledTimes(3)
  })

  it("requests only cancelled purchases for the cancelled tab", async () => {
    responses = [{ data: [{ ...invoice("a"), status: "cancelled" }] }, { data: [] }]
    expect((await getAccountsPayable(siteId, "cancelled")).data[0].invoiceCount).toBe(1)
    expect(query.in).toHaveBeenCalledWith("status", ["cancelled"])
  })

  it("scopes payment selection to the supplier and returns mapped bills", async () => {
    const result = await getPayableBills(siteId, vendorId)
    expect(query.eq).toHaveBeenCalledWith("vendor_company_id", vendorId)
    expect(result.data).toHaveLength(2)
    expect(result.data[0]).toMatchObject({ id: "a", siteId, vendorCompanyId: vendorId, amountDue: 12.5, currency: "USD" })
    expect(query.select.mock.calls[0][0]).not.toContain("*")
  })

  it("rejects foreign-site and mismatched-vendor rows defensively", async () => {
    responses = [{ data: [{ ...invoice("a"), site_id: "foreign" }, { ...invoice("b"), vendor_company_id: "other" }] }, { data: [] }]
    expect((await getPayableBills(siteId, vendorId)).data).toEqual([])
  })

  it.each(["summary", "bills"])("never returns partial %s results or private provider errors", async target => {
    responses = [{ data: [invoice("a")] }, { error: { message: "private database details" } }]
    const result = target === "summary" ? await getAccountsPayable(siteId) : await getPayableBills(siteId, vendorId)
    expect(result).toEqual({ data: [], error: "Failed to load accounts payable" })
  })

  it.each(["summary", "bills"])("fails safely on a nonadvancing %s cursor", async target => {
    responses = [{ data: [invoice("a")] }, { data: [invoice("a")] }]
    const result = target === "summary" ? await getAccountsPayable(siteId) : await getPayableBills(siteId, vendorId)
    expect(result).toEqual({ data: [], error: "Unable to load all open bills. Please retry." })
  })
})