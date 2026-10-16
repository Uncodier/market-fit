import type { CatalogItem } from "@/app/types"
import type { PosCartItem } from "./cart-types"
import { clearLineDiscountFields } from "./line-discount"
import { normalizeCheckoutLinesToCurrency, resolveProductCurrency } from "@/app/commerce/checkout-currency"

/** Catalog list prices are not in the stored order-line currency. */
export function repricePosCart(
  cart: PosCartItem[], catalog: CatalogItem[], resolvePrice: (item: CatalogItem) => number,
  rates: Record<string, number>,
): PosCartItem[] {
  const byId = new Map(catalog.map((item) => [item.id, item]))
  return cart.map((line) => {
    const product = byId.get(line.id) || line
    const raw = resolvePrice(product)
    const productCurrency = resolveProductCurrency(product.currency, line.currency)
    const currency = line.saleOrderItemId ? resolveProductCurrency(line.currency) : productCurrency
    const normalized = normalizeCheckoutLinesToCurrency(
      [{ currency: productCurrency, unit_price: raw, subtotal: raw }], currency, rates,
    ).lines[0]
    const modifiers = line.modifiers?.map((modifier) => {
      const product = byId.get(modifier.catalogItemId)
      if (!product) return modifier
      const raw = resolvePrice(product)
      const target = modifier.saleOrderItemId
        ? resolveProductCurrency(modifier.currency, line.currency)
        : resolveProductCurrency(product.currency, currency)
      const price = normalizeCheckoutLinesToCurrency([{ currency: product.currency,
        unit_price: raw, subtotal: raw }], target, rates).lines[0].unit_price
      return { ...modifier, currency: target, cartPrice: price }
    })
    return { ...clearLineDiscountFields(line, normalized.unit_price), currency, modifiers }
  })
}