import {
  handleStripeSaleCheckoutCompleted,
  settleStripeSaleCheckout,
  validateLiveSaleCheckoutSession,
} from "@/app/api/stripe/webhook/sale-checkout-settlement"
import { compensateRejectedStripeSale } from "@/app/api/stripe/webhook/sale-settlement-compensation"
import { processStripeSaleSettlementEffects } from "@/app/api/stripe/webhook/sale-settlement-effects"

jest.mock("@/app/api/stripe/webhook/sale-settlement-effects", () => ({
  processStripeSaleSettlementEffects: jest.fn(),
}))
jest.mock("@/app/api/stripe/webhook/sale-settlement-compensation", () => ({
  compensateRejectedStripeSale: jest.fn(),
}))

const saleId = "00000000-0000-4000-8000-000000000001"
const orderId = "00000000-0000-4000-8000-000000000002"
const siteId = "00000000-0000-4000-8000-000000000003"

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_live",
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    amount_total: 2500,
    currency: "usd",
    payment_intent: "pi_live",
    metadata: {
      type: "sale",
      sale_id: saleId,
    },
    ...overrides,
  } as any
}

describe("Stripe sale checkout settlement", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(compensateRejectedStripeSale as jest.Mock).mockResolvedValue({
      status: "refunded",
      refundId: "re_1",
    })
  })

  it("parses standalone and UGX live sessions with shared minor-unit rules", () => {
    expect(validateLiveSaleCheckoutSession(session())).toEqual(
      expect.objectContaining({
        type: "sale",
        saleId,
        orderId: null,
        amount: 25,
        amountMinor: 2500,
        currency: "usd",
      }),
    )

    expect(validateLiveSaleCheckoutSession(session({
      amount_total: 123400,
      currency: "ugx",
    })).amount).toBe(1234)
    expect(() => validateLiveSaleCheckoutSession(session({
      amount_total: 123450,
      currency: "ugx",
    }))).toThrow("Stripe UGX minor amounts must be divisible by 100")
  })

  it("rejects a session that is not currently complete and paid", () => {
    expect(() => validateLiveSaleCheckoutSession(session({
      payment_status: "unpaid",
    }))).toThrow("not complete and paid")
    expect(() => validateLiveSaleCheckoutSession(session({
      status: "expired",
    }))).toThrow("not complete and paid")
  })

  it("settles a standalone sale through the atomic database function", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        status: "settled",
        resume_effects: true,
        sale_id: saleId,
        site_id: siteId,
        lead_id: null,
        order_id: null,
        order_user_id: null,
        order_buyer_user_id: null,
      },
      error: null,
    })
    const checkout = validateLiveSaleCheckoutSession(session())

    await expect(settleStripeSaleCheckout({ rpc } as any, checkout)).resolves
      .toEqual(expect.objectContaining({
        outcome: "settled",
        saleId,
        siteId,
        orderId: null,
      }))
    expect(rpc).toHaveBeenCalledWith("settle_stripe_sale_checkout", {
      p_sale_id: saleId,
      p_order_id: null,
      p_session_id: "cs_live",
      p_amount_minor: 2500,
      p_currency: "usd",
      p_payment_intent_id: "pi_live",
    })
  })

  it("resumes effects for a same-session already-settled retry", async () => {
    const settledRpc = jest.fn().mockResolvedValue({
      data: {
        status: "settled",
        resume_effects: true,
        sale_id: saleId,
        site_id: siteId,
        lead_id: null,
        order_id: orderId,
        order_user_id: "seller-1",
        order_buyer_user_id: "buyer-1",
      },
      error: null,
    })
    const saleOrderSession = session({
      metadata: {
        type: "sale_order",
        sale_id: saleId,
        order_id: orderId,
      },
    })

    await handleStripeSaleCheckoutCompleted({
      supabase: { rpc: settledRpc } as any,
      stripe: {} as any,
      session: saleOrderSession,
    })
    expect(processStripeSaleSettlementEffects).toHaveBeenCalledTimes(1)

    const duplicateRpc = jest.fn().mockResolvedValue({
      data: {
        status: "already_settled",
        resume_effects: true,
        sale_id: saleId,
        site_id: siteId,
        lead_id: null,
        order_id: orderId,
        order_user_id: "seller-1",
        order_buyer_user_id: "buyer-1",
      },
      error: null,
    })
    await handleStripeSaleCheckoutCompleted({
      supabase: { rpc: duplicateRpc } as any,
      stripe: {} as any,
      session: saleOrderSession,
    })
    expect(processStripeSaleSettlementEffects).toHaveBeenCalledTimes(2)
    expect(processStripeSaleSettlementEffects).toHaveBeenLastCalledWith(
      expect.objectContaining({
        settlement: expect.objectContaining({ outcome: "resumed" }),
      }),
    )
  })

  it("compensates a paid checkout rejected by the atomic settlement", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        status: "rejected",
        reason: "checkout_session_replaced",
      },
      error: null,
    })
    const liveSession = session()

    await expect(handleStripeSaleCheckoutCompleted({
      supabase: { rpc } as any,
      stripe: {} as any,
      session: liveSession,
    })).resolves.toEqual(expect.objectContaining({
      outcome: "rejected",
      reason: "checkout_session_replaced",
      compensation: { status: "refunded", refundId: "re_1" },
    }))
    expect(compensateRejectedStripeSale).toHaveBeenCalledWith(
      expect.objectContaining({
        checkout: expect.objectContaining({ saleId }),
        reason: "checkout_session_replaced",
      }),
    )
    expect(processStripeSaleSettlementEffects).not.toHaveBeenCalled()
  })

  it("fails closed when the settlement check fails", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    })

    await expect(handleStripeSaleCheckoutCompleted({
      supabase: { rpc } as any,
      stripe: {} as any,
      session: session(),
    })).rejects.toThrow("database unavailable")
    expect(processStripeSaleSettlementEffects).not.toHaveBeenCalled()
  })
})
