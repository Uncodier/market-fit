import 'server-only'
import { configuredSubscriptionPrices, SubscriptionRequestError } from './subscription-pricing.server'

/** Read-only compatibility. Never use this catalog to select a new checkout Price. */
export function configuredHistoricalSubscriptionPrices() {
  const current = configuredSubscriptionPrices()
  const ids = process.env.STRIPE_ENTERPRISE_LEGACY_MONTHLY_PRICE_IDS?.trim()
  const amount = process.env.STRIPE_ENTERPRISE_LEGACY_MONTHLY_AMOUNT?.trim()
  if (!ids && !amount) return current
  // This is specifically the retired $499 USD monthly Enterprise service, not
  // a configurable amount override or automatic discovery of unknown prices.
  if (!ids || amount !== '49900') {
    throw new SubscriptionRequestError('Historical Enterprise pricing is not configured safely', 503)
  }
  const priceIds = ids.split(',').map((id) => id.trim())
  if (priceIds.length > 100 || priceIds.some((id) => !/^price_[A-Za-z0-9]+$/.test(id)) ||
      new Set(priceIds).size !== priceIds.length) {
    throw new SubscriptionRequestError('Invalid historical Enterprise price allowlist', 503)
  }
  const historical = priceIds.map((priceId) => {
    const collision = current.find((price) => price.priceId === priceId)
    // During rollout the old monthly Enterprise ID may still occupy the new
    // checkout variable. Override it ONLY in read proof; checkout still needs $500.
    if (collision && (collision.plan !== 'enterprise' || collision.interval !== 'month')) {
      throw new SubscriptionRequestError('Ambiguous historical subscription price configuration', 503)
    }
    return { priceId, plan: 'enterprise' as const, interval: 'month' as const, amount: 49900 }
  })
  return [...current.filter((price) => !priceIds.includes(price.priceId)), ...historical]
}

export function configuredHistoricalSubscriptionPrice(priceId: string) {
  return configuredHistoricalSubscriptionPrices().find((price) => price.priceId === priceId)
}