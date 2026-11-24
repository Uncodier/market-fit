import type { Sale, SaleData } from '@/app/types'

export type SalesListRow = Sale & { segmentName?: string | null }

export type SalesListRecord = SaleData & {
  leads: { name: string } | null
  segments: { name: string; site_id: string } | null
  description: string | null
  product_details: unknown
  location_id: string | null
  channel: string | null
  invoice_number: string | null
  reference_code: string | null
  tags: string[] | null
  command_id: string | null
}