import 'server-only'
import type Stripe from 'stripe'
import type { BillingPlan } from './billing-plans'

export type BillingInterval = 'month' | 'year'
export class SubscriptionRequestError extends Error {
  constructor(message: string, public readonly status = 400) { super(message) }
}

const catalog = [
  { plan: 'engine', monthly: 2300, month: 'STRIPE_STARTER_PRICE_ID', year: 'STRIPE_STARTER_ANNUAL_PRICE_ID' },
  { plan: 'foundry', monthly: 9900, month: 'STRIPE_STARTUP_PRICE_ID', year: 'STRIPE_STARTUP_ANNUAL_PRICE_ID' },
  { plan: 'enterprise', monthly: 50000, month: 'STRIPE_ENTERPRISE_PRICE_ID', year: 'STRIPE_ENTERPRISE_ANNUAL_PRICE_ID' },
  { plan: 'addon', monthly: 1000, month: 'STRIPE_ACCOUNT_ADDON_PRICE_ID', year: 'STRIPE_ACCOUNT_ADDON_ANNUAL_PRICE_ID' },
] as const

export function parseBillingInterval(value: unknown): BillingInterval {
  if (value === undefined) return 'month'
  if (value !== 'month' && value !== 'year') throw new SubscriptionRequestError('Invalid billing interval')
  return value
}

export function parseAddonsCount(value: unknown): number {
  if (value === undefined) return 0
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) {
    throw new SubscriptionRequestError('Invalid add-on count')
  }
  const count = Number(value)
  if (!Number.isSafeInteger(count) || count < 0 || count > 100) {
    throw new SubscriptionRequestError('Invalid add-on count')
  }
  return count
}

export function configuredSubscriptionPrices() {
  const prices = catalog.flatMap((entry) => (['month', 'year'] as const).flatMap((interval) => {
    const priceId = process.env[entry[interval]]?.trim()
    return priceId ? [{ plan: entry.plan, interval, priceId,
      amount: interval === 'year' ? entry.monthly * 108 / 10 : entry.monthly }] : []
  }))
  if (new Set(prices.map(({ priceId }) => priceId)).size !== prices.length) {
    throw new SubscriptionRequestError('Ambiguous subscription price configuration', 503)
  }
  return prices
}

export function configuredSubscriptionPrice(priceId: string) {
  return configuredSubscriptionPrices().find((price) => price.priceId === priceId)
}

export function validateSubscriptionPrice(price: Stripe.Price, config: NonNullable<ReturnType<typeof configuredSubscriptionPrice>>, requireActive = false) {
  if (price.id !== config.priceId || (requireActive && !price.active) || price.currency !== 'usd' ||
      price.type !== 'recurring' || price.recurring?.interval !== config.interval ||
      price.recurring.interval_count !== 1 || price.recurring.usage_type !== 'licensed' ||
      price.unit_amount !== config.amount || price.billing_scheme !== 'per_unit' || price.transform_quantity) {
    throw new SubscriptionRequestError('Configured subscription price is invalid', 503)
  }
}

export async function resolveSubscriptionCheckoutPrices(stripe: Pick<Stripe, 'prices'>, plan: BillingPlan, interval: BillingInterval, addonsCount: number) {
  const prices = configuredSubscriptionPrices()
  const base = prices.find((price) => price.plan === plan && price.interval === interval)
  const addon = prices.find((price) => price.plan === 'addon' && price.interval === interval)
  if (!base || (addonsCount > 0 && !addon)) {
    throw new SubscriptionRequestError(`Subscription ${interval === 'year' ? 'annual' : 'monthly'} pricing is not configured`, 503)
  }
  const selected = addonsCount > 0 && addon ? [base, addon] : [base]
  const live = await Promise.all(selected.map(async (config) => {
    const price = await stripe.prices.retrieve(config.priceId)
    validateSubscriptionPrice(price, config, true)
    return price
  }))
  return { base, addon, basePrice: live[0] }
}