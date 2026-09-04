export interface BillingData {
  plan: "commission" | "starter" | "startup" | "enterprise"
  addons_count?: number
  card_name?: string
  card_number?: string
  card_expiry?: string
  card_cvc?: string
  card_address?: string
  card_city?: string
  card_postal_code?: string
  card_country?: string
  tax_id?: string
  billing_address?: string
  billing_city?: string
  billing_postal_code?: string
  billing_country?: string
  auto_renew?: boolean
  credits_available?: number
  credits_used?: number
}
