import "server-only"
import type Stripe from "stripe"
import { createServiceClient } from "@/lib/supabase/server"

/** Only a live Stripe intent, bound to the site's authorized attempt, can grant credits. */
export async function settleAutoTopUpIntent(
  stripe: Stripe, intent: Stripe.PaymentIntent, expected?: {siteId: string; attemptId: string},
): Promise<string> {
  if (intent.metadata?.type !== "credit_auto_top_up" || !intent.metadata.site_id || !intent.metadata.attempt_id) {
    throw new Error("Invalid automatic top-up intent")
  }
  if (expected && (expected.siteId !== intent.metadata.site_id || expected.attemptId !== intent.metadata.attempt_id)) {
    throw new Error("Unexpected automatic top-up intent")
  }
  const service = await createServiceClient(true)
  const { data: attempt, error } = await service.from("credit_auto_top_up_attempts")
    .select("id,site_id,credits,amount_cents,stripe_customer_id,stripe_payment_method_id,stripe_payment_intent_id,claim_token,status")
    .eq("id", intent.metadata.attempt_id).maybeSingle()
  if (error || !attempt || attempt.site_id !== intent.metadata.site_id) throw new Error("Unknown automatic top-up attempt")
  // The Stripe object from an event is only a hint; retrieve current authoritative status.
  const live = await stripe.paymentIntents.retrieve(intent.id)
  if (live.id !== intent.id || live.metadata?.attempt_id !== attempt.id ||
      live.metadata?.site_id !== attempt.site_id || live.metadata?.type !== "credit_auto_top_up" ||
      live.customer !== attempt.stripe_customer_id || live.payment_method !== attempt.stripe_payment_method_id ||
      live.currency !== "usd" || live.amount !== attempt.amount_cents ||
      (live.status === "succeeded" && live.amount_received !== attempt.amount_cents)) {
    throw new Error("Automatic top-up payment identity mismatch")
  }
  if (!attempt.stripe_payment_intent_id && attempt.status === "pending") {
    const { data, error: recordError } = await service.rpc("record_credit_auto_top_up_intent", {
      p_site_id: attempt.site_id, p_attempt_id: attempt.id, p_claim_token: attempt.claim_token,
      p_stripe_payment_intent_id: live.id,
    })
    if (recordError || data?.outcome !== "recorded") throw new Error("Cannot record Stripe intent")
  } else if (attempt.stripe_payment_intent_id !== live.id) throw new Error("Conflicting Stripe intent")
  if (live.status === "succeeded") {
    const { data, error: settleError } = await service.rpc("complete_credit_auto_top_up_attempt", {
      p_site_id: attempt.site_id, p_attempt_id: attempt.id, p_claim_token: attempt.claim_token, p_stripe_payment_intent_id: live.id,
      p_stripe_customer_id: attempt.stripe_customer_id, p_amount_cents: live.amount, p_currency: live.currency,
    })
    if (settleError || !["succeeded", "duplicate"].includes(data?.outcome)) throw new Error("Automatic top-up settlement unavailable")
  } else if (live.status === "canceled") {
    const { data, error: failError } = await service.rpc("fail_credit_auto_top_up_attempt", {
      p_site_id: attempt.site_id, p_attempt_id: attempt.id, p_claim_token: attempt.claim_token, p_stripe_payment_intent_id: live.id, p_stripe_status: live.status,
    })
    if (failError || !["failed", "duplicate"].includes(data?.outcome)) throw new Error("Automatic top-up failure record unavailable")
  }
  // Recoverable statuses retain the reservation, never grant or retry the charge.
  return live.status
}
