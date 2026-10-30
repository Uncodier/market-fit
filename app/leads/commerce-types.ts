export type LeadCommerceKind = "quotations" | "purchases" | "payments"

export interface LeadCommerceRow {
  id: string
  title: string
  href: string
  date: string
  amount: number
  currency: string
  status: string
  amountDue?: number
  method?: string
}

export interface LeadCommerceResult {
  rows?: LeadCommerceRow[]
  count?: number
  error?: string
}

export const LEAD_COMMERCE_PAGE_SIZE = 25