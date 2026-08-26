import { convertAmount } from "@/app/lib/fx"
import { roundMoney } from "@/app/commerce/taxes"

export type CheckoutMoneyLine = {
  currency?: string | null
  unit_price: number
  subtotal: number
}

export function resolveSiteCurrency(siteCurrency?: string | null): string {
  const trimmed = siteCurrency?.trim()
  return trimmed ? trimmed.toUpperCase() : "USD"
}

export function resolveLineCurrency(currency?: string | null): string {
  return resolveSiteCurrency(currency)
}

/** Product currency when set; otherwise the site currency (USD only as last resort). */
export function resolveProductCurrency(
  productCurrency?: string | null,
  siteCurrency?: string | null,
): string {
  const trimmed = productCurrency?.trim()
  return trimmed ? trimmed.toUpperCase() : resolveSiteCurrency(siteCurrency)
}

/**
 * Charge in the products' currency when every line agrees.
 * Missing line currencies inherit the site; mixed carts settle in the site currency.
 */
export function resolveCheckoutOrderCurrency(
  lines: { currency?: string | null }[],
  siteCurrency?: string | null,
): string {
  const site = resolveSiteCurrency(siteCurrency)
  if (lines.length === 0) return site
  const codes = new Set<string>()
  for (const line of lines) {
    const trimmed = line.currency?.trim()
    if (trimmed) codes.add(trimmed.toUpperCase())
  }
  if (codes.size === 1) return [...codes][0]
  return site
}

export function checkoutLinesNeedFxConversion<T extends CheckoutMoneyLine>(
  lines: T[],
  targetCurrency: string,
): boolean {
  const target = targetCurrency.toUpperCase()
  return lines.some(
    (line) => resolveProductCurrency(line.currency, target) !== target,
  )
}

export function normalizeCheckoutLinesToCurrency<T extends CheckoutMoneyLine>(
  lines: T[],
  targetCurrency: string,
  rates: Record<string, number>,
): { lines: T[]; subtotal: number } {
  const target = targetCurrency.toUpperCase()
  const converted = lines.map((line) => {
    const from = resolveProductCurrency(line.currency, target)
    if (from === target) {
      return { ...line, currency: target }
    }
    const unit = convertAmount(line.unit_price, from, target, rates)
    const sub = convertAmount(line.subtotal, from, target, rates)
    if (unit === null || sub === null) {
      throw new Error(`Unable to convert ${from} to ${target}.`)
    }
    return {
      ...line,
      currency: target,
      unit_price: roundMoney(unit),
      subtotal: roundMoney(sub),
    }
  })
  const subtotal = roundMoney(
    converted.reduce((sum, line) => sum + line.subtotal, 0),
  )
  return { lines: converted, subtotal }
}

/** POS cart totals: convert when rates exist, otherwise keep the original amount. */
export function convertCartAmountToCurrency(
  amount: number,
  fromCurrency: string | null | undefined,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  const converted = convertAmount(
    amount,
    resolveProductCurrency(fromCurrency, toCurrency),
    toCurrency,
    rates,
  )
  if (converted === null) return amount
  return roundMoney(converted)
}
