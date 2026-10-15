import { NextResponse } from "next/server"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/server"
import { authorizeMarketplaceResource } from "@/lib/marketplace/authorization"
import { loadMarketplaceIntegration } from "@/lib/marketplace/configuration"
import { actOnOrder } from "@/lib/marketplace/providers"
import { executeMarketplaceOrderAction } from "@/lib/marketplace/order-action"
import { confirmedActionState, marketplaceCapabilities } from "@/lib/marketplace/policy"
import { assertSameOrigin, MarketplaceRequestError, marketplaceActionSchema, parseMarketplaceJson, readMarketplaceBody } from "@/lib/marketplace/request"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    const { id } = await context.params
    if (!z.string().uuid().safeParse(id).success) throw new MarketplaceRequestError("Invalid order ID", 400)
    const input = marketplaceActionSchema.safeParse(parseMarketplaceJson(await readMarketplaceBody(request, 8192)))
    if (!input.success) throw new MarketplaceRequestError("Invalid action or missing reason/cooking time", 400)
    const { resource, userId } = await authorizeMarketplaceResource(request, "sale_orders", id)
    const integration = await loadMarketplaceIntegration(resource.marketplace_integration_id)
    if (!integration?.config.enabled || integration.config.site_id !== resource.site_id) {
      throw new MarketplaceRequestError("Integration is disabled or unavailable", 409)
    }
    const { config, credentials } = integration
    if (config.provider === "rappi" && input.data.action === "accept" && input.data.cooking_time_minutes === undefined) {
      throw new MarketplaceRequestError("Rappi acceptance requires a cooking time", 400)
    }
    const metadata = resource.metadata.marketplace as Record<string, unknown>
    if (typeof metadata.external_order_id !== "string" || metadata.external_store_id !== config.external_store_id) {
      throw new MarketplaceRequestError("Order identity mismatch", 409)
    }
    const database = await createServiceClient(true)
    const outcome = await executeMarketplaceOrderAction(metadata, input.data, {
      async claim(action) {
        const { data, error } = await database.rpc("claim_marketplace_action", {
          p_order_id: id, p_action: action.action, p_actor_user_id: userId,
        })
        if (error || !data?.action_id) throw new MarketplaceRequestError("Order operation is unavailable", 409)
        return {
          action_id: data.action_id,
          acquired: data.duplicate === false,
          status: data.operation?.status || data.order?.metadata?.marketplace?.operation?.status,
        }
      },
      perform: action => actOnOrder({
        provider: config.provider, environment: config.environment, country: config.country,
        store_id: config.external_store_id, manual_ready: config.manual_ready, ...credentials,
      }, metadata.external_order_id as string, action),
      async finish(actionId, status, action) {
        const state = status === "confirmed" ? confirmedActionState(action.action) : metadata.state
        const { data, error } = await database.rpc("finish_marketplace_action", {
          p_action_id: actionId, p_result: status,
          p_metadata: {
            ...metadata, state,
            capabilities: state === "rejected" ? {
              accept: false, reject: false, ready: false, cancel: false, request_delivery: false, cancel_delivery: false,
            } : marketplaceCapabilities(config.provider, state as Parameters<typeof marketplaceCapabilities>[1], config.manual_ready),
            sync_status: status === "unknown" ? "unknown" : "confirmed",
            operation: { status, action: action.action },
          },
        })
        if (error) throw new Error("Operation result could not be committed")
        const persisted = z.enum(["confirmed", "failed", "unknown"]).safeParse(data?.operation?.status)
        if (!persisted.success) throw new Error("Operation confirmation unavailable")
        return persisted.data
      },
    })
    return NextResponse.json(outcome, { status: outcome.success ? 200 : outcome.operation.status === "failed" ? 422 : 202 })
  } catch (error) {
    if (error instanceof MarketplaceRequestError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: "Marketplace operation unavailable" }, { status: 503 })
  }
}