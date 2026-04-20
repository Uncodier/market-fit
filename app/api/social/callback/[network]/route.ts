import { NextRequest, NextResponse } from "next/server"
import { createSocialSupabaseClient } from "@/app/api/social/supabase-client"
import { getOutstandNetworkFromPath } from "@/app/api/social/network-map"
import { syncImplicitOutstandCallback } from "@/app/api/social/lib/sync-outstand-accounts"

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

  // ---- LOG: Outstand redirects HERE with ?session= or ?error= ----
  const { searchParams } = request.nextUrl
  const allParams = Object.fromEntries(searchParams.entries())
  const authCookies = request.cookies.getAll().filter((c) => c.name.startsWith("sb-"))
  const hasAuthCookie = authCookies.some((c) => c.name.includes("-auth-token"))
  const authCookieNames = authCookies.map((c) => c.name)
  const baseUrl = getBaseUrl(request)
  console.log("[Social Callback OUTSTAND→US]", {
    at: new Date().toISOString(),
    network,
    url: request.url,
    queryParams: allParams,
    hasAuthCookie,
    authCookieNames: authCookieNames.length ? authCookieNames : "none",
    baseUrlForRedirect: baseUrl,
    host: request.headers.get("host"),
    "x-forwarded-host": request.headers.get("x-forwarded-host"),
    "x-forwarded-proto": request.headers.get("x-forwarded-proto"),
    referer: request.headers.get("referer"),
    "user-agent": request.headers.get("user-agent")?.slice(0, 80),
  })
  // ---- end LOG ----

  if (!outstandNetwork) {
    return redirectToSettings(`Invalid network: ${network}`, baseUrl)
  }

  const session = searchParams.get("session")
  const tenantFromQuery = searchParams.get("tenant_id")
  const siteId = searchParams.get("siteId") || tenantFromQuery
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  // 1) Outstand sends error: they couldn't get or process code/state from the provider.
  if (error) {
    console.error(`[Social Callback ${network}] Outstand error:`, error, errorDescription)
    const msg =
      error === "Missing code or state parameter"
        ? "Outstand could not process the code/state from " +
          network +
          ". Facebook's redirect_uri=outstand.so is correct (Outstand then sends you to us). In your " +
          network +
          " App: add https://www.outstand.so/app/api/socials/" +
          network +
          "/callback to Valid OAuth Redirect URIs and outstand.so to App Domains. If both are set, contact Outstand (contact@outstand.so)."
        : (errorDescription || error)
    const dest = new URL(`${baseUrl}/settings/social_network`)
    dest.searchParams.set("error", "oauth_failed")
    dest.searchParams.set("error_description", msg)
    dest.searchParams.set("network", network)
    if (error === "Missing code or state parameter") {
      dest.searchParams.set("our_redirect_uri", `${baseUrl}/api/social/callback/${network}`)
      dest.searchParams.set("outstand_error", "Missing code or state parameter")
    }
    console.log("[Social Callback OUTSTAND→US] redirect→", dest.toString())
    return NextResponse.redirect(dest.toString())
  }

  // 2) Outstand sends session: redirect to page selection, then we call pending + finalize.
  if (session) {
    const dest = new URL(`${baseUrl}/settings/social_network`)
    dest.searchParams.set("session", session)
    dest.searchParams.set("network", network)
    if (siteId) dest.searchParams.set("siteId", siteId)
    console.log("[Social Callback OUTSTAND→US] redirect→", dest.toString())
    return NextResponse.redirect(dest.toString())
  }

  // 3) No explicit error: assume provider flow completed — verify via Outstand tenant account list and merge into settings.
  if (!siteId) {
    return redirectToSettings(
      "Missing siteId (or tenant_id) in callback URL. Your redirect_uri must include ?siteId=<tenant> so we can verify the connection.",
      baseUrl
    )
  }

  const supabase = await createSocialSupabaseClient()
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

  const sync = await syncImplicitOutstandCallback({
    supabase,
    siteId,
    pathNetwork: network,
  })

  if (!sync.ok) {
    console.warn("[Social Callback OUTSTAND→US] implicit sync failed:", sync.message)
    return redirectToSettings(sync.message, baseUrl)
  }

  console.log("[Social Callback OUTSTAND→US] implicit sync ok", {
    mergedCount: sync.mergedCount,
    accountsFound: sync.accountsFound,
  })

  const dest = new URL(`${baseUrl}/settings`)
  dest.searchParams.set("tab", "social")
  dest.searchParams.set("oauth_connected", "1")
  dest.searchParams.set("oauth_site", siteId)
  dest.searchParams.set("oauth_network", network)
  return NextResponse.redirect(dest.toString())
}

const LOCAL_HOSTS = ["0.0.0.0", "127.0.0.1", "localhost"]

function getBaseUrl(request?: NextRequest): string {
  if (request) {
    const fwdHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    const fwdProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https"
    if (fwdHost) {
      const o = `${fwdProto}://${fwdHost}`.replace(/\/$/, "")
      if (o.startsWith("http")) return o
    }
  }

  const reqOrigin = request?.nextUrl?.origin
  if (reqOrigin) {
    try {
      const hostname = new URL(reqOrigin).hostname
      if (hostname && !LOCAL_HOSTS.includes(hostname)) {
        return reqOrigin.replace(/\/$/, "")
      }
    } catch {
      // ignore
    }
  }

  const u =
    process.env.SSH_TUNNEL_URL ||
    process.env.NEXT_PUBLIC_SSH_TUNNEL_URL ||
    process.env.NEXT_PUBLIC_PRODUCTION_URL ||
    "https://app.makinari.com"
  return u.replace(/\/$/, "")
}

function redirectToSettings(message: string, baseUrl: string): NextResponse {
  const url = new URL(`${baseUrl}/settings/social_network`)
  url.searchParams.set("error", "oauth_failed")
  url.searchParams.set("error_description", message)
  return NextResponse.redirect(url.toString())
}
