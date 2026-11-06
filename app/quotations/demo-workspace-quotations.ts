import { getDemoData, isKnownDemoSite } from '@/lib/demo-data'
import type { listWorkspaceQuotations } from './workspace-read-actions'

type QuoteRow = { id: string; site_id: string; lead_id: string; status: string; created_at: string; updated_at: string; subtotal: number; total: number; currency: string }
type LeadRow = { id: string; name?: string; email?: string }
type ItemRow = { quotation_id: string; catalog_item_id: string; subtotal: number }

export async function getDemoWorkspaceQuotation(siteId: string, id: string) {
  if (!isKnownDemoSite(siteId)) return null
  const data = await getDemoData(siteId)
  const quote = data?.quotations?.find((row: QuoteRow) => row.id === id && row.site_id === siteId)
  if (!quote) return null
  return {
    ...quote,
    lead: data?.leads?.find((row: LeadRow) => row.id === quote.lead_id) || null,
    items: (data?.quotation_items || []).filter((row: ItemRow) => row.quotation_id === id),
  }
}

export async function listDemoWorkspaceQuotations(input: Parameters<typeof listWorkspaceQuotations>[0]) {
  if (!isKnownDemoSite(input.siteId)) return { data: [], count: 0 }
  const data = await getDemoData(input.siteId)
  const search = (input.q || '').trim().toLowerCase()
  const rows = (data?.quotations || []).filter((quote: QuoteRow) => quote.site_id === input.siteId)
    .map((quote: QuoteRow) => ({ ...quote, lead: data?.leads?.find((lead: LeadRow) => lead.id === quote.lead_id) || null }))
    .filter((quote: QuoteRow & { lead: LeadRow | null }) => (!input.status || input.status === 'all' || quote.status === input.status) &&
      (!search || [quote.id, quote.lead?.name, quote.lead?.email].some(value => String(value || '').toLowerCase().includes(search))))
  const field = input.sort === 'updated_at' ? 'updated_at' : 'created_at'
  rows.sort((a: QuoteRow, b: QuoteRow) => (String(a[field]).localeCompare(String(b[field]))) * (input.sort === 'oldest' ? 1 : -1))
  const start = ((input.page || 1) - 1) * (input.pageSize || 50)
  return { data: rows.slice(start, start + (input.pageSize || 50)), count: rows.length }
}