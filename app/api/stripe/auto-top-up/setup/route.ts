import "server-only"
import Stripe from "stripe"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/server"
import { requireStripeSiteAccess } from "@/lib/auth/api-stripe-access"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { isSameOriginApiRequest } from "@/lib/http/api-proxy-security"
import { readLimitedRequestBody, decodeRequestBody } from "@/lib/http/read-limited-request-body"
import { resolveCheckoutUrls } from "@/app/api/stripe/checkout/checkout-url-security"

const schema = z.object({ siteId: z.string().uuid() }).strict()
export async function POST(request: Request) {
  if (!isSameOriginApiRequest(request)) return Response.json({ error: "Forbidden origin" }, { status: 403 })
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return Response.json({ error: "JSON required" }, { status: 415 })
  let siteId: string
  try { siteId = schema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 4096)))).siteId }
  catch { return Response.json({ error: "Invalid site" }, { status: 400 }) }
  try {
    const access = await requireStripeSiteAccess(request, siteId)
    if (access.error) return access.error
    if (!await userCanOnSite(access.supabase, siteId, "update")) return Response.json({ error: "Forbidden" }, { status: 403 })
    const origin = request.headers.get("origin")
    const urls = resolveCheckoutUrls(request, origin ? new URL(`/billing?siteId=${siteId}`, origin).toString() : null,
      origin ? new URL(`/billing?siteId=${siteId}&auto_top_up_setup=1`, origin).toString() : null, {})
    if (urls.error || !process.env.STRIPE_SECRET_KEY) return Response.json({ error: "Payment setup unavailable" }, { status: 503 })
    const { data: billing, error } = await access.supabase.from("billing")
      .select("stripe_customer_id").eq("site_id", siteId).maybeSingle()
    if (error || !billing?.stripe_customer_id) return Response.json({ error: "Create a billing account by purchasing credits or subscribing first" }, { status: 409 })
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-05-28.basil", timeout: 20000, maxNetworkRetries: 0 })
    const customer = await stripe.customers.retrieve(billing.stripe_customer_id)
    if (customer.deleted || customer.id !== billing.stripe_customer_id || customer.metadata?.site_id !== siteId) return Response.json({ error: "Billing customer does not match" }, { status: 409 })
    const service = await createServiceClient(true)
    const { data: setup, error: setupError } = await service.rpc("begin_credit_auto_top_up_setup", {
      p_site_id: siteId, p_actor_id: access.userId,
    })
    if (setupError || setup?.outcome !== "started" || !z.string().uuid().safeParse(setup.token).success ||
        setup.stripe_customer_id !== customer.id) throw new Error("Card setup admission unavailable")
    const session = await stripe.checkout.sessions.create({
      mode: "setup", customer: customer.id, payment_method_types: ["card"],
      success_url: urls.successUrl, cancel_url: urls.cancelUrl,
      metadata: { type: "credit_auto_top_up_setup", site_id: siteId, setup_token: setup.token },
      setup_intent_data: { metadata: { type: "credit_auto_top_up_setup", site_id: siteId, setup_token: setup.token } },
    }, { idempotencyKey: `credit-top-up-setup-${setup.token}` })
    return Response.json({ url: session.url }, { headers: { "Cache-Control": "private, no-store" } })
  } catch {
    return Response.json({ error: "Payment setup unavailable" }, { status: 503 })
  }
}
