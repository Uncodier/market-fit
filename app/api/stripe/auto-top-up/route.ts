import "server-only"
import { z } from "zod"
import Stripe from "stripe"
import { createHash } from "node:crypto"
import { billingCardSummary, resolveBillingPaymentMethod } from "@/lib/billing/payment-method.server"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { createServiceClient } from "@/lib/supabase/server"
import { isSameOriginApiRequest } from "@/lib/http/api-proxy-security"
import { readLimitedRequestBody, decodeRequestBody } from "@/lib/http/read-limited-request-body"

const siteSchema = z.string().uuid()
const configSchema = z.object({
  siteId: siteSchema,
  enabled: z.boolean(),
  consentAccepted: z.boolean().optional(),
  billingCardFingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  minimumCredits: z.number().finite().nonnegative().max(10000),
  targetCredits: z.number().finite().positive().max(10000),
  maxMonthlySpendCents: z.number().int().min(100).max(100000),
}).strict().refine(v => v.targetCredits > v.minimumCredits, { message: "Target must exceed minimum" })
  .refine(v => !v.enabled || v.consentAccepted === true, { message: "Explicit consent required" })
const headers = { "Cache-Control": "private, no-store" }
const fingerprint = (id: string) => createHash("sha256").update(id).digest("hex")
function stripeClient() {
  return process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-05-28.basil", timeout: 10000, maxNetworkRetries: 0,
  }) : null
}

async function authorize(request: Request, siteId: string) {
  const access = await requireSiteAccess(request, siteId, { requireManager: true })
  if (access.error) return { error: access.error }
  if (!await userCanOnSite(access.supabase, siteId, "update")) {
    return { error: Response.json({ error: "Forbidden" }, { status: 403, headers }) }
  }
  return { access }
}

export async function GET(request: Request) {
  const siteId = new URL(request.url).searchParams.get("siteId")
  if (!siteSchema.safeParse(siteId).success) return Response.json({ error: "Invalid site" }, { status: 400, headers })
  try {
    const allowed = await authorize(request, siteId!)
    if (allowed.error) return allowed.error
    const service = await createServiceClient(true)
    const { data, error } = await service.from("credit_auto_top_up_settings")
      .select("enabled,minimum_credits,target_credits,max_monthly_spend_cents,stripe_payment_method_id,state")
      .eq("site_id", siteId!).maybeSingle()
    if (error) throw error
    const { data: setup, error: setupError } = await service.from("credit_auto_top_up_card_setups")
      .select("token,status,stripe_customer_id,stripe_payment_method_id,source").eq("site_id", siteId!).maybeSingle()
    if (setupError) throw setupError
    const { data: pending, error: pendingError } = await service.from("credit_auto_top_up_attempts")
      .select("id").eq("site_id", siteId!).eq("status", "pending").maybeSingle()
    if (pendingError) throw pendingError
    const { data: billing, error: billingError } = await allowed.access!.supabase.from("billing")
      .select("stripe_customer_id,stripe_subscription_id").eq("site_id", siteId!).maybeSingle()
    if (billingError) throw billingError
    const stripe = stripeClient()
    const customerId = billing?.stripe_customer_id
    let card: Stripe.PaymentMethod | null = null
    let source: "billing" | "top_up" | null = null
    const configuredCard = setup?.status === "completed" &&
      setup.stripe_customer_id === customerId && setup.stripe_payment_method_id === data?.stripe_payment_method_id
    if (stripe && customerId) {
      if (configuredCard) {
        card = await stripe.paymentMethods.retrieve(setup.stripe_payment_method_id)
        if (!billingCardSummary(card, customerId)) card = null
        source = card ? (setup.source === "billing" ? "billing" : "top_up") : null
      } else if (setup?.status !== "pending") {
        card = await resolveBillingPaymentMethod(stripe, customerId, siteId!, billing.stripe_subscription_id)
        source = card ? "billing" : null
      }
    }
    const ready = Boolean(card && setup?.status === "completed" && setup.stripe_customer_id === customerId &&
      setup.stripe_payment_method_id === card.id && data?.stripe_payment_method_id === card.id)
    return Response.json({ settings: {
      enabled: data?.enabled ?? false,
      minimumCredits: Number(data?.minimum_credits ?? 5),
      targetCredits: Number(data?.target_credits ?? 20),
      maxMonthlySpendCents: data?.max_monthly_spend_cents ?? 10000,
      paymentMethodReady: ready,
      billingCardAvailable: source === "billing",
      paymentMethod: card && customerId ? billingCardSummary(card, customerId) : null,
      paymentMethodSource: source,
      billingCardFingerprint: card && source === "billing" ? fingerprint(card.id) : undefined,
      state: data?.state ?? "ready",
      pending: Boolean(pending),
      needsAttention: data?.state === "paused" || Boolean(pending),
    } }, { headers })
  } catch {
    return Response.json({ error: "Automatic top-up is unavailable" }, { status: 503, headers })
  }
}

export async function POST(request: Request) {
  if (!isSameOriginApiRequest(request)) return Response.json({ error: "Forbidden origin" }, { status: 403, headers })
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return Response.json({ error: "JSON required" }, { status: 415, headers })
  }
  let config: z.infer<typeof configSchema>
  try {
    config = configSchema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 4096))))
  } catch {
    return Response.json({ error: "Invalid automatic top-up settings" }, { status: 400, headers })
  }
  try {
    const allowed = await authorize(request, config.siteId)
    if (allowed.error) return allowed.error
    const service = await createServiceClient(true)
    const values = {
      p_site_id: config.siteId, p_actor_id: allowed.access!.userId,
      p_enabled: config.enabled, p_minimum_credits: config.minimumCredits,
      p_target_credits: config.targetCredits, p_max_monthly_spend_cents: config.maxMonthlySpendCents,
    }
    let result
    if (config.enabled) {
      const { data: setup, error: setupError } = await service.from("credit_auto_top_up_card_setups")
        .select("token,status,source,stripe_payment_method_id,stripe_customer_id").eq("site_id", config.siteId).maybeSingle()
      if (setupError) throw setupError
      if (setup?.status === "pending") return Response.json({ error: "Complete the card setup first" }, { status: 409, headers })
      if (setup?.status === "completed" && setup.source === "top_up") {
        result = await service.rpc("set_credit_auto_top_up_settings", values)
      } else {
        const { data: billing, error: billingError } = await allowed.access!.supabase.from("billing")
          .select("stripe_customer_id,stripe_subscription_id").eq("site_id", config.siteId).maybeSingle()
        if (billingError) throw billingError
        const stripe = stripeClient()
        if (!stripe || !billing?.stripe_customer_id) throw new Error("Billing card unavailable")
        const method = setup?.status === "completed" && setup.source === "billing" &&
          setup.stripe_customer_id === billing.stripe_customer_id
          ? await stripe.paymentMethods.retrieve(setup.stripe_payment_method_id)
          : await resolveBillingPaymentMethod(stripe, billing.stripe_customer_id, config.siteId, billing.stripe_subscription_id)
        if (!method || !billingCardSummary(method, billing.stripe_customer_id) || !config.billingCardFingerprint || config.billingCardFingerprint !== fingerprint(method.id)) {
          return Response.json({ error: "Billing card changed or unavailable; reload before consenting" }, { status: 409, headers })
        }
        result = await service.rpc("save_credit_auto_top_up_with_billing_card", {
          p_site_id: config.siteId, p_actor_id: allowed.access!.userId,
          p_stripe_customer_id: billing.stripe_customer_id, p_stripe_payment_method_id: method.id,
          p_expected_setup_token: setup?.token ?? null,
          p_minimum_credits: config.minimumCredits, p_target_credits: config.targetCredits,
          p_max_monthly_spend_cents: config.maxMonthlySpendCents,
        })
      }
    } else result = await service.rpc("set_credit_auto_top_up_settings", values)
    const { data, error } = result
    if (error || data?.outcome !== "saved") throw error ?? new Error("Invalid settings result")
    return Response.json({ success: true }, { headers })
  } catch {
    return Response.json({ error: "Could not save automatic top-up settings; no change was confirmed" }, { status: 503, headers })
  }
}
