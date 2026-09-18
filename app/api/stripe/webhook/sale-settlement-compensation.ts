import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import type { ValidatedSaleCheckoutSession } from "./sale-checkout-settlement"

type CompensationRpcClient = Pick<SupabaseClient, "rpc">

export type StripeSaleCompensationResult =
  | { status: "refunded"; refundId: string }
  | { status: "manual_review" }
  | { status: "already_refunded"; refundId: string | null }

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

async function failCompensation(
  supabase: CompensationRpcClient,
  checkout: ValidatedSaleCheckoutSession,
  claimToken: string,
  error: unknown,
  manualReview: boolean,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  const { data, error: rpcError } = await supabase.rpc(
    "fail_stripe_sale_compensation",
    {
      p_session_id: checkout.session.id,
      p_claim_token: claimToken,
      p_error: message,
      p_manual_review: manualReview,
    },
  )
  if (rpcError || data !== true) {
    throw new Error(
      `Failed to persist Stripe compensation failure: ${
        rpcError?.message || "claim not owned"
      }`,
    )
  }
}

export async function compensateRejectedStripeSale(params: {
  supabase: CompensationRpcClient
  stripe: Stripe
  checkout: ValidatedSaleCheckoutSession
  reason: string
}): Promise<StripeSaleCompensationResult> {
  const { supabase, stripe, checkout, reason } = params
  const claimToken = randomUUID()
  const { data, error } = await supabase.rpc(
    "claim_stripe_sale_compensation",
    {
      p_session_id: checkout.session.id,
      p_sale_reference: checkout.saleId,
      p_order_id: checkout.orderId,
      p_payment_intent_id: checkout.paymentIntentId,
      p_amount_minor: checkout.amountMinor,
      p_currency: checkout.currency,
      p_reason: reason,
      p_claim_token: claimToken,
    },
  )
  if (error) {
    throw new Error(`Failed to claim Stripe compensation: ${error.message}`)
  }

  const claim = record(data)
  if (claim?.status === "refunded") {
    return {
      status: "already_refunded",
      refundId:
        typeof claim.refund_id === "string" ? claim.refund_id : null,
    }
  }
  if (claim?.status === "manual_review") {
    return { status: "manual_review" }
  }
  if (claim?.status === "in_progress") {
    throw new Error("Stripe compensation is already in progress")
  }
  if (claim?.status === "not_allowed") {
    throw new Error("Settled Stripe checkout cannot be compensated")
  }
  if (
    claim?.status !== "claimed" ||
    claim.claim_token !== claimToken
  ) {
    throw new Error("Stripe compensation claim returned an invalid response")
  }

  if (!checkout.paymentIntentId) {
    await failCompensation(
      supabase,
      checkout,
      claimToken,
      new Error("Paid checkout has no refundable payment intent"),
      true,
    )
    return { status: "manual_review" }
  }

  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: checkout.paymentIntentId,
        reason: "requested_by_customer",
        metadata: {
          source: "rejected_sale_checkout",
          stripe_session_id: checkout.session.id,
          sale_id: checkout.saleId,
          rejection_reason: reason.slice(0, 500),
        },
      },
      {
        idempotencyKey:
          `rejected-sale-checkout-refund:${checkout.session.id}`,
      },
    )
    const { data: completed, error: completeError } = await supabase.rpc(
      "complete_stripe_sale_compensation",
      {
        p_session_id: checkout.session.id,
        p_claim_token: claimToken,
        p_refund_id: refund.id,
      },
    )
    if (completeError || completed !== true) {
      throw new Error(
        `Failed to persist Stripe refund: ${
          completeError?.message || "claim not owned"
        }`,
      )
    }
    return { status: "refunded", refundId: refund.id }
  } catch (refundError) {
    await failCompensation(
      supabase,
      checkout,
      claimToken,
      refundError,
      false,
    )
    throw refundError
  }
}
