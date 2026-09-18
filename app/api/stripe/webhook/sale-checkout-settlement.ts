import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { fromStripeMinorAmount } from "@/app/api/stripe/checkout/checkout-payment-guard"
import { processStripeSaleSettlementEffects } from "./sale-settlement-effects"
import {
  compensateRejectedStripeSale,
  type StripeSaleCompensationResult,
} from "./sale-settlement-compensation"

type SettlementRpcClient = Pick<SupabaseClient, "rpc" | "from">

export type ValidatedSaleCheckoutSession = {
  session: Stripe.Checkout.Session
  type: "sale" | "sale_order"
  saleId: string
  orderId: string | null
  amountMinor: number
  amount: number
  currency: string
  paymentIntentId: string | null
}

export type StripeSaleSettlementResult =
  | {
      outcome: "settled" | "resumed"
      resumeEffects: boolean
      saleId: string
      siteId: string
      leadId: string | null
      orderId: string | null
      orderUserId: string | null
      orderBuyerUserId: string | null
    }
  | {
      outcome: "rejected"
      reason: string
      compensation?: StripeSaleCompensationResult
    }

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function objectId(value: string | { id: string } | null): string | null {
  if (typeof value === "string") return value
  return value?.id || null
}

export function validateLiveSaleCheckoutSession(
  session: Stripe.Checkout.Session,
): ValidatedSaleCheckoutSession {
  if (session.mode !== "payment") {
    throw new Error("Stripe sale checkout session is not a payment session")
  }
  if (session.status !== "complete" || session.payment_status !== "paid") {
    throw new Error("Stripe sale checkout session is not complete and paid")
  }

  const type = session.metadata?.type
  if (type !== "sale" && type !== "sale_order") {
    throw new Error("Stripe checkout session is not a sale payment")
  }

  const saleId = session.metadata?.sale_id
  if (!saleId) {
    throw new Error("Stripe sale checkout session is missing sale_id")
  }

  const orderId = type === "sale_order"
    ? session.metadata?.order_id || null
    : null
  if (type === "sale_order" && !orderId) {
    throw new Error("Stripe sale order checkout session is missing order_id")
  }
  if (
    !Number.isSafeInteger(session.amount_total) ||
    (session.amount_total ?? 0) <= 0 ||
    !session.currency
  ) {
    throw new Error("Stripe sale checkout session has an invalid amount")
  }

  const amountMinor = session.amount_total as number
  const currency = session.currency.toLowerCase()
  return {
    session,
    type,
    saleId,
    orderId,
    amountMinor,
    amount: fromStripeMinorAmount(amountMinor, currency),
    currency,
    paymentIntentId: objectId(session.payment_intent),
  }
}

export async function settleStripeSaleCheckout(
  supabase: SettlementRpcClient,
  checkout: ValidatedSaleCheckoutSession,
): Promise<StripeSaleSettlementResult> {
  const { data, error } = await supabase.rpc("settle_stripe_sale_checkout", {
    p_sale_id: checkout.saleId,
    p_order_id: checkout.orderId,
    p_session_id: checkout.session.id,
    p_amount_minor: checkout.amountMinor,
    p_currency: checkout.currency,
    p_payment_intent_id: checkout.paymentIntentId,
  })

  if (error) {
    throw new Error(`Failed to settle Stripe sale checkout: ${error.message}`)
  }

  const result = objectRecord(data)
  if (!result || typeof result.status !== "string") {
    throw new Error("Stripe sale settlement returned an invalid response")
  }
  if (result.status === "rejected") {
    return {
      outcome: "rejected",
      reason:
        typeof result.reason === "string"
          ? result.reason
          : result.status,
    }
  }
  if (result.status !== "settled" && result.status !== "already_settled") {
    throw new Error("Stripe sale settlement returned an unknown status")
  }

  if (
    result.sale_id !== checkout.saleId ||
    typeof result.site_id !== "string" ||
    (checkout.orderId !== null && result.order_id !== checkout.orderId)
  ) {
    throw new Error("Stripe sale settlement returned mismatched identifiers")
  }

  return {
    outcome: result.status === "settled" ? "settled" : "resumed",
    resumeEffects: result.resume_effects !== false,
    saleId: checkout.saleId,
    siteId: result.site_id,
    leadId: typeof result.lead_id === "string" ? result.lead_id : null,
    orderId: typeof result.order_id === "string" ? result.order_id : null,
    orderUserId:
      typeof result.order_user_id === "string" ? result.order_user_id : null,
    orderBuyerUserId:
      typeof result.order_buyer_user_id === "string"
        ? result.order_buyer_user_id
        : null,
  }
}

export async function handleStripeSaleCheckoutCompleted(params: {
  supabase: SettlementRpcClient
  stripe: Stripe
  session: Stripe.Checkout.Session
}): Promise<StripeSaleSettlementResult> {
  const checkout = validateLiveSaleCheckoutSession(params.session)
  const settlement = await settleStripeSaleCheckout(params.supabase, checkout)

  if (settlement.outcome === "rejected") {
    const compensation = await compensateRejectedStripeSale({
      supabase: params.supabase,
      stripe: params.stripe,
      checkout,
      reason: settlement.reason,
    })
    return { ...settlement, compensation }
  }

  if (settlement.resumeEffects) {
    await processStripeSaleSettlementEffects({
      supabase: params.supabase,
      stripe: params.stripe,
      checkout,
      settlement,
    })
  }

  return settlement
}
