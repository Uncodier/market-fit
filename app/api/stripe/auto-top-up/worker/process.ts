import "server-only"
import type Stripe from "stripe"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/server"
import { settleAutoTopUpIntent } from "../settlement"

const claimSchema = z.object({
  outcome: z.literal("claimed"),
  attempt_id: z.string().uuid(),
  idempotency_key: z.string().min(1),
  claim_token: z.string().uuid(),
  claim_expires_at: z.string().datetime({ offset: true }),
  stripe_payment_intent_id: z.string().regex(/^pi_[A-Za-z0-9]+$/).nullable(),
  credits: z.number().int().positive(),
  amount_cents: z.number().int().positive(),
  stripe_customer_id: z.string().regex(/^cus_[A-Za-z0-9]+$/),
  stripe_payment_method_id: z.string().regex(/^pm_[A-Za-z0-9]+$/),
}).refine(v => v.amount_cents === v.credits * 100 && v.idempotency_key === `credit-auto-top-up-${v.attempt_id}`)

/** A provider error can include an intent. Its ID is only a hint, never proof of payment. */
function errorIntentId(error: unknown): string | null {
  if (!error || typeof error !== "object") return null
  const value = (error as { payment_intent?: unknown }).payment_intent
  const id = typeof value === "string" ? value : value && typeof value === "object" ? (value as { id?: unknown }).id : null
  return typeof id === "string" && /^pi_[A-Za-z0-9]+$/.test(id) ? id : null
}

export async function processAutoTopUpSite(stripe: Stripe, siteId: string): Promise<string> {
  // A suspended worker must not use an old admission or outlive the dispatch window.
  const deadline = Date.now() + 120_000
  const service = await createServiceClient(true)
  const { data, error } = await service.rpc("begin_credit_auto_top_up_attempt", { p_site_id: siteId })
  if (error) throw new Error("Top-up claim unavailable")
  if (["in_progress", "not_eligible", "needs_reconciliation"].includes(data?.outcome)) return data.outcome
  const claim = claimSchema.parse(data)
  const expected = { siteId, attemptId: claim.attempt_id }
  if (claim.stripe_payment_intent_id) {
    const intent = await stripe.paymentIntents.retrieve(claim.stripe_payment_intent_id)
    return settleAutoTopUpIntent(stripe, intent, expected)
  }

  const [customer, method] = await Promise.all([
    stripe.customers.retrieve(claim.stripe_customer_id),
    stripe.paymentMethods.retrieve(claim.stripe_payment_method_id),
  ])
  if (customer.deleted || customer.id !== claim.stripe_customer_id || customer.metadata?.site_id !== siteId ||
      method.id !== claim.stripe_payment_method_id || method.customer !== customer.id || method.type !== "card") {
    throw new Error("Top-up customer or payment method mismatch")
  }
  if (Date.now() >= Math.min(deadline, Date.parse(claim.claim_expires_at)) - 15_000) throw new Error("Top-up admission expired")
  const { data: dispatch, error: dispatchError } = await service.rpc("authorize_credit_auto_top_up_dispatch", {
    p_site_id: siteId, p_attempt_id: claim.attempt_id, p_claim_token: claim.claim_token,
  })
  if (dispatchError) throw new Error("Top-up dispatch unavailable")
  if (dispatch?.outcome !== "authorized") return "needs_reconciliation"
  if (Date.now() >= Math.min(deadline, Date.parse(claim.claim_expires_at)) - 15_000) throw new Error("Top-up dispatch expired")

  // Once dispatch is persisted, no worker is ever authorized to create again.
  // A timeout without a PI ID remains pending for webhook/operator reconciliation.
  let intent: Stripe.PaymentIntent
  try {
    intent = await stripe.paymentIntents.create({
      amount: claim.amount_cents, currency: "usd", customer: claim.stripe_customer_id,
      payment_method: claim.stripe_payment_method_id, payment_method_types: ["card"], confirm: true, off_session: true,
      metadata: { type: "credit_auto_top_up", site_id: siteId, attempt_id: claim.attempt_id, credits: String(claim.credits) },
    }, { idempotencyKey: claim.idempotency_key })
  } catch (cause) {
    const id = errorIntentId(cause)
    if (!id) throw new Error("Top-up outcome requires reconciliation")
    intent = await stripe.paymentIntents.retrieve(id)
  }
  return settleAutoTopUpIntent(stripe, intent, expected)
}
