import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { fromStripeMinorAmount } from "@/app/api/stripe/checkout/checkout-payment-guard"
import { processPostPaymentFulfillment } from "@/app/commerce/post-payment"
import { syncSubscriptionEntitlements } from "@/app/commerce/entitlements"
import type {
  StripeSaleSettlementResult,
  ValidatedSaleCheckoutSession,
} from "./sale-checkout-settlement"

type SettlementEffectsClient = Pick<SupabaseClient, "from" | "rpc">
type AcceptedSettlement = Exclude<
  StripeSaleSettlementResult,
  { outcome: "rejected" }
>

async function activateOrderSubscriptions(
  supabase: SettlementEffectsClient,
  checkout: ValidatedSaleCheckoutSession,
  settlement: AcceptedSettlement,
): Promise<void> {
  if (!settlement.orderId) return

  const { data: orderItems, error: orderItemsError } = await supabase
    .from("sale_order_items")
    .select("catalog_item_id")
    .eq("sale_order_id", settlement.orderId)

  if (orderItemsError) {
    throw new Error(
      `Failed to load paid order items: ${orderItemsError.message}`,
    )
  }

  const catalogItemIds = (orderItems || [])
    .map((item) => item.catalog_item_id)
    .filter((id): id is string => typeof id === "string")
  if (
    catalogItemIds.length === 0 ||
    (!settlement.orderBuyerUserId && !settlement.leadId)
  ) {
    return
  }

  let query = supabase
    .from("subscriptions")
    .select("id, status")
    .in("status", ["pending", "active"])
    .in("catalog_item_id", catalogItemIds)

  query = settlement.orderBuyerUserId
    ? query.eq("buyer_user_id", settlement.orderBuyerUserId)
    : query.eq("lead_id", settlement.leadId)

  const { data: subscriptions, error: subscriptionsError } = await query
  if (subscriptionsError) {
    throw new Error(
      `Failed to load paid order subscriptions: ${subscriptionsError.message}`,
    )
  }
  if (!subscriptions?.length) return

  const subscriptionIds = subscriptions.map((subscription) => subscription.id)
  const pendingIds = subscriptions
    .filter((subscription) => subscription.status === "pending")
    .map((subscription) => subscription.id)
  if (pendingIds.length > 0) {
    const { error: activationError } = await supabase
      .from("subscriptions")
      .update({ status: "active" })
      .in("id", pendingIds)

    if (activationError) {
      throw new Error(
        `Failed to activate paid order subscriptions: ${activationError.message}`,
      )
    }
  }

  for (const subscriptionId of subscriptionIds) {
    await syncSubscriptionEntitlements(subscriptionId, true)
  }

  console.log("Activated subscriptions for Stripe sale settlement", {
    saleId: checkout.saleId,
    subscriptionCount: subscriptionIds.length,
  })
}

async function stripeSettlementAmount(
  stripe: Stripe,
  checkout: ValidatedSaleCheckoutSession,
): Promise<{ amount: number; currency: string }> {
  if (checkout.paymentIntentId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(
      checkout.paymentIntentId,
      { expand: ["latest_charge.balance_transaction"] },
    )
    const charge = paymentIntent.latest_charge
    if (charge && typeof charge !== "string") {
      const balanceTransaction = charge.balance_transaction
      if (
        balanceTransaction &&
        typeof balanceTransaction !== "string"
      ) {
        return {
          amount: fromStripeMinorAmount(
            balanceTransaction.amount,
            balanceTransaction.currency,
          ),
          currency: balanceTransaction.currency.toUpperCase(),
        }
      }
    }
  }

  return {
    amount: checkout.amount,
    currency: checkout.currency.toUpperCase(),
  }
}

async function applyFinancialEffects(
  supabase: SettlementEffectsClient,
  stripe: Stripe,
  checkout: ValidatedSaleCheckoutSession,
  settlement: AcceptedSettlement,
): Promise<void> {
  const stripeSettlement = await stripeSettlementAmount(stripe, checkout)
  const { data, error } = await supabase.rpc(
    "apply_stripe_sale_financial_effects",
    {
      p_sale_id: settlement.saleId,
      p_session_id: checkout.session.id,
      p_settlement_amount: stripeSettlement.amount,
      p_settlement_currency: stripeSettlement.currency,
    },
  )
  if (error) {
    throw new Error(`Failed to apply Stripe financial effects: ${error.message}`)
  }
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !["completed", "already_completed", "recovered_existing"].includes(
      String((data as Record<string, unknown>).status),
    )
  ) {
    throw new Error("Stripe financial effects returned an invalid response")
  }
}

async function failFulfillmentClaim(
  supabase: SettlementEffectsClient,
  sessionId: string,
  claimToken: string,
): Promise<void> {
  const { data, error } = await supabase.rpc(
    "fail_stripe_sale_fulfillment",
    {
      p_session_id: sessionId,
      p_claim_token: claimToken,
    },
  )
  if (error || data !== true) {
    throw new Error(
      `Failed to release Stripe fulfillment claim: ${
        error?.message || "claim not owned"
      }`,
    )
  }
}

async function applyOrderFulfillment(
  supabase: SettlementEffectsClient,
  checkout: ValidatedSaleCheckoutSession,
  settlement: AcceptedSettlement,
): Promise<void> {
  if (!settlement.orderId) return

  const claimToken = randomUUID()
  const { data, error } = await supabase.rpc(
    "claim_stripe_sale_fulfillment",
    {
      p_sale_id: settlement.saleId,
      p_session_id: checkout.session.id,
      p_claim_token: claimToken,
    },
  )
  if (error) {
    throw new Error(`Failed to claim Stripe fulfillment: ${error.message}`)
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Stripe fulfillment claim returned an invalid response")
  }

  const claim = data as Record<string, unknown>
  if (
    claim.status === "completed" ||
    claim.status === "not_required"
  ) {
    return
  }
  if (claim.status === "in_progress") {
    throw new Error("Stripe fulfillment is already in progress")
  }
  if (claim.status !== "claimed" || claim.claim_token !== claimToken) {
    throw new Error("Stripe fulfillment claim token did not match")
  }

  try {
    await processPostPaymentFulfillment(
      settlement.orderId,
      settlement.siteId,
      settlement.saleId,
      settlement.leadId || undefined,
      settlement.orderUserId || "",
      {
        stripeSessionId: checkout.session.id,
        fulfillmentClaimToken: claimToken,
      },
    )
    await activateOrderSubscriptions(supabase, checkout, settlement)

    const { data: completed, error: completeError } = await supabase.rpc(
      "complete_stripe_sale_fulfillment",
      {
        p_session_id: checkout.session.id,
        p_claim_token: claimToken,
      },
    )
    if (completeError || completed !== true) {
      throw new Error(
        `Failed to complete Stripe fulfillment: ${
          completeError?.message || "claim not owned"
        }`,
      )
    }
  } catch (fulfillmentError) {
    await failFulfillmentClaim(
      supabase,
      checkout.session.id,
      claimToken,
    )
    throw fulfillmentError
  }
}

export async function processStripeSaleSettlementEffects(params: {
  supabase: SettlementEffectsClient
  stripe: Stripe
  checkout: ValidatedSaleCheckoutSession
  settlement: AcceptedSettlement
}): Promise<void> {
  const { supabase, stripe, checkout, settlement } = params

  await applyFinancialEffects(supabase, stripe, checkout, settlement)
  await applyOrderFulfillment(supabase, checkout, settlement)
}
