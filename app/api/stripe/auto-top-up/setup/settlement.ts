import "server-only"
import type Stripe from "stripe"
import { createServiceClient } from "@/lib/supabase/server"

export async function settleAutoTopUpSetup(stripe: Stripe, payload: Stripe.Checkout.Session) {
  const session = await stripe.checkout.sessions.retrieve(payload.id)
  if (session.mode !== "setup" || session.status !== "complete" ||
      session.metadata?.type !== "credit_auto_top_up_setup" || !session.metadata.site_id || !session.metadata.setup_token ||
      !session.customer || !session.setup_intent) throw new Error("Invalid top-up setup")
  const siteId = session.metadata.site_id
  const service = await createServiceClient(true)
  const { data: billing, error } = await service.from("billing").select("stripe_customer_id")
    .eq("site_id", siteId).maybeSingle()
  if (error || billing?.stripe_customer_id !== session.customer) throw new Error("Billing customer mismatch")
  const customer = await stripe.customers.retrieve(session.customer as string)
  if (customer.deleted || customer.metadata?.site_id !== siteId) throw new Error("Customer identity mismatch")
  const setupId = typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent.id
  const intent = await stripe.setupIntents.retrieve(setupId)
  if (intent.id !== setupId || intent.usage !== "off_session" || intent.status !== "succeeded" || intent.customer !== session.customer ||
      intent.metadata?.setup_token !== session.metadata.setup_token ||
      intent.metadata?.site_id !== siteId || intent.metadata?.type !== "credit_auto_top_up_setup" ||
      !intent.payment_method || typeof intent.payment_method !== "string") throw new Error("Unverified top-up setup")
  const method = await stripe.paymentMethods.retrieve(intent.payment_method)
  if (method.customer !== session.customer || method.type !== "card") throw new Error("Payment method not attached")
  const { data, error: saveError } = await service.rpc("complete_credit_auto_top_up_setup", {
    p_site_id: siteId, p_token: session.metadata.setup_token, p_stripe_customer_id: session.customer, p_stripe_payment_method_id: method.id,
  })
  if (saveError || !["attached", "obsolete", "duplicate"].includes(data?.outcome)) throw new Error("Could not save payment method")
}
