import { convertCartAmountToCurrency, resolveCheckoutOrderCurrency } from "@/app/commerce/checkout-currency"
import { roundMoney } from "@/app/commerce/taxes"
import { modifiersUnitTotal } from "@/app/pos/cart-line-utils"
import type { PosCartItem } from "@/app/pos/components/CartPanel"

export function resolvePosCartCurrency(
  cart: PosCartItem[],
  siteCurrency: string,
): string {
  return resolveCheckoutOrderCurrency(
    cart.filter((item) => item.cartQty > 0).map((item) => ({ currency: item.currency })),
    siteCurrency,
  )
}

export function posCartSubtotalInSiteCurrency(
  cart: PosCartItem[],
  siteCurrency: string,
  rates: Record<string, number>,
): number {
  return roundMoney(
    cart.reduce((sum, item) => {
      const raw =
        (item.cartPrice + modifiersUnitTotal(item.modifiers)) * item.cartQty
      return (
        sum +
        convertCartAmountToCurrency(
          raw,
          item.currency,
          siteCurrency,
          rates,
        )
      )
    }, 0),
  )
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
          c.currency,
          siteCurrency,
          rates,
        ),
      })
    }
  }
  return lines
}
