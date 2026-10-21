import "server-only"

import { createClient } from "@/lib/supabase/server"
import { readOrderAccess } from "./read-order-access"
import { readLocationRestrictionState } from "@/lib/permissions/location-boundary"
import { hashRedisKeyPart } from "@/lib/redis/control-plane"
import { readCacheEpoch, readThroughJsonCache } from "@/lib/redis/json-cache"
import type { OrderParams, OrderWithRelations } from "./types"
import { queryOrders } from "./query-orders"

export async function listOrdersCached(params: OrderParams): Promise<{
  data: OrderWithRelations[]; count: number; error?: string | null
}> {
  try {
    const supabase = await createClient(true)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { data: [], count: 0, error: "Not authenticated" }
    }

    // Neither the cache key nor a prior successful request is authorization.
    const access = await readOrderAccess(supabase, params.siteId)
    if (access.error) {
      return { data: [], count: 0, error: access.error }
    }
    const restricted = await readLocationRestrictionState(supabase, params.siteId)
    if (restricted === null) {
      return { data: [], count: 0, error: "Location authorization could not be verified" }
    }
    // Restricted users retain the ordinary order RLS contract, never an older
    // unrestricted cached projection (even when the caller supplies a location).
    if (restricted) return queryOrders(params)

    // Provider mutations originate outside this Server Action. A realtime reload
    // must not consume a five-second stale cache and then wait indefinitely.
    const { data: marketplaceConnections, error: marketplaceError } = await supabase
      .from("marketplace_integrations").select("id").eq("site_id", params.siteId).limit(1)
    if (marketplaceError || marketplaceConnections?.length) return queryOrders(params)

    const epoch = await readCacheEpoch("order-data", params.siteId)
    const cacheIdentity = await hashRedisKeyPart(
      JSON.stringify({
        ...params,
        epoch,
        userId: user.id,
        q: params.q?.trim() || "",
      }),
    )
    const cached = await readThroughJsonCache({
      key: `cache:v1:orders-list:${cacheIdentity}`,
      ttlSeconds: 5,
      lockTtlMs: 15_000,
      compute: async () => {
        const result = await queryOrders(params)
        if (result.error) throw new Error(result.error)
        return result
      },
    })
    if (cached.status === "busy") {
      return { data: [], count: 0, error: "Orders are being refreshed" }
    }
    return cached.value
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load orders"
    console.error("Error in listOrders cache:", error)
    return { data: [], count: 0, error: message }
  }
}

