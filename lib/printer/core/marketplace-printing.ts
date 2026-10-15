import { marketplaceMetadata } from "@/lib/marketplace/presentation"
import type { KitchenDelta } from "./types"

/** Never turn a cancellation notification into new kitchen work. */
export function cancellationOnlyDelta(delta: KitchenDelta): KitchenDelta {
  return { kind: delta.voids.length ? "delta" : "none", adds: [], qtyChanges: [], voids: delta.voids }
}

/** Use authoritative acceptance time, never guess a provider schedule's timezone. */
export function isRecentKitchenOrder(order: {
  created_at?: string | null; metadata?: unknown
}, now = Date.now()): boolean {
  const marketplace = marketplaceMetadata(order.metadata)
  const accepted = marketplace?.accepted_at
  const acceptedAt = typeof accepted === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(accepted) ? Date.parse(accepted) : NaN
  const createdAt = order.created_at ? Date.parse(order.created_at) : NaN
  const reference = Number.isFinite(acceptedAt) ? acceptedAt : createdAt
  return !Number.isFinite(reference) || now - reference <= 24 * 60 * 60 * 1000
}