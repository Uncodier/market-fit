export type BuyerQuoteCheckoutMetadata = {
  delivery_options?: string[]
  pickup_location_ids?: string[]
  payment_options?: string[]
  shipping_cost?: number
  shipping_cost_mode?: "extra" | "covers_order"
}

export type BuyerQuoteDto = {
  id: string
  site_id: string
  title: string | null
  status: string
  valid_until: string | null
  currency: string | null
  notes: string | null
  subtotal: number | null
  discount_total: number | null
  tax_total: number | null
  total: number | null
  created_at: string
  items: Array<{
    id: string
    catalog_item_id: string
    name: string
    quantity: number
    unit_price: number
    subtotal: number
    catalog_item: {
      name: string
      image_url: string | null
      kind: string | null
      digital_subtype: string | null
      currency: string | null
      is_recurring: boolean
      is_reservation: boolean
      is_dynamic_price: boolean
      metadata?: BuyerQuoteCheckoutMetadata
    } | null
  }>
  lead: { name: string | null; email: string | null } | null
  site: {
    id: string
    name: string | null
    logo_url: string | null
    url: string | null
  } | null
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((entry): entry is string => typeof entry === "string")
}

export function sanitizeBuyerQuoteCheckoutMetadata(
  value: unknown
): BuyerQuoteCheckoutMetadata | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const metadata = value as Record<string, unknown>
  const sanitized: BuyerQuoteCheckoutMetadata = {}

  const deliveryOptions = stringArray(metadata.delivery_options)
  if (deliveryOptions) sanitized.delivery_options = deliveryOptions
  const pickupLocationIds = stringArray(metadata.pickup_location_ids)
  if (pickupLocationIds) sanitized.pickup_location_ids = pickupLocationIds
  const paymentOptions = stringArray(metadata.payment_options)
  if (paymentOptions) sanitized.payment_options = paymentOptions
  if (
    typeof metadata.shipping_cost === "number" &&
    Number.isFinite(metadata.shipping_cost)
  ) {
    sanitized.shipping_cost = metadata.shipping_cost
  }
  if (
    metadata.shipping_cost_mode === "extra" ||
    metadata.shipping_cost_mode === "covers_order"
  ) {
    sanitized.shipping_cost_mode = metadata.shipping_cost_mode
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

export function toBuyerQuoteDto(row: any): BuyerQuoteDto {
  const lead = firstRelation(row.lead)
  const site = firstRelation(row.site)

  return {
    id: row.id,
    site_id: row.site_id,
    title: row.title ?? null,
    status: row.status,
    valid_until: row.valid_until ?? null,
    currency: row.currency ?? null,
    notes: row.notes ?? null,
    subtotal: row.subtotal ?? null,
    discount_total: row.discount_total ?? null,
    tax_total: row.tax_total ?? null,
    total: row.total ?? null,
    created_at: row.created_at,
    items: (row.items || []).map((item: any) => {
      const catalog = firstRelation(item.catalog_item)
      const metadata = sanitizeBuyerQuoteCheckoutMetadata(catalog?.metadata)
      return {
        id: item.id,
        catalog_item_id: item.catalog_item_id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        catalog_item: catalog
          ? {
              name: catalog.name,
              image_url: catalog.image_url ?? null,
              kind: catalog.kind ?? null,
              digital_subtype: catalog.digital_subtype ?? null,
              currency: catalog.currency ?? null,
              is_recurring: Boolean(catalog.is_recurring),
              is_reservation: Boolean(catalog.is_reservation),
              is_dynamic_price: Boolean(catalog.is_dynamic_price),
              ...(metadata ? { metadata } : {}),
            }
          : null,
      }
    }),
    lead: lead
      ? { name: lead.name ?? null, email: lead.email ?? null }
      : null,
    site: site
      ? {
          id: site.id,
          name: site.name ?? null,
          logo_url: site.logo_url ?? null,
          url: site.url ?? null,
        }
      : null,
  }
}
