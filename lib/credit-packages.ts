import 'server-only'

export type CreditPackage = Readonly<{
  credits: number
  unitAmount: number
  currency: 'usd'
}>

// Amounts are integer cents, shared by Checkout and full-discount verification.
export const CREDIT_PACKAGES: readonly CreditPackage[] = Object.freeze([
  Object.freeze({ credits: 20, unitAmount: 2000, currency: 'usd' as const }),
  Object.freeze({ credits: 52, unitAmount: 4925, currency: 'usd' as const }),
  Object.freeze({ credits: 515, unitAmount: 50000, currency: 'usd' as const }),
])

export function getCreditPackage(credits: unknown): CreditPackage | undefined {
  return CREDIT_PACKAGES.find(candidate => candidate.credits === credits)
}