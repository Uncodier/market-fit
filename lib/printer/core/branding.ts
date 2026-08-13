import type { TicketBrand } from "./types"

type SiteLike = {
  name?: string | null
  logo_url?: string | null
  url?: string | null
  billing?: { tax_id?: string; billing_address?: string } | null
  settings?: {
    currency?: string
    default_locale?: string
    locations?: Array<{
      address?: string | null
      city?: string | null
      is_default?: boolean
    }> | null
    channels?: {
      whatsapp?: { existingNumber?: string; number?: string } | null
    } | null
  } | null
}

function firstLocation(site?: SiteLike | null) {
  const list = site?.settings?.locations || []
  return list.find((l) => l.is_default) || list[0]
}

export function ticketBrandFromSite(site?: SiteLike | null): TicketBrand {
  const loc = firstLocation(site)
  const address = [loc?.address, loc?.city].filter(Boolean).join(", ") ||
    site?.billing?.billing_address ||
    null
  const wa = site?.settings?.channels?.whatsapp
  const phone = wa?.existingNumber || wa?.number || null
  return {
    siteName: site?.name || null,
    logoUrl: site?.logo_url || null,
    address: address || null,
    phone,
    website: site?.url || null,
    taxId: site?.billing?.tax_id || null,
    locale: site?.settings?.default_locale || "en",
  }
}

export function buildInventoryTraceValue(params: {
  sku?: string | null
  itemId?: string | null
  locationName?: string | null
  locationCode?: string | null
  quantity?: number | null
  siteName?: string | null
}): string {
  const sku = params.sku || params.itemId || "ITEM"
  const loc = params.locationCode || params.locationName || ""
  const qty = params.quantity == null ? "" : String(params.quantity)
  return ["INV", sku, loc, qty, params.siteName || ""].filter((p) => p !== "").join("|")
}
