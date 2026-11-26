import { NextRequest, NextResponse } from "next/server"
import { createSocialSupabaseClient, SocialLocationAccessError } from "@/app/api/social/supabase-client"
import { getOutstandIntegrationUrl } from "@/lib/api-server-url"
import { getOutstandNetworkFromPath } from "@/app/api/social/network-map"
import { isSiteManagerRole } from "@/lib/auth/api-site-access"
import { lookupCurrentUserSiteRole, SiteRoleLookupError } from "@/lib/auth/site-role-lookup"
import { isSameOriginRequest } from "@/lib/http/is-same-origin-request"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"
import { z } from "zod"

const input = z.object({ redirect_uri: z.string().url().max(2048), tenant_id: z.string().uuid() }).strict()
const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ network: string }> }
) {
  try {
    const supabase = await createSocialSupabaseClient()
    if (!isSameOriginRequest(request)) return fail("Forbidden request origin", 403)
    const { network } = await params
    const providerNetwork = getOutstandNetworkFromPath(network)
    if (!providerNetwork || providerNetwork === "bluesky") return fail("Unsupported OAuth network", 400)
    let body: unknown
    try {
      body = JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 4096)))
    } catch (error) {
      return fail("Invalid OAuth request", error instanceof RequestBodyTooLargeError ? 413 : 400)
    }
    const parsed = input.safeParse(body)
    if (!parsed.success) return fail("Invalid OAuth request", 400)
    const siteId = parsed.data.tenant_id.toLowerCase()
    const querySite = request.nextUrl.searchParams.get("siteId")
    if (querySite && querySite.toLowerCase() !== siteId) return fail("Invalid site", 400)
    if (!isSiteManagerRole(await lookupCurrentUserSiteRole(supabase, siteId))) return fail("Forbidden", 403)

    const acceptedOrigins = [request.headers.get("origin"), process.env.SSH_TUNNEL_URL, process.env.NEXT_PUBLIC_APP_URL,
      process.env.NEXT_PUBLIC_SSH_TUNNEL_URL, process.env.NEXT_PUBLIC_PRODUCTION_URL || "https://app.makinari.com"]
    const redirect = new URL(parsed.data.redirect_uri)
    if (redirect.protocol !== "https:" || redirect.username || redirect.password || !acceptedOrigins.some(origin => origin?.replace(/\/$/, "") === redirect.origin)) {
      return fail("Invalid OAuth redirect origin", 400)
    }
    const redirectUri = new URL(`/api/social/callback/${encodeURIComponent(network)}`, redirect.origin)
    redirectUri.searchParams.set("siteId", siteId)
    const key = process.env.SERVICE_API_KEY
    if (!key) return fail("Social connection is not configured", 503)

    const response = await fetch(
      `${getOutstandIntegrationUrl(`/social-networks/${providerNetwork}/auth-url`)}?siteId=${encodeURIComponent(siteId)}`,
      {
        method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000),
        headers: { 
          "Content-Type": "application/json",
          "x-api-key": key
        },
        body: JSON.stringify({ tenant_id: siteId, redirect_uri: redirectUri.toString() }),
      }
    )

    const data = await response.json().catch(() => ({}))
    if (!response.ok || data?.success !== true || typeof data.data?.auth_url !== "string") {
      return fail("Could not start social authorization", 502)
    }
    const authUrl = new URL(data.data.auth_url)
    if (authUrl.protocol !== "https:" || authUrl.username || authUrl.password) return fail("Invalid social authorization URL", 502)
    return NextResponse.json({ success: true, data: { auth_url: data.data.auth_url } }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    if (error instanceof SocialLocationAccessError || error instanceof SiteRoleLookupError) return fail(error.message, error.status)
    return fail("Could not start social authorization", 502)
  }
}
