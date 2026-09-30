import type { Budget, Campaign } from '@/app/types'
import type { Json } from '@/lib/types/database.types'

export type CampaignBudgetRow = {
  id: string
  budget: Budget | null
  metadata: Campaign['metadata'] | null
}

export type AmountRow = { id: string; amount: number | null }
export type LeadIdRow = { id: string }
export type CampaignSegmentRow = { campaign_id: string }
export type TransactionRow = AmountRow & { type: string; campaign_id: string | null }
export type SaleRow = AmountRow & {
  lead_id: string | null
  created_at: string
  status: string
  sale_date: string | null
}

export type KpiData = {
  id: string
  name: string
  description: string | null
  value: number
  previous_value: number
  unit: string
  type: string
  period_start: string
  period_end: string
  segment_id: string | null
  is_highlighted: boolean
  target_value: number | null
  metadata: Json
  site_id: string
  user_id: string | null
  trend: number
  benchmark: number | null
}