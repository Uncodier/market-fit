import { convertCartAmountToCurrency, resolveCheckoutOrderCurrency } from "@/app/commerce/checkout-currency"
import { roundMoney } from "@/app/commerce/taxes"
import type { PosCartItem } from "@/app/pos/components/CartPanel"

export function resolvePosCartCurrency(
  cart: PosCartItem[],
  siteCurrency: string,
): string {
  return resolveCheckoutOrderCurrency(
    cart.filter((item) => item.cartQty > 0).flatMap((item) => [
      { currency: item.currency },
      ...(item.modifiers || []).map((modifier) => ({ currency: modifier.currency || item.currency })),
    ]),
    siteCurrency,
  )
}

export function posCartSubtotalInSiteCurrency(
  cart: PosCartItem[],
  siteCurrency: string,
  rates: Record<string, number>,
): number {
  return roundMoney(
    cart.reduce((sum, item) => sum + posCartLineSubtotal(item, siteCurrency, rates), 0),
  )
}

export function posCartLineSubtotal(item: PosCartItem, currency: string, rates: Record<string, number>): number {
  const host = convertCartAmountToCurrency(item.cartPrice * item.cartQty, item.currency, currency, rates)
  return roundMoney(host + (item.modifiers || []).reduce((sum, modifier) => sum +
    convertCartAmountToCurrency(modifier.cartPrice * modifier.cartQty * item.cartQty,
      modifier.currency || item.currency, currency, rates), 0))
}

export function posCartTaxLinesInSiteCurrency(
  cart: PosCartItem[],
  siteCurrency: string,
  rates: Record<string, number>,
): { catalogItemId: string; subtotal: number }[] {
  const lines: { catalogItemId: string; subtotal: number }[] = []
  for (const c of cart.filter((x) => x.cartQty > 0)) {
    lines.push({
      catalogItemId: c.id,
      subtotal: convertCartAmountToCurrency(
        c.cartPrice * c.cartQty,
        c.currency,
        siteCurrency,
        rates,
      ),
    })
    for (const m of c.modifiers || []) {
      lines.push({
        catalogItemId: m.catalogItemId,
        subtotal: convertCartAmountToCurrency(
          m.cartPrice * m.cartQty * c.cartQty,
          m.currency || c.currency,
          siteCurrency,
          rates,
        ),
      })
    }
  }
  return lines
}
