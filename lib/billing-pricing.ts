export type BillingInterval = 'month' | 'year'

/** Display-only USD prices; Stripe checkout uses server-owned price IDs. */
export function subscriptionPrice(monthlyPrice: number, interval: BillingInterval) {
  const annualTotal = Math.round(monthlyPrice * 100 * 12 * 0.9) / 100
  return {
    total: interval === 'year' ? annualTotal : monthlyPrice,
    monthlyEquivalent: interval === 'year' ? annualTotal / 12 : monthlyPrice,
  }
}

export function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function parseBillingInterval(value: unknown): BillingInterval | null {
  return value === 'month' || value === 'year' ? value : null
}