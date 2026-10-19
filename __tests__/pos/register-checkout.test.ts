/** @jest-environment node */
import { assertRegisterCheckout } from "@/app/pos/register/checkout-guard"
import type { CheckoutCartParams } from "@/app/commerce/checkout-types"

jest.mock("server-only", () => ({}))
const siteId = "11111111-1111-4111-8111-111111111111"
const sessionId = "33333333-3333-4333-8333-333333333333"
const paymentId = "44444444-4444-4444-8444-444444444444"
const params: CheckoutCartParams = { siteId, source: "pos", lines: [], fulfillment: "none", originLocationId: "location",
  registerSessionId: sessionId, payments: [{ paymentId, method: "cash", amount: 10, tendered: 20, change: 10 }] }
const session = { id: sessionId, site_id: siteId, status: "open", opened_by: "actor", location_id: "location" }
const rpc = jest.fn()
const from = jest.fn()
const builder = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() }

describe("Registered POS checkout boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks(); rpc.mockResolvedValue({ data: "collaborator", error: null })
    from.mockReturnValue(builder); builder.select.mockReturnValue(builder); builder.eq.mockReturnValue(builder)
    builder.maybeSingle.mockResolvedValue({ data: session, error: null })
  })
  it("allows an owned, open register and scopes it to the authenticated site", async () => {
    await expect(assertRegisterCheckout({ rpc, from }, params, "actor")).resolves.toBeUndefined()
    expect(builder.eq).toHaveBeenCalledWith("site_id", siteId)
  })
  it("leaves public checkout and unpaid POS send unchanged", async () => {
    await assertRegisterCheckout({ rpc, from }, { ...params, source: "shop" }, null)
    await assertRegisterCheckout({ rpc, from }, { ...params, payments: [] }, null)
    expect(rpc).not.toHaveBeenCalled()
  })
  it("does not let quotation promotion switch a registered payment to a privileged public checkout", async () => {
    await expect(assertRegisterCheckout({ rpc, from }, { ...params, quotationId: "quote" }, "actor"))
      .rejects.toThrow("Accept the quotation first")
    expect(from).not.toHaveBeenCalled()
  })
  it("rejects anonymous callers, unassigned legacy receipts, duplicate IDs and invalid cash change", async () => {
    await expect(assertRegisterCheckout({ rpc, from }, params, null)).rejects.toThrow("Authentication")
    for (const altered of [{ registerSessionId: undefined }, { payments: [...params.payments!, ...params.payments!] },
      { payments: [{ ...params.payments![0], change: 5 }] }, { payments: [{ ...params.payments![0], amount: Infinity }] }]) {
      await expect(assertRegisterCheckout({ rpc, from }, { ...params, ...altered }, "actor")).rejects.toThrow("valid register")
    }
    expect(from).not.toHaveBeenCalled()
  })
  it("denies marketing, closed or foreign sessions, another cashier and mismatched location", async () => {
    rpc.mockResolvedValueOnce({ data: "marketing", error: null })
    await expect(assertRegisterCheckout({ rpc, from }, params, "actor")).rejects.toThrow("Forbidden")
    for (const data of [null, { ...session, status: "closed" }, { ...session, location_id: "foreign" }, { ...session, opened_by: "other" }]) {
      builder.maybeSingle.mockResolvedValueOnce({ data, error: null })
      await expect(assertRegisterCheckout({ rpc, from }, params, "actor")).rejects.toThrow()
    }
  })
})