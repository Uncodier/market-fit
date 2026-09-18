export type QuoteCheckoutLine = {
  catalogItemId: string
  quantity: number
  unitPriceOverride: number
}

export type QuotationForCheckout = {
  id: string
  site_id: string
  status: string
  valid_until?: string | null
  buyer_user_id?: string | null
  lead_id?: string | null
  price_list_id?: string | null
  deal_id?: string | null
  total?: number | null
  currency?: string | null
  items?: Array<{
    catalog_item_id: string
    name: string
    quantity: number
    unit_price: number
    catalog_item?: Record<string, any> | null
  }>
}

export type QuotationCheckoutGate =
  | { ok: true }
  | { ok: false; error: string }

export type QuotationCheckoutClaim =
  | { state: "claimed"; saleId?: string | null; orderId?: string | null }
  | { state: "completed"; saleId: string; orderId: string }
  | { state: "error"; error: string }

export function isQuotationExpired(
  validUntil: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!validUntil) return false
  const expiresAt = new Date(validUntil)
  if (Number.isNaN(expiresAt.getTime())) return false
  return expiresAt < now
}

export function assertQuotationCheckoutable(
  quote: Pick<QuotationForCheckout, "status" | "valid_until" | "buyer_user_id" | "site_id" | "items">,
  opts: {
    buyerUserId?: string | null
    siteId?: string
    now?: Date
    requireItems?: boolean
    /** Token-validated public share link — guests may proceed without an account. */
    publicAccess?: boolean
  } = {}
): QuotationCheckoutGate {
  if (!quote) return { ok: false, error: "Quotation not found" }
  if (quote.status !== "sent") {
    return { ok: false, error: "Quotation is not in sent status" }
  }
  if (isQuotationExpired(quote.valid_until, opts.now)) {
    return { ok: false, error: "Quotation has expired" }
  }
  if (opts.siteId && quote.site_id !== opts.siteId) {
    return { ok: false, error: "Quotation does not belong to this seller" }
  }
  if (!opts.publicAccess) {
    if (!opts.buyerUserId) {
      return { ok: false, error: "You must be logged in to checkout this quote" }
    }
    if (!quote.buyer_user_id || quote.buyer_user_id !== opts.buyerUserId) {
      return { ok: false, error: "You are not authorized to checkout this quote" }
    }
  }
  if (opts.requireItems !== false && (!quote.items || quote.items.length === 0)) {
    return { ok: false, error: "Quotation has no items" }
  }
  return { ok: true }
}

export function assertQuotationRejectable(
  quote: Pick<QuotationForCheckout, "status" | "valid_until" | "buyer_user_id">,
  opts: { buyerUserId?: string | null; now?: Date; publicAccess?: boolean } = {}
): QuotationCheckoutGate {
  if (!quote) return { ok: false, error: "Quotation not found" }
  if (quote.status !== "sent") {
    return { ok: false, error: "Quotation is not in sent status" }
  }
  if (isQuotationExpired(quote.valid_until, opts.now)) {
    return { ok: false, error: "Quotation has expired" }
  }
  if (!opts.publicAccess) {
    if (!opts.buyerUserId) {
      return { ok: false, error: "You must be logged in to reject this quote" }
    }
    if (!quote.buyer_user_id || quote.buyer_user_id !== opts.buyerUserId) {
      return { ok: false, error: "You are not authorized to reject this quote" }
    }
  }
  return { ok: true }
}

export function quotationItemsToCheckoutLines(
  items: Array<{ catalog_item_id: string; quantity: number; unit_price: number }>
): QuoteCheckoutLine[] {
  return items.map((item) => ({
    catalogItemId: item.catalog_item_id,
    quantity: item.quantity,
    unitPriceOverride: Number(item.unit_price),
  }))
}

/** Map quotation lines into slim cart items for buy-now checkout UI. */
export function mapQuotationToCartItems(quotation: QuotationForCheckout): Record<string, any>[] {
  const currency = quotation.currency || "USD"
  const site = (quotation as any).site
  return (quotation.items || []).map((item) => {
    const catalog = item.catalog_item || {}
    return {
      id: item.catalog_item_id,
      site_id: catalog.site_id || quotation.site_id,
      name: catalog.name || item.name,
      image_url: catalog.image_url ?? null,
      kind: catalog.kind,
      digital_subtype: catalog.digital_subtype ?? null,
      currency: catalog.currency || currency,
      target_sale_price: Number(item.unit_price),
      is_recurring: Boolean(catalog.is_recurring),
      is_reservation: Boolean(catalog.is_reservation),
      is_dynamic_price: Boolean(catalog.is_dynamic_price),
      cartQty: item.quantity,
      cartPrice: Number(item.unit_price),
      metadata: catalog.metadata || undefined,
      site: site
        ? {
            id: site.id,
            name: site.name,
            logo_url: site.logo_url,
            slug: site.name
              ? site.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")
              : undefined,
          }
        : undefined,
    }
  })
}

export function buildQuoteCheckoutPath(params: {
  siteId: string
  quotationId: string
  returnTo: string
  ownerSiteId?: string | null
  publicAccessToken?: string | null
}): string {
  const search = new URLSearchParams({
    mode: "buynow",
    source: "shop",
    siteId: params.siteId,
    quotationId: params.quotationId,
    returnTo: params.returnTo,
  })
  if (params.ownerSiteId) {
    search.set("ownerSiteId", params.ownerSiteId)
  }
  if (params.publicAccessToken) {
    search.set("publicAccessToken", params.publicAccessToken)
  }
  return `/cart/checkout?${search.toString()}`
}

function firstRpcRow<T>(data: T | T[] | null): T | null {
  return Array.isArray(data) ? data[0] || null : data
}

export async function claimQuotationCheckout(
  supabase: {
    rpc: (name: string, params: Record<string, unknown>) => Promise<{
      data: unknown
      error: { message?: string } | null
    }>
  },
  params: {
    quotationId: string
    siteId: string
    claimId: string
    buyerUserId?: string | null
    publicAccessToken?: string | null
  }
): Promise<QuotationCheckoutClaim> {
  const { data, error } = await supabase.rpc("claim_quotation_checkout", {
    p_quotation_id: params.quotationId,
    p_site_id: params.siteId,
    p_claim_id: params.claimId,
    p_buyer_user_id: params.buyerUserId || null,
    p_public_access_token: params.publicAccessToken || null,
  })

  if (error) {
    return { state: "error", error: error.message || "Failed to claim quotation" }
  }

  const row = firstRpcRow(data as {
    result?: string
    sale_id?: string | null
    order_id?: string | null
  } | null)

  if (row?.result === "claimed") {
    return { state: "claimed", saleId: row.sale_id, orderId: row.order_id }
  }
  if (row?.result === "completed" && row.sale_id && row.order_id) {
    return { state: "completed", saleId: row.sale_id, orderId: row.order_id }
  }

  const messages: Record<string, string> = {
    busy: "Quotation checkout is already in progress",
    expired: "Quotation has expired",
    not_found: "Quotation not found",
    unavailable: "Quotation is no longer available",
    unauthorized: "You are not authorized to checkout this quote",
  }
  return {
    state: "error",
    error: messages[row?.result || ""] || "Failed to claim quotation",
  }
}

export async function completeQuotationCheckout(
  supabase: {
    rpc: (name: string, params: Record<string, unknown>) => Promise<{
      data: unknown
      error: { message?: string } | null
    }>
  },
  params: {
    quotationId: string
    claimId: string
    saleId: string
    orderId: string
  }
): Promise<{ success: true } | { error: string }> {
  const { data, error } = await supabase.rpc("complete_quotation_checkout", {
    p_quotation_id: params.quotationId,
    p_claim_id: params.claimId,
    p_sale_id: params.saleId,
    p_order_id: params.orderId,
  })

  if (error) return { error: error.message || "Failed to accept quotation" }
  if (data !== true) return { error: "Quotation is no longer available" }
  return { success: true }
}

export async function releaseQuotationCheckoutClaim(
  supabase: {
    rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>
  },
  quotationId: string,
  claimId: string
): Promise<void> {
  try {
    await supabase.rpc("release_quotation_checkout_claim", {
      p_quotation_id: quotationId,
      p_claim_id: claimId,
    })
  } catch (error) {
    console.error("Failed to release quotation checkout claim:", error)
  }
}
