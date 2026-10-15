import { NextRequest, NextResponse } from "next/server"
import { createHash, timingSafeEqual } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { claimMerchantAuthorization, completeMerchantAuthorization, failMerchantAuthorization } from "@/lib/marketplace/merchant/session"
import { merchantCallbackUrl } from "@/lib/marketplace/merchant/platform"

export const runtime = "nodejs"
export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params
  if (provider !== "rappi" && provider !== "uber_eats") return NextResponse.json({ error: "Unknown provider" }, { status: 404 })
  const state = request.nextUrl.searchParams.get("state") || ""
  const cookie = request.cookies.get(`marketplace_oauth_${provider}`)?.value || ""
  const digest = (value: string) => createHash("sha256").update(value).digest()
  if (!state || !cookie || !timingSafeEqual(digest(state), digest(cookie))) {
    return NextResponse.json({ error: "Invalid authorization state" }, { status: 400 })
  }
  try {
    const database = await createClient(true)
    const { data: { user }, error } = await database.auth.getUser()
    if (error || !user) return NextResponse.json({ error: "Sign in with the account that started the connection" }, { status: 401 })
    const session = await claimMerchantAuthorization(state, provider, user.id)
    const access = await requireSiteAccess(request, session.site_id, { requireManager: true })
    if (access.error) return access.error
    const code = request.nextUrl.searchParams.get("code")
    let connectionId: string | undefined
    if (!request.nextUrl.searchParams.get("error") && code && code.length <= 8192) {
      const completed = await completeMerchantAuthorization(session, code, user.id)
      connectionId = completed.connection_id
    } else await failMerchantAuthorization(session.id, user.id)
    const destination = new URL("/integrations", merchantCallbackUrl(provider))
    destination.searchParams.set("marketplace_connection", connectionId || "failed")
    const response = NextResponse.redirect(destination)
    response.cookies.set(`marketplace_oauth_${provider}`, "", { httpOnly: true, maxAge: 0, path: `/api/marketplace/oauth/${provider}` })
    response.headers.set("Referrer-Policy", "no-referrer")
    return response
  } catch {
    return NextResponse.json({ error: "Authorization expired, was already used, or could not be completed. Start a new connection." }, { status: 400 })
  }
}