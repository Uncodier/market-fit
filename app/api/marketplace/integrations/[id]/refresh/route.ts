import { z } from "zod"
import { requireMerchantManager } from "@/lib/marketplace/merchant/access"
import { refreshConnectedStore } from "@/lib/marketplace/merchant/reconcile"
import { assertSameOrigin, parseMarketplaceJson, readMarketplaceBody } from "@/lib/marketplace/request"

export const runtime = "nodejs"
export const maxDuration = 120
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    const { id } = await context.params
    const input = z.object({ siteId: z.string().uuid() }).strict().safeParse(parseMarketplaceJson(await readMarketplaceBody(request, 4096)))
    if (!input.success || !z.string().uuid().safeParse(id).success) return Response.json({ error: "Invalid store" }, { status: 400 })
    const access = await requireMerchantManager(request, input.data.siteId)
    if (access.error) return access.error
    return Response.json(await refreshConnectedStore(id, input.data.siteId, access.userId))
  } catch {
    return Response.json({ error: "Provider status could not be confirmed. You may need to authorize the account again." }, { status: 409 })
  }
}