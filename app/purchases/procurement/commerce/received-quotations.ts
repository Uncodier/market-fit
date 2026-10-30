import type { QuoteListItem } from '@/app/components/documents/quotes-table'
import type { ProcurementQuotation } from './contracts'

export interface MerchantQuotation {
  id: string
  site?: { name?: string } | null
  status: string
  valid_until?: string | null
  total: number | null
  currency: string
  created_at: string
}

export function receivedQuotationRows(quotes: ProcurementQuotation[], merchants: MerchantQuotation[],
  t: (key: string) => string): QuoteListItem[] {
  const procurement = quotes.map(quote => ({
    id: quote.id, entityName: quote.supplier_name, reference: quote.reference,
    status: quote.award_id ? 'accepted' : 'sent',
    statusLabel: t(quote.award_id ? 'procurement.partners.quotes.awardApproved' : 'procurement.partners.quotes.notAwarded'),
    sourceLabel: t(quote.source === 'supplier_submitted' ? 'procurement.partners.quotes.supplierSubmitted' : 'procurement.partners.quotes.buyerRecorded'),
    total: quote.tax_amount_minor == null ? null : (quote.net_amount_minor + quote.tax_amount_minor) / 100,
    net: quote.net_amount_minor / 100, currency: quote.currency,
    createdAt: quote.recorded_at, tenderUrl: `/purchases/tenders/${quote.tender_id}`, tenderTitle: quote.tender_title,
  }))
  const ids = new Set(procurement.map(row => row.id))
  return [...procurement, ...merchants.filter(quote => !ids.has(quote.id)).map(quote => ({
    id: quote.id, entityName: quote.site?.name || t('buyer.quotes.table.unknown'), status: quote.status,
    validUntil: quote.valid_until, total: quote.total == null ? null : Number(quote.total), currency: quote.currency, createdAt: quote.created_at,
  }))].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}