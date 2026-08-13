"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { isValidPublicAccessToken } from "@/app/documents/public-token"
import type { DeviceOrder } from "@/app/commerce/device-order-storage"
import {
  mapDeviceOrderSnapshot,
  type DeviceOrderSnapshotRow,
} from "@/app/commerce/device-order-sync"

const MAX_TOKENS = 5

export async function getDeviceOrderSnapshots(
  tokens: string[]
): Promise<{ data?: DeviceOrder[]; error?: string }> {
  const valid = [
    ...new Set(
      (Array.isArray(tokens) ? tokens : []).filter(isValidPublicAccessToken)
    ),
  ].slice(0, MAX_TOKENS)

  if (valid.length === 0) return { data: [] }

  const supabase = await createServiceClient(true)
  const { data, error } = await supabase
    .from("sale_orders")
    .select(
      "id, public_access_token, order_number, status, total, currency, created_at, sale_order_items(name, unit_price, catalog_item:catalog_item_id(name, image_url))"
    )
    .in("public_access_token", valid)

  if (error) return { error: error.message }

  return {
    data: ((data || []) as DeviceOrderSnapshotRow[]).map(mapDeviceOrderSnapshot),
  }
}
