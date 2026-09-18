import { compensateRejectedStripeSale } from "@/app/api/stripe/webhook/sale-settlement-compensation"

const saleId = "00000000-0000-4000-8000-000000000001"

function checkout(paymentIntent: string | null = "pi_rejected") {
  return {
    session: {
      id: "cs_rejected",
      mode: "payment",
      status: "complete",
      payment_status: "paid",
      amount_total: 2500,
      currency: "usd",
      payment_intent: paymentIntent,
      metadata: {
        type: "sale",
        sale_id: saleId,
      },
    },
    type: "sale" as const,
    saleId,
    orderId: null,
    amountMinor: 2500,
    amount: 25,
    currency: "usd",
    paymentIntentId: paymentIntent,
  } as any
}

describe("rejected Stripe sale compensation", () => {
  it("creates one deterministic refund and records it", async () => {
    const rpc = jest.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "claim_stripe_sale_compensation") {
        return {
          data: {
            status: "claimed",
            claim_token: args.p_claim_token,
          },
          error: null,
        }
      }
      if (name === "complete_stripe_sale_compensation") {
        return { data: true, error: null }
      }
      throw new Error(`Unexpected RPC ${name}`)
    })
    const createRefund = jest.fn().mockResolvedValue({ id: "re_123" })

    await expect(compensateRejectedStripeSale({
      supabase: { rpc } as any,
      stripe: { refunds: { create: createRefund } } as any,
      checkout: checkout(),
      reason: "checkout_session_replaced",
    })).resolves.toEqual({ status: "refunded", refundId: "re_123" })

    expect(createRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: "pi_rejected",
        metadata: expect.objectContaining({
          stripe_session_id: "cs_rejected",
          rejection_reason: "checkout_session_replaced",
        }),
      }),
      {
        idempotencyKey: "rejected-sale-checkout-refund:cs_rejected",
      },
    )
    expect(rpc).toHaveBeenCalledWith(
      "complete_stripe_sale_compensation",
      expect.objectContaining({ p_refund_id: "re_123" }),
    )
  })

  it("does not create another refund for a duplicate delivery", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { status: "refunded", refund_id: "re_existing" },
      error: null,
    })
    const createRefund = jest.fn()

    await expect(compensateRejectedStripeSale({
      supabase: { rpc } as any,
      stripe: { refunds: { create: createRefund } } as any,
      checkout: checkout(),
      reason: "sale_not_payable",
    })).resolves.toEqual({
      status: "already_refunded",
      refundId: "re_existing",
    })
    expect(createRefund).not.toHaveBeenCalled()
  })

  it("durably flags manual review when no payment intent can be refunded", async () => {
    const rpc = jest.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "claim_stripe_sale_compensation") {
        return {
          data: {
            status: "claimed",
            claim_token: args.p_claim_token,
          },
          error: null,
        }
      }
      if (name === "fail_stripe_sale_compensation") {
        return { data: true, error: null }
      }
      throw new Error(`Unexpected RPC ${name}`)
    })

    await expect(compensateRejectedStripeSale({
      supabase: { rpc } as any,
      stripe: { refunds: { create: jest.fn() } } as any,
      checkout: checkout(null),
      reason: "sale_not_found",
    })).resolves.toEqual({ status: "manual_review" })
    expect(rpc).toHaveBeenCalledWith(
      "fail_stripe_sale_compensation",
      expect.objectContaining({ p_manual_review: true }),
    )
  })
})
