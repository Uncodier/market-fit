import "server-only"

import { createClient } from "@/lib/supabase/server"
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
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { data: [], count: 0, error: "Not authenticated" }
    }

    const epoch = await readCacheEpoch("order-data", params.siteId)
    const cacheIdentity = await hashRedisKeyPart(
      JSON.stringify({
        epoch,
        userId: user.id,
        ...params,
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
