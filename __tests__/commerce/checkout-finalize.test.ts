import { finalizeCheckout } from "@/app/commerce/checkout-finalize"
import { ensurePublicAccessTokenForRecord } from "@/app/documents/public-token-store"
import { createShipment } from "@/app/shipments/actions"
import { revalidatePath } from "next/cache"
import { bumpCacheEpoch } from "@/lib/redis/json-cache"
import { upsertSaleOrderItemsWithModifiers } from "@/app/commerce/checkout-order-items"

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/redis/json-cache", () => ({ bumpCacheEpoch: jest.fn().mockResolvedValue(true) }))

jest.mock("@/app/commerce/checkout-order-items", () => ({
  upsertSaleOrderItemsWithModifiers: jest.fn().mockResolvedValue([]),
}))
jest.mock("@/app/commerce/checkout-reservations", () => ({
  syncCheckoutDropinReservations: jest.fn().mockResolvedValue(undefined),
}))
jest.mock("@/app/documents/public-token-store", () => ({
  ensurePublicAccessTokenForRecord: jest.fn().mockResolvedValue({
    token: "public-order-token",
  }),
}))
jest.mock("@/app/accounting/source-posting", () => ({
  tryPostSaleJournalWithClient: jest.fn().mockResolvedValue(undefined),
}))
jest.mock("@/app/commerce/entitlements", () => ({
  grantFromOrder: jest.fn(),
  syncSubscriptionEntitlements: jest.fn(),
}))
jest.mock("@/app/promotions/apply-promotion-to-order", () => ({
  applyPromotionToOrder: jest.fn(),
}))
jest.mock("@/app/shipments/actions", () => ({
  createShipment: jest.fn().mockResolvedValue({ data: { id: "shipment-1" } }),
}))
jest.mock("@/app/pos/actions/idempotency", () => ({
  recordPosClientMutation: jest.fn(),
}))
jest.mock("@/app/quotations/quote-checkout", () => ({
  completeQuotationCheckout: jest.fn(),
}))
jest.mock("@/app/commerce/ensure-commerce-lead-converted", () => ({
  ensureCommerceLeadConverted: jest.fn(),
  isCommerceLeadSource: jest.fn().mockReturnValue(false),
}))

describe("finalizeCheckout", () => {
  beforeEach(() => jest.clearAllMocks())

  function posUpdateParams(): Parameters<typeof finalizeCheckout>[0] {
    type Query = { select: jest.Mock; in: jest.Mock; eq: jest.Mock; single: jest.Mock }
    const query: Query = {
      select: jest.fn((): Query => query),
      in: jest.fn().mockResolvedValue({ data: [], error: null }),
      eq: jest.fn((): Query => query),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    const client = { from: jest.fn(() => query) }
    return {
      supabase: client as never, supabaseAdmin: client as never,
      isAdmin: false, isStaffCheckout: true, source: "pos", siteId: "site-1",
      sale: { id: "sale-1" }, order: { id: "order-1" },
      effectiveExistingOrderId: "order-1",
      existingItems: [{ id: "removed-line", status: "new" }],
      lines: [], processedLines: [], intent: "send", isFullyPaid: false,
      orderInitialStatus: "pending", fulfillment: "dine_in", orderTotal: 0,
      quoteForAccept: null, activeQuotationClaim: null,
    }
  }

  it("invalidates lists and detail after a POS order's removed lines are persisted", async () => {
    const params = posUpdateParams()
    await finalizeCheckout(params)
    expect(upsertSaleOrderItemsWithModifiers).toHaveBeenCalledWith(expect.objectContaining({
      orderId: "order-1", existingOrderId: "order-1",
      existingItems: params.existingItems, processedLines: [], intent: "send",
    }))
    expect(bumpCacheEpoch).toHaveBeenCalledWith("order-data", "site-1")
    expect(revalidatePath).toHaveBeenCalledWith("/orders/order-1")
  })

  it("does not treat failed line removal as a successful cache refresh", async () => {
    jest.mocked(upsertSaleOrderItemsWithModifiers).mockRejectedValueOnce(new Error("Removal failed"))
    await expect(finalizeCheckout(posUpdateParams())).rejects.toThrow("Removal failed")
    expect(bumpCacheEpoch).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("uses authorized server paths for public checkout finalization", async () => {
    const userClient = {
      from: jest.fn((table: string) => {
        if (table !== "catalog_items") {
          throw new Error(`Unexpected user-scoped table access: ${table}`)
        }
        return {
          select: jest.fn(() => ({
            in: jest.fn().mockResolvedValue({ data: [], error: null }),
          })),
        }
      }),
    }
    const adminClient = {
      from: jest.fn((table: string) => {
        if (table !== "sale_orders") {
          throw new Error(`Unexpected service table access: ${table}`)
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: {
                  order_number: "ORD-100",
                  status: "completed",
                  total: 0,
                  currency: "USD",
                  created_at: "2026-09-18T00:00:00.000Z",
                  notes: null,
                  fulfillment_method: "none",
                },
                error: null,
              }),
            })),
          })),
        }
      }),
    }

    const result = await finalizeCheckout({
      supabase: userClient as never,
      supabaseAdmin: adminClient as never,
      isAdmin: false,
      isStaffCheckout: false,
      siteId: "site-1",
      source: "shop",
      lines: [{ catalogItemId: "item-1", quantity: 1 }],
      processedLines: [{
        catalog_item_id: "item-1",
        name: "Reservable Item",
        quantity: 1,
        unit_price: 0,
      }] as never,
      sale: { id: "sale-1" },
      order: { id: "order-1" },
      existingItems: [],
      intent: "complete",
      isFullyPaid: true,
      orderInitialStatus: "completed",
      fulfillment: "ship",
      finalOriginLocationId: "location-1",
      resolvedUserId: "buyer-1",
      shippingAddress: { line1: "123 Test Street" },
      quoteForAccept: null,
      activeQuotationClaim: null,
      orderTotal: 0,
    })

    expect(createShipment).toHaveBeenCalledWith(expect.objectContaining({
      saleOrderId: "order-1",
      forceServiceRole: true,
    }))
    expect(ensurePublicAccessTokenForRecord).toHaveBeenCalledWith(
      adminClient,
      "sale_orders",
      "order-1"
    )
    expect(result).toEqual(expect.objectContaining({
      success: true,
      publicAccessToken: "public-order-token",
    }))
    expect(bumpCacheEpoch).toHaveBeenCalledWith("order-data", "site-1")
    expect(revalidatePath).toHaveBeenCalledWith("/orders")
    expect(revalidatePath).toHaveBeenCalledWith("/orders/order-1")
    expect(revalidatePath).toHaveBeenCalledWith("/order-lines")
    expect(jest.mocked(bumpCacheEpoch).mock.invocationCallOrder[0]).toBeGreaterThan(
      jest.mocked(upsertSaleOrderItemsWithModifiers).mock.invocationCallOrder[0],
    )
  })
})
