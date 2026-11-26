import { NextRequest, NextResponse } from "next/server"
import { createSocialSupabaseClient, SocialLocationAccessError } from "@/app/api/social/supabase-client"
import { getOutstandNetworkFromPath } from "@/app/api/social/network-map"
import { syncImplicitOutstandCallback } from "@/app/api/social/lib/sync-outstand-accounts"
import { isSiteManagerRole } from "@/lib/auth/api-site-access"
import { lookupCurrentUserSiteRole, SiteRoleLookupError } from "@/lib/auth/site-role-lookup"
import { z } from "zod"

/**
 * Outstand white-label callback for Facebook, LinkedIn, X, etc.
 *
 * Outstand: "The callback url lies on your app, and then you call the finalization API endpoint."
 * — "Callback lies on your app" = **Outstand** redirects to this URL with ?session= or ?error=.
 *   **Facebook does NOT redirect here**; Facebook redirects to Outstand. Only Outstand calls us.
 *
 * Doc: "We will redirect to it with a session query parameter" (it = our redirect_uri; We = Outstand).
 * https://www.outstand.so/docs/configurations/facebook#white-labeling-authentication-flow
 *
 * FLOW: We request auth-url with redirect_uri=this URL → User→Outstand→Provider→Outstand
 * → Outstand redirects HERE with ?session= or ?error= → we go to /settings/social_network, then pending+finalize.
 *
 * Implicit success (e.g. X): Outstand may redirect without ?session= or ?error= after OAuth success.
 * In that case we list Outstand `/v1/social-accounts` for the tenant and merge new accounts into settings.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ network: string }> }
) {
  const { network } = await params
  const outstandNetwork = getOutstandNetworkFromPath(network ?? "")

  const { searchParams } = request.nextUrl
  const baseUrl = getBaseUrl(request)

  if (!outstandNetwork) {
    return redirectToSettings(`Invalid network: ${network}`, baseUrl)
  }

  const session = searchParams.get("session")
  const tenantFromQuery = searchParams.get("tenant_id")
  const siteId = searchParams.get("siteId") || tenantFromQuery
  const error = searchParams.get("error")

  // 1) Outstand sends error: they couldn't get or process code/state from the provider.
  if (error) {
    const msg =
      error === "Missing code or state parameter"
        ? "Outstand could not process the code/state from " +
          network +
          ". Facebook's redirect_uri=outstand.so is correct (Outstand then sends you to us). In your " +
          network +
          " App: add https://www.outstand.so/app/api/socials/" +
          network +
          "/callback to Valid OAuth Redirect URIs and outstand.so to App Domains. If both are set, contact Outstand (contact@outstand.so)."
        : "Social authorization did not complete. Please try again."
    const dest = new URL(`${baseUrl}/settings/social_network`)
    dest.searchParams.set("error", "oauth_failed")
    dest.searchParams.set("error_description", msg)
    dest.searchParams.set("network", network)
    if (error === "Missing code or state parameter") {
      dest.searchParams.set("our_redirect_uri", `${baseUrl}/api/social/callback/${network}`)
      dest.searchParams.set("outstand_error", "Missing code or state parameter")
    }
    return NextResponse.redirect(dest.toString())
  }

  // 2) Outstand sends session: redirect to page selection, then we call pending + finalize.
  if (session) {
    const dest = new URL(`${baseUrl}/settings/social_network`)
    dest.searchParams.set("session", session)
    dest.searchParams.set("network", network)
    if (siteId) dest.searchParams.set("siteId", siteId)
    return NextResponse.redirect(dest.toString())
  }

  // 3) No explicit error: assume provider flow completed — verify via Outstand tenant account list and merge into settings.
  if (!siteId || !z.string().uuid().safeParse(siteId).success) {
    return redirectToSettings(
      "Missing siteId (or tenant_id) in callback URL. Your redirect_uri must include ?siteId=<tenant> so we can verify the connection.",
      baseUrl
    )
  }

  let supabase
  try {
    supabase = await createSocialSupabaseClient()
  } catch (error) {
    if (error instanceof SocialLocationAccessError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: "Authorization unavailable" }, { status: 403 })
  }
  const {
    data: { session: userSession },
  } = await supabase.auth.getSession()

  if (!userSession) {
    const dest = new URL(`${baseUrl}/settings/social_network`)
    dest.searchParams.set("error", "oauth_failed")
    dest.searchParams.set(
      "error_description",
      "Sign in required to sync the social account. Please open the app, sign in, and connect again."
    )
    dest.searchParams.set("network", network)
    return NextResponse.redirect(dest.toString())
  }

  try {
    if (!isSiteManagerRole(await lookupCurrentUserSiteRole(supabase, siteId))) {
      return redirectToSettings("You do not have permission to connect accounts for this site.", baseUrl)
    }
  } catch (error) {
    return redirectToSettings(error instanceof SiteRoleLookupError ? error.message : "Site access could not be verified.", baseUrl)
  }

  const sync = await syncImplicitOutstandCallback({
    supabase,
    siteId,
    pathNetwork: network,
  })

  if (!sync.ok) {
    return redirectToSettings("Could not verify the social connection. Please try again.", baseUrl)
  }

  const dest = new URL(`${baseUrl}/settings`)
  dest.searchParams.set("tab", "social")
  dest.searchParams.set("oauth_connected", "1")
  dest.searchParams.set("oauth_site", siteId)
  dest.searchParams.set("oauth_network", network)
  return NextResponse.redirect(dest.toString())
}

function getBaseUrl(request: NextRequest): string {
  const origins = [process.env.SSH_TUNNEL_URL, process.env.NEXT_PUBLIC_SSH_TUNNEL_URL,
    process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_PRODUCTION_URL, "https://app.makinari.com"]
    .flatMap(value => {
      try {
        const url = new URL(value ?? "")
        return url.protocol === "https:" && !url.username && !url.password ? [url.origin] : []
      } catch { return [] }
    })
  return origins.find(origin => origin === request.nextUrl.origin) ?? origins[0]
}

function redirectToSettings(message: string, baseUrl: string): NextResponse {
  const url = new URL(`${baseUrl}/settings/social_network`)
  url.searchParams.set("error", "oauth_failed")
  url.searchParams.set("error_description", message)
  return NextResponse.redirect(url.toString())
}
