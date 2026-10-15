import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeMarketplaceResource } from "@/lib/marketplace/authorization"
import { synchronizeMarketplaceOrder } from "@/lib/marketplace/synchronize"
import { assertSameOrigin, MarketplaceRequestError } from "@/lib/marketplace/request"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    const { id } = await context.params
    if (!z.string().uuid().safeParse(id).success) throw new MarketplaceRequestError("Invalid order ID", 400)
    const { resource } = await authorizeMarketplaceResource(request, "sale_orders", id)
    const externalId = resource.metadata.marketplace.external_order_id
    if (typeof externalId !== "string") throw new MarketplaceRequestError("Invalid provider order", 409)
    const result = await synchronizeMarketplaceOrder(resource.marketplace_integration_id, externalId)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof MarketplaceRequestError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: "Provider synchronization unavailable; the saved order state was not changed" }, { status: 503 })
  }
}