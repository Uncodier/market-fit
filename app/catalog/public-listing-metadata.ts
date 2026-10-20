import type { CatalogItem } from "@/app/types"

const DELIVERY_OPTIONS = ["pickup", "ship", "none", "dine_in"] as const
const PAYMENT_OPTIONS = ["card", "cash_on_pickup", "bank_transfer"] as const

function validatedOptions<T extends string>(value: unknown, allowed: readonly T[]): T[] | undefined {
  if (!Array.isArray(value)) return undefined
  const options = [...new Set(value.filter((option): option is T =>
    typeof option === "string" && allowed.includes(option as T)))]
  return options.length ? options : undefined
}

/** Only public display/checkout metadata; never seller prompts or operational fields. */
export function publicListingMetadata(metadata: CatalogItem["metadata"]) {
  if (!metadata) return undefined
  return {
    variant_axes: metadata.variant_axes,
    show_buyers: metadata.show_buyers,
    show_available_inventory: metadata.show_available_inventory,
    attributes: metadata.attributes,
    pickup_location_ids: metadata.pickup_location_ids,
    delivery_options: validatedOptions(metadata.delivery_options, DELIVERY_OPTIONS),
    payment_options: validatedOptions(metadata.payment_options, PAYMENT_OPTIONS),
    dynamic_pricing: metadata.dynamic_pricing ? {
      min_price: metadata.dynamic_pricing.min_price,
      requires_advanced_compute: metadata.dynamic_pricing.requires_advanced_compute,
    } : undefined,
  }
}