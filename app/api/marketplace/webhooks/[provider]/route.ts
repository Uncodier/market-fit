import { NextResponse } from "next/server"
import { handleMarketplaceWebhook } from "@/lib/marketplace/webhook"
import { marketplaceWebhookDependencies } from "@/lib/marketplace/runtime"
import { MarketplaceRequestError } from "@/lib/marketplace/request"
import { MarketplaceProviderError } from "@/lib/marketplace/providers/types"
import { receiveUberProvisioning } from "@/lib/marketplace/merchant/control-events"
import { parseMarketplaceJson, readMarketplaceBody } from "@/lib/marketplace/request"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params
  if (provider !== "uber_eats" && provider !== "rappi") {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 })
  }
  try {
    if (provider === "uber_eats") {
      const raw = await readMarketplaceBody(request.clone())
      if (await receiveUberProvisioning(request, raw, parseMarketplaceJson(raw))) return new Response(null, { status: 200 })
    }
    await handleMarketplaceWebhook(request, provider, marketplaceWebhookDependencies)
    // Uber requires an empty HTTP 200 acknowledgement, separate from order acceptance.
    return new Response(null, { status: 200 })
  } catch (error) {
    if (error instanceof MarketplaceRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof MarketplaceProviderError && ["invalid_payload", "store_mismatch"].includes(error.code)) {
      return NextResponse.json({ error: "Invalid provider payload" }, { status: 400 })
    }
    // No payload, customer data, signatures or credentials enter logs/responses.
    return NextResponse.json({ error: "Marketplace processing unavailable" }, {
      status: 503, headers: { "Retry-After": "10" },
    })
  }
}