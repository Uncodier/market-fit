import { NextResponse } from "next/server"
import { requireMerchantManager } from "@/lib/marketplace/merchant/access"
import { merchantStartSchema } from "@/lib/marketplace/merchant/types"
import { beginMerchantAuthorization } from "@/lib/marketplace/merchant/session"
import { assertSameOrigin, parseMarketplaceJson, readMarketplaceBody } from "@/lib/marketplace/request"

export const runtime = "nodejs"
export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  try {
    assertSameOrigin(request)
    const { provider } = await context.params
    const value = merchantStartSchema.safeParse(parseMarketplaceJson(await readMarketplaceBody(request, 16384)))
    if (!value.success || value.data.provider !== provider) return NextResponse.json({ error: "Invalid authorization request" }, { status: 400 })
    const access = await requireMerchantManager(request, value.data.siteId)
    if (access.error) return access.error
    const result = await beginMerchantAuthorization(value.data, access.userId)
    const response = NextResponse.json({ url: result.url }, { headers: { "Cache-Control": "no-store" } })
    response.cookies.set(`marketplace_oauth_${provider}`, result.state, {
      httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax",
      path: `/api/marketplace/oauth/${provider}`, maxAge: 600,
    })
    return response
  } catch {
    return NextResponse.json({ error: "The marketplace application is unavailable or authorization could not be started" }, { status: 503 })
  }
}