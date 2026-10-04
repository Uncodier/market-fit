/** Regular credits exclude withdrawable cash; credits_available is the bucket sum. */
export interface BillingCreditBalances {
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