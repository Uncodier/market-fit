import { processPostPaymentFulfillment } from "@/app/commerce/post-payment"
import { processStripeSaleSettlementEffects } from "@/app/api/stripe/webhook/sale-settlement-effects"
import { validateLiveSaleCheckoutSession } from "@/app/api/stripe/webhook/sale-checkout-settlement"

jest.mock("@/app/commerce/post-payment", () => ({
  processPostPaymentFulfillment: jest.fn(),
}))
jest.mock("@/app/commerce/entitlements", () => ({
  syncSubscriptionEntitlements: jest.fn(),
}))

const saleId = "00000000-0000-4000-8000-000000000001"
const orderId = "00000000-0000-4000-8000-000000000002"

const checkout = validateLiveSaleCheckoutSession({
  id: "cs_retry",
  mode: "payment",
  status: "complete",
  payment_status: "paid",
  amount_total: 2500,
  currency: "usd",
  payment_intent: "pi_retry",
  metadata: {
    type: "sale_order",
    sale_id: saleId,
    order_id: orderId,
  },
} as any)

const settlement = {
  outcome: "resumed" as const,
  resumeEffects: true,
  saleId,
  siteId: "00000000-0000-4000-8000-000000000003",
  leadId: null,
  orderId,
  orderUserId: "00000000-0000-4000-8000-000000000004",
  orderBuyerUserId: "00000000-0000-4000-8000-000000000005",
}

function stripe() {
  return {
    paymentIntents: {
      retrieve: jest.fn().mockResolvedValue({
        latest_charge: {
          balance_transaction: {
            amount: 2500,
            currency: "usd",
          },
        },
      }),
    },
  } as any
}

function emptyOrderItemsClient(rpc: jest.Mock) {
  const orderItems = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ data: [], error: null }),
  }
  return {
    rpc,
    from: jest.fn().mockReturnValue(orderItems),
  } as any
}

describe("retryable Stripe sale effects", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("resumes after a partial fulfillment failure without reapplying finance", async () => {
    let financialCalls = 0
    const rpc = jest.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "apply_stripe_sale_financial_effects") {
        financialCalls += 1
        return {
          data: {
            status: financialCalls === 1
              ? "completed"
              : "already_completed",
          },
          error: null,
        }
      }
      if (name === "claim_stripe_sale_fulfillment") {
        return {
          data: {
            status: "claimed",
            claim_token: args.p_claim_token,
          },
          error: null,
        }
      }
      if (
        name === "fail_stripe_sale_fulfillment" ||
        name === "complete_stripe_sale_fulfillment"
      ) {
        return { data: true, error: null }
      }
      throw new Error(`Unexpected RPC ${name}`)
    })
    const client = emptyOrderItemsClient(rpc)
    ;(processPostPaymentFulfillment as jest.Mock)
      .mockRejectedValueOnce(new Error("shipment unavailable"))
      .mockResolvedValueOnce(undefined)

    await expect(processStripeSaleSettlementEffects({
      supabase: client,
      stripe: stripe(),
      checkout,
      settlement,
    })).rejects.toThrow("shipment unavailable")

    await expect(processStripeSaleSettlementEffects({
      supabase: client,
      stripe: stripe(),
      checkout,
      settlement,
    })).resolves.toBeUndefined()

    expect(processPostPaymentFulfillment).toHaveBeenCalledTimes(2)
    expect(rpc.mock.calls.filter(
      ([name]) => name === "apply_stripe_sale_financial_effects",
    )).toHaveLength(2)
    expect(rpc).toHaveBeenCalledWith(
      "fail_stripe_sale_fulfillment",
      expect.any(Object),
    )
    expect(rpc).toHaveBeenCalledWith(
      "complete_stripe_sale_fulfillment",
      expect.any(Object),
    )
  })

  it("does not repeat fulfillment after a duplicate delivery", async () => {
    const rpc = jest.fn(async (name: string) => {
      if (name === "apply_stripe_sale_financial_effects") {
        return { data: { status: "already_completed" }, error: null }
      }
      if (name === "claim_stripe_sale_fulfillment") {
        return { data: { status: "completed" }, error: null }
      }
      throw new Error(`Unexpected RPC ${name}`)
    })

    await processStripeSaleSettlementEffects({
      supabase: emptyOrderItemsClient(rpc),
      stripe: stripe(),
      checkout,
      settlement,
    })

    expect(processPostPaymentFulfillment).not.toHaveBeenCalled()
  })
})
