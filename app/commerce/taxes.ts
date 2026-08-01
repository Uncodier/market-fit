import { Tax } from "@/app/types"

/** Round money to 2 decimal places. */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

/** Sum of tax rates as a fraction (e.g. 16 + 8 => 0.24). */
export function combinedTaxFraction(taxes: Pick<Tax, "rate">[]): number {
  const percent = taxes.reduce((sum, tax) => sum + (Number(tax.rate) || 0), 0)
  return percent / 100
}

/** Tax amount for a line subtotal given associated taxes (exclusive). */
export function calculateLineTax(lineSubtotal: number, taxes: Pick<Tax, "rate">[]): number {
  return roundMoney(lineSubtotal * combinedTaxFraction(taxes))
}

/**
 * Aggregate tax total for cart/order lines.
 * `taxesByItemId` maps catalog_item_id -> taxes applied to that item.
 */
export function calculateOrderTaxTotal(
  lines: { catalogItemId: string; subtotal: number }[],
  taxesByItemId: Record<string, Pick<Tax, "rate">[]>
): number {
  const taxTotal = lines.reduce((sum, line) => {
    const taxes = taxesByItemId[line.catalogItemId] || []
    return sum + calculateLineTax(line.subtotal, taxes)
  }, 0)
  return roundMoney(taxTotal)
}

export function formatTaxRateLabel(rate: number): string {
  const value = Number(rate) || 0
  return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(2)}%`
}
