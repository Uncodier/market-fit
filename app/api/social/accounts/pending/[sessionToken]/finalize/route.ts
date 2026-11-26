import { NextRequest, NextResponse } from "next/server"
import { createSocialSupabaseClient, SocialLocationAccessError } from "@/app/api/social/supabase-client"
import { getOutstandIntegrationUrl } from "@/lib/api-server-url"
import { getSocialAccountLimit, countSocialAccounts, canConnectSocialAccount } from "@/lib/billing-limits"
import { billingLimitApiError } from "@/lib/billing-limit-errors"
import { effectiveBillingPlan } from "@/lib/billing/startup-trial"
import { readWithTemporaryWorkspaceLicense, type SocialBillingSiteRow } from "@/lib/billing/read-temporary-workspace-license"
import { syncImplicitOutstandCallback } from "@/app/api/social/lib/sync-outstand-accounts"
import { isSiteManagerRole } from "@/lib/auth/api-site-access"
import { lookupCurrentUserSiteRole, SiteRoleLookupError } from "@/lib/auth/site-role-lookup"
import { getOutstandNetworkFromPath } from "@/app/api/social/network-map"
import { isSameOriginRequest } from "@/lib/http/is-same-origin-request"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"
import { z } from "zod"

const ids = z.array(z.string().trim().min(1).max(240)).max(250)
const input = z.object({ siteId: z.string().uuid(), network: z.string().max(32).optional(),
  selectedPageIds: ids.optional(), accountIds: ids.optional(),
}).strict()
const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionToken: string }> }
) {
  try {
    const supabase = await createSocialSupabaseClient()
    if (!isSameOriginRequest(request)) return fail("Forbidden request origin", 403)
    const { sessionToken } = await params
    if (!sessionToken || sessionToken.length > 2048 || !/^[\w.~-]+$/.test(sessionToken)) return fail("Invalid session", 400)
    let raw: unknown
    try {
      raw = JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 65536)))
    } catch (error) {
      return fail("Invalid social account selection", error instanceof RequestBodyTooLargeError ? 413 : 400)
    }
    const parsed = input.safeParse(raw)
    if (!parsed.success || (parsed.data.network && !getOutstandNetworkFromPath(parsed.data.network))) {
      return fail("Invalid social account selection", 400)
    }
    const body = parsed.data
    const siteId = body.siteId.toLowerCase()
    const selectedPageIds = [...new Set(body.selectedPageIds ?? body.accountIds ?? [])]
    if (!selectedPageIds.length) return fail("Select at least one social account", 400)
    if (!isSiteManagerRole(await lookupCurrentUserSiteRole(supabase, siteId))) return fail("Forbidden", 403)
    const key = process.env.SERVICE_API_KEY
    if (!key) return fail("Social connection is not configured", 503)

    const { data: site, error } = await readWithTemporaryWorkspaceLicense(field => supabase.from("sites")
      .select(field
        ? "id, settings(social_media, channels), billing(plan, auto_renew, addons_count, trial_started_at, trial_ends_at, trial_converted_at, subscription_status, paid_subscription_period_start, paid_subscription_period_end, temporary_workspace_license)"
        : "id, settings(social_media, channels), billing(plan, auto_renew, addons_count, trial_started_at, trial_ends_at, trial_converted_at, subscription_status, paid_subscription_period_start, paid_subscription_period_end)")
      .eq("id", siteId).is("archived_at", null).maybeSingle().overrideTypes<SocialBillingSiteRow, { merge: false }>())
    if (error || !site) return fail("Site settings are unavailable", 503)
    const settings = Array.isArray(site.settings) ? site.settings[0] : site.settings
    const billing = Array.isArray(site.billing) ? site.billing[0] : site.billing
    const mappedSite = { settings: { channels: settings?.channels, social_media: settings?.social_media }, billing: billing ?? undefined }
    if (!canConnectSocialAccount(mappedSite, selectedPageIds.length)) {
      const limit = getSocialAccountLimit(effectiveBillingPlan(billing)) + (billing?.addons_count || 0)
      return NextResponse.json(billingLimitApiError("accounts", countSocialAccounts(mappedSite) + selectedPageIds.length, limit), { status: 403 })
    }

    const response = await fetch(
      getOutstandIntegrationUrl(`/social-accounts/pending/${encodeURIComponent(sessionToken)}/finalize`),
      {
        method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000),
        headers: { 
          "Content-Type": "application/json",
          "x-api-key": key
        },
        body: JSON.stringify({
          selectedPageIds,
          accountIds: selectedPageIds,
          siteId,
        }),
      }
    )
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data.success !== true) return fail("Could not finalize the social connection", 502)

    if (body.network) {
      let sync = await syncImplicitOutstandCallback({
        supabase,
        siteId,
        pathNetwork: body.network,
      })
      if (!sync.ok) {
        await new Promise((resolve) => setTimeout(resolve, 800))
        sync = await syncImplicitOutstandCallback({
          supabase,
          siteId,
          pathNetwork: body.network,
        })
      }
      if (!sync.ok) {
        return fail("Could not verify the social connection. Please try again.", 502)
      }
    }

    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    if (error instanceof SocialLocationAccessError || error instanceof SiteRoleLookupError) return fail(error.message, error.status)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
