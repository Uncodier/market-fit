import { parseBillingInterval, type BillingInterval } from './billing-pricing'

const KEY = 'makinari:billing-interval-preference'

/** A non-authoritative display choice, never a payment or entitlement. */
export function rememberBillingInterval(value: unknown) {
  const interval = parseBillingInterval(value)
  if (!interval) return
  try { window.localStorage.setItem(KEY, interval) } catch { /* Storage may be blocked. */ }
}

export function preferredBillingInterval(fallback: BillingInterval): BillingInterval {
  if (typeof window === 'undefined') return fallback
  const fromUrl = parseBillingInterval(new URLSearchParams(window.location.search).get('billingInterval'))
  if (fromUrl) return fromUrl
  try { return parseBillingInterval(window.localStorage.getItem(KEY)) ?? fallback } catch { return fallback }
}