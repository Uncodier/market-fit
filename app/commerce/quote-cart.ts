"use client"

import { setCartItems } from "@/app/commerce/cart-storage"
import {
  buildQuoteCheckoutPath,
  mapQuotationToCartItems,
  type QuotationForCheckout,
} from "@/app/quotations/quote-checkout"

/**
 * Rehydrate buy-now cart from a quotation and return the checkout URL.
 * Does not clear the regular shop cart.
 */
export function startQuoteCheckout(
  quotation: QuotationForCheckout & { site?: { id: string; name?: string; logo_url?: string; slug?: string } },
  opts: {
    returnTo: string
    ownerSiteId?: string | null
    publicAccessToken?: string | null
  } = { returnTo: "/buyer" }
): string {
  const items = mapQuotationToCartItems(quotation)
  if (items.length === 0) {
    throw new Error("Quotation has no items")
  }

  setCartItems("buynow", "shop", quotation.site_id, items)

  return buildQuoteCheckoutPath({
    siteId: quotation.site_id,
    quotationId: quotation.id,
    returnTo: opts.returnTo,
    ownerSiteId: opts.ownerSiteId,
    publicAccessToken: opts.publicAccessToken,
  })
}
