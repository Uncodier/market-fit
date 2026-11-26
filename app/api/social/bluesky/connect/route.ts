import { NextResponse } from "next/server"
import { z } from "zod"
import { createSocialSupabaseClient, SocialLocationAccessError } from "@/app/api/social/supabase-client"
import { mergeOutstandIntoSocialMedia } from "@/app/api/social/lib/sync-outstand-accounts"
import { getOutstandIntegrationUrl } from "@/lib/api-server-url"
import { isSiteManagerRole } from "@/lib/auth/api-site-access"
import { lookupCurrentUserSiteRole, SiteRoleLookupError } from "@/lib/auth/site-role-lookup"
import { canConnectSocialAccount, countSocialAccounts, getSocialAccountLimit } from "@/lib/billing-limits"
import { effectiveBillingPlan } from "@/lib/billing/startup-trial"
import { readWithTemporaryWorkspaceLicense, type SocialBillingSiteRow } from "@/lib/billing/read-temporary-workspace-license"
import { billingLimitApiError } from "@/lib/billing-limit-errors"
import { isSameOriginRequest } from "@/lib/http/is-same-origin-request"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"

const handleKey = (handle: string) => handle.trim().replace(/^@/, "").toLowerCase()
const inputSchema = z.object({
  siteId: z.string().uuid().transform(id => id.toLowerCase()),
  handle: z.string().max(255).transform(handleKey).pipe(z.string().max(253)
    .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/)),
  app_password: z.string().trim().min(1).max(128),
}).strict()
const accountSchema = z.object({ success: z.literal(true), data: z.object({
  id: z.string().min(1).max(240), network: z.literal("bluesky"), username: z.string().optional().nullable(),
  orgId: z.string().nullish(), nickname: z.string().nullish(), accountType: z.string().nullish(),
  profile_picture_url: z.string().nullish(), network_unique_id: z.string().nullish(),
  customer_social_network_id: z.number().nullish(), createdAt: z.string().nullish(),
}) })
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } })
const fail = (error: string, status: number) => reply({ success: false, error }, status)

export async function POST(request: Request) {
  try {
    const supabase = await createSocialSupabaseClient()
    if (!isSameOriginRequest(request)) return fail("Forbidden request origin", 403)
    let body: unknown
    try {
      body = JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 4096)))
    } catch (error) {
      return fail("Invalid Bluesky connection request", error instanceof RequestBodyTooLargeError ? 413 : 400)
    }
    const parsed = inputSchema.safeParse(body)
    if (!parsed.success) return fail("Enter a valid Bluesky handle and app password", 400)
    const { siteId, handle, app_password } = parsed.data
    if (!isSiteManagerRole(await lookupCurrentUserSiteRole(supabase, siteId))) return fail("Forbidden", 403)

    const { data: site, error } = await readWithTemporaryWorkspaceLicense(field => supabase.from("sites")
      .select(field
        ? "id, settings(id, social_media, channels, updated_at), billing(plan, auto_renew, addons_count, trial_started_at, trial_ends_at, trial_converted_at, subscription_status, paid_subscription_period_start, paid_subscription_period_end, temporary_workspace_license)"
        : "id, settings(id, social_media, channels, updated_at), billing(plan, auto_renew, addons_count, trial_started_at, trial_ends_at, trial_converted_at, subscription_status, paid_subscription_period_start, paid_subscription_period_end)")
      .eq("id", siteId).is("archived_at", null).maybeSingle().overrideTypes<SocialBillingSiteRow, { merge: false }>())
    if (error) return fail("Site settings are unavailable", 503)
    const settings = Array.isArray(site?.settings) ? site.settings[0] : site?.settings
    const billing = Array.isArray(site?.billing) ? site.billing[0] : site?.billing
    if (!settings) return fail("Site settings are unavailable", 404)
    const existing = Array.isArray(settings.social_media) ? settings.social_media : []
    const matchingAccount = existing.some(row => row?.id && row.platform === "bluesky"
      && (row.isActive === true || row.isActive === 1)
      && [row.username, row.handle].some(value => typeof value === "string" && handleKey(value) === handle))
    const entitlement = { settings: { channels: settings.channels, social_media: existing }, billing: billing ?? undefined }
    if (!matchingAccount && !canConnectSocialAccount(entitlement)) {
      return reply(billingLimitApiError("accounts", countSocialAccounts(entitlement) + 1,
        getSocialAccountLimit(effectiveBillingPlan(billing)) + (billing?.addons_count || 0)), 403)
    }

    const serviceKey = process.env.SERVICE_API_KEY
    if (!serviceKey) return fail("Bluesky is not configured", 503)
    const response = await fetch(getOutstandIntegrationUrl("/social-accounts/bluesky"), {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000),
      headers: { "Content-Type": "application/json", "x-api-key": serviceKey },
      body: JSON.stringify({ handle, app_password, siteId }),
    })
    const result = accountSchema.safeParse(response.ok ? await response.json().catch(() => null) : null)
    if (!result.success) return fail("Could not connect Bluesky. Check your handle and app password.", 502)
    const data = result.data.data
    if (data.username && handleKey(data.username) !== handle) return fail("Could not verify the connected Bluesky account", 502)
    const account = { ...data, username: data.username || handle, orgId: data.orgId ?? undefined,
      nickname: data.nickname ?? undefined, accountType: data.accountType ?? undefined,
      profile_picture_url: data.profile_picture_url ?? undefined, network_unique_id: data.network_unique_id ?? undefined,
      customer_social_network_id: data.customer_social_network_id ?? undefined, createdAt: data.createdAt ?? undefined }
    const { socialMedia } = mergeOutstandIntoSocialMedia(existing, [account], "bluesky")
    let save = supabase.from("settings").update({ social_media: socialMedia, updated_at: new Date().toISOString() })
      .eq("site_id", siteId).eq("id", settings.id)
    save = settings.updated_at ? save.eq("updated_at", settings.updated_at) : save.is("updated_at", null)
    const saved = await save.select("id").maybeSingle()
    if (saved.error || !saved.data) return reply({ success: false, connected: true,
      error: "Bluesky accepted the connection, but settings could not be saved. Reconnect the same handle to retry." }, saved.error ? 503 : 409)

    return reply({ success: true })
  } catch (error) {
    if (error instanceof SocialLocationAccessError || error instanceof SiteRoleLookupError) return fail(error.message, error.status)
    return fail("Bluesky connection is temporarily unavailable", 503)
  }
}