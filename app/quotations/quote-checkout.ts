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
    if (quote.buyer_user_id && quote.buyer_user_id !== opts.buyerUserId) {
      return { ok: false, error: "You are not authorized to checkout this quote" }
    }
  } else if (
    opts.buyerUserId &&
    quote.buyer_user_id &&
    quote.buyer_user_id !== opts.buyerUserId
  ) {
    return { ok: false, error: "You are not authorized to checkout this quote" }
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
    if (quote.buyer_user_id && quote.buyer_user_id !== opts.buyerUserId) {
      return { ok: false, error: "You are not authorized to reject this quote" }
    }
  } else if (
    opts.buyerUserId &&
    quote.buyer_user_id &&
    quote.buyer_user_id !== opts.buyerUserId
  ) {
    return { ok: false, error: "You are not authorized to reject this quote" }
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

export async function markQuotationAccepted(
  supabase: {
    from: (table: string) => any
  },
  quote: Pick<QuotationForCheckout, "id" | "deal_id" | "total">,
  saleId: string
): Promise<void> {
  await supabase.from("quotations").update({ status: "accepted" }).eq("id", quote.id)

  if (quote.deal_id) {
    await supabase
      .from("deals")
      .update({
        stage: "closed_won",
        status: "won",
        accepted_quotation_id: quote.id,
        amount: quote.total,
        sales_order_id: saleId,
      })
      .eq("id", quote.deal_id)
  }
}
