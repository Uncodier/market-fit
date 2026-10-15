import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeMarketplaceResource } from "@/lib/marketplace/authorization"
import { assertSameOrigin, MarketplaceRequestError, parseMarketplaceJson, readMarketplaceBody } from "@/lib/marketplace/request"

export const runtime = "nodejs"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    const { id } = await context.params
    const input = z.object({ action: z.enum(["request", "cancel"]), reason: z.string().trim().max(500).optional() }).strict()
      .safeParse(parseMarketplaceJson(await readMarketplaceBody(request, 8192)))
    if (!z.string().uuid().safeParse(id).success || !input.success) {
      throw new MarketplaceRequestError("Invalid shipment action", 400)
    }
    await authorizeMarketplaceResource(request, "shipments", id)
    // Marketplace orders do not authorize Direct/Cargo delivery dispatch or courier cancellation.
    return NextResponse.json({
      success: false, operation: { status: "unsupported", action: input.data.action },
      error: "Delivery requests and courier cancellations are not enabled by this marketplace integration",
    }, { status: 409 })
  } catch (error) {
    if (error instanceof MarketplaceRequestError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: "Shipment operation unavailable" }, { status: 503 })
  }
}