/** Display-only standard card payment rates, including processing; not settlement logic. */
export const SALE_PAYMENT_FEE_BASIS_POINTS = Object.freeze({
  commission: 700,
  engine: 600,
  foundry: 550,
  enterprise: 450,
} as const)

export type SalePaymentFeePlan = keyof typeof SALE_PAYMENT_FEE_BASIS_POINTS

/** Unknown plans have no verified current rate; callers must label the default as such. */
export function normalizeSalePaymentFeePlan(value: unknown): SalePaymentFeePlan | null {
  if (typeof value !== 'string') return null
  switch (value) {
    case 'commission': case 'free': return 'commission'
    case 'engine': return 'engine'
    case 'foundry': return 'foundry'
    case 'enterprise': return 'enterprise'
    default: return null
  }
}

/** One percentage point is 100 basis points. Billing interval does not change this rate. */
export function salePaymentFeePercent(plan: unknown): number {
  return SALE_PAYMENT_FEE_BASIS_POINTS[normalizeSalePaymentFeePlan(plan) ?? 'commission'] / 100
}