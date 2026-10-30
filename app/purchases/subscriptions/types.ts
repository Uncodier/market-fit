export interface PurchasedSubscription {
  id: string
  site_id: string
  catalog_item_id: string
  status: string
  amount: number
  start_date?: string | null
  end_date?: string | null
  next_billing_date?: string | null
  created_at: string
  updated_at?: string | null
  catalog_item?: { id: string; name: string; currency?: string | null } | null
  site?: { id: string; name: string } | null
  entitlements?: Array<{
    id: string
    uses_remaining?: number | null
    catalog_item?: { name: string; digital_subtype?: string | null } | null
  }>
}