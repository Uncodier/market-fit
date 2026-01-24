import { NextRequest, NextResponse } from "next/server"

/**
 * Outstand white-label callback for Facebook and LinkedIn.
 *
 * Outstand: "The callback url lies on your app, and then you call the finalization API endpoint."
 * — "Callback lies on your app" = **Outstand** redirects to this URL with ?session= or ?error=.
 *   **Facebook does NOT redirect here**; Facebook redirects to Outstand. Only Outstand calls us.
 *
 * Doc: "We will redirect to it with a session query parameter" (it = our redirect_uri; We = Outstand).
 * https://www.outstand.so/docs/configurations/facebook#white-labeling-authentication-flow
 *
 * FLOW: We request auth-url with redirect_uri=this URL → User→Outstand→Facebook→Outstand (code+state)
 * → Outstand redirects HERE with ?session= or ?error= → we go to /settings/social_network, then pending+finalize.
 */

const NETWORK_MAP: Record<string, string> = {
  facebook: "facebook",
  linkedin: "linkedin",
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ network: string }> }
) {
  const { network } = await params
  const outstandNetwork = NETWORK_MAP[network?.toLowerCase() ?? ""]

  // ---- LOG: Outstand redirects HERE with ?session= or ?error= ----
  const { searchParams } = request.nextUrl
  const allParams = Object.fromEntries(searchParams.entries())
  const authCookies = request.cookies.getAll().filter((c) => c.name.startsWith("sb-"))
  // Chunked cookies are sb-*-auth-token.0, .1 — need includes(), not endsWith("-auth-token")
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
  const tenantId = searchParams.get("tenant_id")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  // 1) Outstand sends error: they couldn't get or process code/state from Facebook.
  if (error) {
    console.error(`[Social Callback ${network}] Outstand error:`, error, errorDescription)
    const msg =
      error === "Missing code or state parameter"
        ? "Outstand could not process the code/state from " + network + ". Facebook's redirect_uri=outstand.so is correct (Outstand then sends you to us). In your " + network + " App: add https://www.outstand.so/app/api/socials/" + network + "/callback to Valid OAuth Redirect URIs and outstand.so to App Domains. If both are set, contact Outstand (contact@outstand.so)."
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
    if (tenantId) dest.searchParams.set("siteId", tenantId)
    console.log("[Social Callback OUTSTAND→US] redirect→", dest.toString())
    return NextResponse.redirect(dest.toString())
  }

  // 3) Neither session nor error — unexpected.
  console.log("[Social Callback OUTSTAND→US] redirecting to /settings/social_network with error (no session, no error param)")
  return redirectToSettings("No session or error in callback. Check with Outstand if the flow completed correctly.", baseUrl)
}

const LOCAL_HOSTS = ["0.0.0.0", "127.0.0.1", "localhost"]

function getBaseUrl(request?: NextRequest): string {
  // 1) Prefer x-forwarded-* when behind tunnel/proxy: Host can be 0.0.0.0 but
  //    x-forwarded-host has the public host (e.g. xxx.trycloudflare.com).
  if (request) {
    const fwdHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    const fwdProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https"
    if (fwdHost) {
      const o = `${fwdProto}://${fwdHost}`.replace(/\/$/, "")
      if (o.startsWith("http")) return o
    }
  }

  // 2) Use request origin only when it's a public host (not 0.0.0.0, 127.0.0.1, localhost).
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

  // 3) Local/internal host or no request: use env so redirect and our_redirect_uri
  //    go to tunnel or production (user's cookie and OAuth redirect_uri live there).
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
