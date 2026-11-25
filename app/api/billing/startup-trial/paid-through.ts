import "server-only"
import type { requireSiteAccess } from "@/lib/auth/api-site-access"
import type { createServiceClient } from "@/lib/supabase/server"
import { withTimeout } from "@/app/services/request-timeout"
import { paidThroughSchema } from "@/lib/billing/startup-trial"

type SiteAccess = Extract<Awaited<ReturnType<typeof requireSiteAccess>>, { role: string }>

export async function readPaidThrough(
  siteId: string, access: SiteAccess, service: Awaited<ReturnType<typeof createServiceClient>>,
): Promise<string | undefined> {
  if (access.role !== "owner") return
  const controller = new AbortController()
  try {
    return await withTimeout((async () => {
      // Read the binding with the owner's RLS-scoped client, never from the request.
      const { data: billing, error } = await access.supabase.from("billing")
        .select("stripe_customer_id,stripe_subscription_id")
        .eq("site_id", siteId).eq("subscription_status", "canceled").eq("auto_renew", false)
        .abortSignal(controller.signal).maybeSingle()
      if (controller.signal.aborted || error || !billing?.stripe_customer_id || !billing.stripe_subscription_id) return

      const result = await service.rpc("stripe_late_renewal_paid_through", {
        p_site_id: siteId,
        p_customer_id: billing.stripe_customer_id,
        p_subscription_id: billing.stripe_subscription_id,
      }).abortSignal(controller.signal)
      if (result.error) return
      const parsed = paidThroughSchema.safeParse(result.data)
      if (parsed.success && Date.parse(parsed.data) > Date.now()) return parsed.data
    })(), 2_000, "Paid-through status unavailable")
  } catch {
    // This optional read must not imply access or break the existing trial status.
    return undefined
  } finally {
    controller.abort()
  }
}