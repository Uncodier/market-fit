import type { CatalogItem } from "@/app/types"
import type { PosCartItem } from "./cart-types"
import { clearLineDiscountFields } from "./line-discount"
import { normalizeCheckoutLinesToCurrency, resolveProductCurrency } from "@/app/commerce/checkout-currency"

/** Catalog list prices are not in the stored order-line currency. */
export function repricePosCart(
  cart: PosCartItem[], catalog: CatalogItem[], resolvePrice: (item: CatalogItem) => number,
  rates: Record<string, number>,
  options: { automatic?: boolean; siteCurrency?: string } = {},
): PosCartItem[] {
  const byId = new Map(catalog.map((item) => [item.id, item]))
  return cart.map((line) => {
    // A manual host/discount quotes the whole composition; only an explicit
    // operator list change may replace it. Automatic hosts protect manual extras separately.
    if (options.automatic && (line.saleOrderItemId || line.priceSource === "manual" ||
      line.priceSource === "restored" || Number(line.cartDiscountPercent) > 0)) return line
    const product = byId.get(line.id) || line
    const raw = resolvePrice(product)
    const productCurrency = resolveProductCurrency(product.currency, options.siteCurrency || line.currency)
    const currency = line.saleOrderItemId ? resolveProductCurrency(line.currency) : productCurrency
    const normalized = normalizeCheckoutLinesToCurrency(
      [{ currency: productCurrency, unit_price: raw, subtotal: raw }], currency, rates,
    ).lines[0]
    const modifiers = line.modifiers?.map((modifier) => {
      if (options.automatic && (modifier.saleOrderItemId || modifier.priceSource === "manual" ||
        modifier.priceSource === "restored")) return modifier
      const product = byId.get(modifier.catalogItemId)
      if (!product) return modifier
      const raw = resolvePrice(product)
      const target = modifier.saleOrderItemId
        ? resolveProductCurrency(modifier.currency, line.currency)
        : resolveProductCurrency(product.currency, options.siteCurrency || currency)
      const price = normalizeCheckoutLinesToCurrency([{ currency: resolveProductCurrency(product.currency, options.siteCurrency || currency),
        unit_price: raw, subtotal: raw }], target, rates).lines[0].unit_price
      return { ...modifier, currency: target, cartPrice: price, priceSource: "automatic" as const }
    })
    return { ...clearLineDiscountFields(line, normalized.unit_price), priceSource: "automatic", currency, modifiers }
  })
}