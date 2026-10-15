import { z } from "zod"
import { requireMerchantManager } from "@/lib/marketplace/merchant/access"
import { activateConnectedStore } from "@/lib/marketplace/merchant/provisioning"
import { assertSameOrigin, parseMarketplaceJson, readMarketplaceBody } from "@/lib/marketplace/request"

export const runtime = "nodejs"
export const maxDuration = 120
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    const { id } = await context.params
    const input = z.object({ siteId: z.string().uuid(), external_store_id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
      origin_location_id: z.string().uuid() }).strict().safeParse(parseMarketplaceJson(await readMarketplaceBody(request, 8192)))
    if (!input.success || !z.string().uuid().safeParse(id).success) return Response.json({ error: "Invalid store mapping" }, { status: 400 })
    const access = await requireMerchantManager(request, input.data.siteId)
    if (access.error) return access.error
    const result = await activateConnectedStore({ connection_id: id, site_id: input.data.siteId,
      external_store_id: input.data.external_store_id, origin_location_id: input.data.origin_location_id }, access.userId)
    return Response.json(result, { status: result.status === "active" ? 200 : 202 })
  } catch {
    return Response.json({ error: "The store could not be activated, or its result is pending. Refresh its status before retrying." }, { status: 409 })
  }
}