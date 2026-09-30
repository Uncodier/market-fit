import type { JournalEntry, JournalLine } from '../types'

export type JournalDraft = {
  entry: Partial<JournalEntry>
  lines: Partial<JournalLine>[]
}

export interface PaymentSource {
  id?: string | null
  amount?: number | string | null
  date?: string | null
  currency?: string | null
}

export interface SaleRefundSource {
  id: string
  amount: number
  currency: string
  refunded_at: string
}

/** Raw sale row plus successful, separately loaded accounting refund records. */
export interface SaleSource {
  id: string
  site_id: string
  status: string
  amount: number
  amount_due: number
  sale_date: string
  currency?: string | null
  location_id?: string | null
  lead_id?: string | null
  campaign_id?: string | null
  segment_id?: string | null
  company_id?: string | null
  accounting_state?: string
  title?: string | null
  product_name?: string | null
  invoice_number?: string | number | null
  reference_code?: string | null
  payments?: PaymentSource[] | null
  refunds?: SaleRefundSource[]
  leads?: { name?: string | null } | Array<{ name?: string | null }> | null
  companies?: { name?: string | null } | Array<{ name?: string | null }> | null
}

export interface SaleOrderSource {
  tax_total?: number | null
  taxTotal?: number | null
  sale_order_items?: Array<{
    catalog_item_id?: string | null
    catalog_items?: {
      category_id?: string | null
      catalog_categories?: { income_account_key?: string | null } | null
    } | null
  }> | null
}

export interface ExpenseSource {
  id: string
  site_id: string
  amount: number
  category: string
  date: string
  currency: string
  description?: string | null
  sale_order_id?: string | null
  location_id?: string | null
  lead_id?: string | null
  campaign_id?: string | null
  segment_id?: string | null
  catalog_item_id?: string | null
  catalog_category_id?: string | null
  company_id?: string | null
  accounting_state?: string
  catalog_category?: { cogs_account_key?: string | null } | null
}

export interface PurchaseSource {
  id: string
  site_id: string
  status: string
  amount: number
  amount_due: number
  purchase_date: string
  currency?: string | null
  location_id?: string | null
  vendor_company_id?: string | null
  title?: string | null
  notes?: string | null
  accounting_state?: string
  payments?: PaymentSource[] | null
  vendor?: { name?: string | null } | Array<{ name?: string | null }> | null
}

export interface PurchaseItemSource {
  catalog_item_id?: string | null
  name?: string | null
  quantity?: number | null
  unit_cost?: number | null
  subtotal?: number | null
  catalog_items?: { kind?: string | null } | null
}