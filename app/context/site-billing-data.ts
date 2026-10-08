import type { Site } from './site-types'
import { parseBillingInterval } from '@/lib/billing-pricing'

type SiteBilling = NonNullable<Site['billing']>

/** Safe billing hydration fields shared by full-site and billing-only reads. */
export const SITE_BILLING_FIELDS = [
  'plan', 'billing_interval', 'addons_count', 'masked_card_number', 'card_name',
  'card_expiry', 'stripe_customer_id', 'stripe_payment_method_id', 'card_address',
  'card_city', 'card_postal_code', 'card_country', 'tax_id', 'billing_address',
  'billing_city', 'billing_postal_code', 'billing_country', 'auto_renew',
  'credits_available', 'credits_used', 'account_balance', 'plan_credits_available',
  'purchased_credits_available', 'legacy_credits_available', 'plan_credit_period_start',
  'plan_credit_period_end', 'plan_credit_allowance', 'plan_credit_anchor', 'monthly_credits_used',
  'plan_credits_used', 'plan_credit_source', 'paid_subscription_period_start',
  'paid_subscription_period_end', 'paid_subscription_invoice_id',
  'paid_subscription_paid_at', 'paid_subscription_plan', 'paid_subscription_addons_count',
] as const satisfies readonly (keyof SiteBilling)[]

export const SITE_BILLING_READ_FIELDS = SITE_BILLING_FIELDS.join(', ')

// These fields are introduced together by the pending annual-coverage migration.
export const ANNUAL_BILLING_FIELDS = [
  'billing_interval', 'plan_credit_anchor', 'paid_subscription_period_start',
  'paid_subscription_period_end', 'paid_subscription_invoice_id',
  'paid_subscription_paid_at', 'paid_subscription_plan', 'paid_subscription_addons_count',
] as const satisfies readonly (keyof SiteBilling)[]

export const LEGACY_SITE_BILLING_READ_FIELDS = SITE_BILLING_FIELDS
  .filter(field => !(ANNUAL_BILLING_FIELDS as readonly string[]).includes(field)).join(', ')

/** Keep interval/paid-invoice coverage when rebuilding a site from its API row. */
export function hydrateSiteBilling(row: Partial<SiteBilling>): SiteBilling {
  const fields = Object.fromEntries(SITE_BILLING_FIELDS
    .filter(field => row[field] !== undefined)
    .map(field => [field, row[field]]))
  return {
    ...fields,
    plan: row.plan || 'commission',
    billing_interval: parseBillingInterval(row.billing_interval) ?? 'month',
    addons_count: row.addons_count || 0,
    auto_renew: row.auto_renew ?? true,
    credits_available: row.credits_available || 0,
    credits_used: row.credits_used || 0,
    account_balance: row.account_balance || 0,
  }
}