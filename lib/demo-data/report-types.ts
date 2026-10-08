/** Fields consumed by local report adapters; additional fixture columns are preserved. */
export type DemoReportRow = {
  id: string
  created_at: string
  site_id?: string
  segment_id?: string
  lead_id?: string
  user_id?: string
  sale_id?: string
  sale_order_id?: string
  conversation_id?: string
  campaign_id?: string
  parent_id?: string
  name?: string
  title?: string
  email?: string
  status?: string
  type?: string
  stage?: string
  role?: string
  currency?: string
  amount?: number | string | null
  target_sale_price?: number
  sale_date?: string
  scheduled_date?: string
  completed_date?: string
  is_active?: boolean
  [key: string]: unknown
}