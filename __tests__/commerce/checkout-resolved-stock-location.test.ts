/** @jest-environment node */
import { checkoutCart } from "@/app/commerce/checkout"
import { prepareCheckoutEnvironment } from "@/app/commerce/checkout-environment"
import { resolveCheckoutAttribution } from "@/app/commerce/checkout-attribution"
import { processCheckoutLines } from "@/app/commerce/checkout-lines"
import { persistCheckoutRecords } from "@/app/commerce/checkout-records"

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn().mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "cashier" } } }) } }),
  createServiceClient: jest.fn().mockResolvedValue({}),
}))
jest.mock("@/app/pos/actions/idempotency", () => ({ findPosClientMutation: jest.fn() }))
jest.mock("@/app/quotations/quote-checkout", () => ({}))
jest.mock("@/app/documents/public-token-store", () => ({}))
jest.mock("@/app/commerce/checkout-environment", () => ({ prepareCheckoutEnvironment: jest.fn() }))
jest.mock("@/app/commerce/checkout-attribution", () => ({ resolveCheckoutAttribution: jest.fn() }))
jest.mock("@/app/commerce/checkout-lines", () => ({ processCheckoutLines: jest.fn() }))
jest.mock("@/app/commerce/checkout-records", () => ({ persistCheckoutRecords: jest.fn() }))
jest.mock("@/app/commerce/checkout-finalize", () => ({ finalizeCheckout: jest.fn() }))
jest.mock("@/app/commerce/checkout-idempotency", () => ({}))

describe("checkout stock location boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(prepareCheckoutEnvironment).mockResolvedValue({
      finalOriginLocationId: "resolved-origin", priceListChannel: "pos",
      isAdmin: false, isStaffCheckout: true, siteSettings: {},
    } as Awaited<ReturnType<typeof prepareCheckoutEnvironment>>)
    jest.mocked(resolveCheckoutAttribution).mockResolvedValue({
      createdByUserId: "cashier", sellerUserId: "cashier", requestedByLeadId: null,
    })
    jest.mocked(processCheckoutLines).mockRejectedValue(new Error("Stock unavailable"))
  })

  it.each([undefined, "client-origin"])("uses the resolved origin, not client input %s", async (originLocationId) => {
    await expect(checkoutCart({
      siteId: "site", source: "pos", fulfillment: "pickup", originLocationId,
      lines: [{ catalogItemId: "sku", quantity: 2 }],
    })).resolves.toEqual({ error: "Stock unavailable" })
    expect(processCheckoutLines).toHaveBeenCalledWith(expect.objectContaining({
      originLocationId: "resolved-origin", isAdmin: false, priceListChannel: "pos",
    }))
    expect(persistCheckoutRecords).not.toHaveBeenCalled()
  })

  it("keeps the POS attribution guard ahead of stock reads and writes", async () => {
    jest.mocked(resolveCheckoutAttribution).mockRejectedValue(new Error("Not authorized"))
    await expect(checkoutCart({
      siteId: "site", source: "pos", fulfillment: "none", lines: [{ catalogItemId: "sku", quantity: 1 }],
    })).resolves.toEqual({ error: "Not authorized" })
    expect(processCheckoutLines).not.toHaveBeenCalled()
    expect(persistCheckoutRecords).not.toHaveBeenCalled()
  })
})