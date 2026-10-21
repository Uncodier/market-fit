import "server-only"

import { createClient } from "@/lib/supabase/server"
import { getCurrentUserSiteRole } from "@/lib/auth/api-site-access"
import { readLocationRestrictionState } from "@/lib/permissions/location-boundary"
import { hashRedisKeyPart } from "@/lib/redis/control-plane"
import {
  readCacheEpoch,
  readThroughJsonCache,
} from "@/lib/redis/json-cache"
import type { OrderLineParams, OrderLinesResult } from "./types"

export async function readCachedOrderLines(
  params: OrderLineParams,
  load: () => Promise<OrderLinesResult>,
): Promise<OrderLinesResult> {
  try {
    const supabase = await createClient(true)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { data: [], count: 0, error: "Not authenticated" }
    }

    if (!await getCurrentUserSiteRole(supabase, params.siteId)) {
      return { data: [], count: 0, error: "Forbidden" }
    }
    const restricted = await readLocationRestrictionState(supabase, params.siteId)
    if (restricted === null) {
      return { data: [], count: 0, error: "Location authorization could not be verified" }
    }
    // Never serve an unrestricted cached projection after a permission edit.
    if (restricted) return load()

    const epoch = await readCacheEpoch("order-data", params.siteId)
    const cacheIdentity = await hashRedisKeyPart(
      JSON.stringify({
        ...params,
        epoch,
        userId: user.id,
        q: params.q?.trim() || "",
      }),
    )
    const cached = await readThroughJsonCache<OrderLinesResult>({
      key: `cache:v1:order-lines-list:${cacheIdentity}`,
      ttlSeconds: 5,
      lockTtlMs: 15_000,
      compute: async () => {
        const result = await load()
        if (result.error) throw new Error(result.error)
        return result
      },
    })
    if (cached.status === "busy") {
      return {
        data: [],
        count: 0,
        error: "Order lines are being refreshed",
      }
    }
    return cached.value
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load order lines"
    console.error("Error in listOrderLines cache:", error)
    return { data: [], count: 0, error: message }
  }
}
