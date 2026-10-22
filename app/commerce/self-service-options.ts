import { getItemDeliveryOptions } from "./delivery-options"
import type { CatalogItem } from "@/app/types"

export type SelfServiceFulfillment = "pickup" | "dine_in"

export function getSelfServiceOptions(shop?: {
  self_service_fulfillment_options?: unknown
  default_delivery_options?: unknown
} | null): SelfServiceFulfillment[] {
  const configured = shop?.self_service_fulfillment_options ?? shop?.default_delivery_options
  if (!Array.isArray(configured)) return ["pickup", "dine_in"]
  return ["pickup", "dine_in"].filter((option) => configured.includes(option)) as SelfServiceFulfillment[]
}

export function isSelfServiceItem(
  item: Partial<CatalogItem>,
  options: SelfServiceFulfillment[],
  locationId: string,
): boolean {
  if (item.kind !== "product" || item.is_recurring || item.is_reservation || item.is_dynamic_price) return false
  const locations = item.metadata?.pickup_location_ids
  if (Array.isArray(locations) && locations.length && !locations.includes(locationId)) return false
  return getItemDeliveryOptions(item, options).some((option) => options.includes(option as SelfServiceFulfillment))
}