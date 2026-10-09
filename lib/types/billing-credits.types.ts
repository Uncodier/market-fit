/** Regular credits exclude withdrawable cash; credits_available is the bucket sum. */
export interface BillingCreditBalances {
  billing_interval?: 'month' | 'year'
  paid_subscription_period_start?: string | null
  paid_subscription_period_end?: string | null
  paid_subscription_invoice_id?: string | null
  paid_subscription_paid_at?: string | null
  plan_credit_anchor?: string | null
  paid_subscription_plan?: 'commission' | 'engine' | 'foundry' | 'enterprise' | null
  paid_subscription_addons_count?: number | null
  plan_credits_available?: number
  purchased_credits_available?: number
  legacy_credits_available?: number
  plan_credit_period_start?: string | null
  plan_credit_period_end?: string | null
  plan_credit_allowance?: number
  monthly_credits_used?: number
  plan_credits_used?: number
  plan_credit_source?: string
}

export interface BillingCreditRow {
  billing_interval: 'month' | 'year'
  paid_subscription_period_start: string | null
  paid_subscription_period_end: string | null
  paid_subscription_invoice_id: string | null
  paid_subscription_paid_at: string | null
  plan_credit_anchor: string | null
  paid_subscription_plan: 'commission' | 'engine' | 'foundry' | 'enterprise' | null
  paid_subscription_addons_count: number | null
  plan_credits_available: number
  purchased_credits_available: number
  legacy_credits_available: number
  plan_credit_period_start: string | null
  plan_credit_period_end: string | null
  plan_credit_allowance: number
  monthly_credits_used: number
  plan_credits_used: number
  plan_credit_source: string
  account_balance: number
}