import type { StripeSubscriptionInvoiceInput, StripeSubscriptionInvoiceResult } from "@/app/api/stripe/webhook/subscription-invoice-settlement"

export interface BillingDatabaseFunctions {
  initialize_site_billing: {
    Args: { p_site_id: string }
    Returns: {
      success: boolean
      outcome?: "initialized" | "already_initialized"
      credits_granted?: number
      billing_id?: string
      credits_available?: number
      error?: string
    }
  }
  renew_site_plan_credits: {
    Args: { p_site_id: string }
    Returns: {
      success: boolean
      outcome?: "reset" | "not_due" | "stale_period" | "stripe_managed" | "inactive"
      credits_granted?: number
      credits_available?: number
      error?: string
    }
  }
  grant_purchased_site_credits: {
    Args: { p_site_id: string; p_amount: number; p_idempotency_key: string; p_metadata?: Record<string, unknown> }
    Returns: { success: boolean; outcome: "granted" | "duplicate"; new_balance: number; credits_granted: number }
  }
  settle_stripe_subscription_invoice: {
    Args: { p_invoice: StripeSubscriptionInvoiceInput }
    Returns: StripeSubscriptionInvoiceResult
  }
}