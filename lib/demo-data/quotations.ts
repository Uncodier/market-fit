import { isoDaysAgo, isoDaysFromNow, isoNow } from './factories'

/** Fill missing sales quotation fixtures using each workspace's own customers and catalog. */
type QuotationFixture = {
  sites?: { id: string }[]
  leads?: { id: string }[]
  catalog_items?: { id: string; name: string; parent_id?: string | null; target_sale_price: number; currency?: string }[]
  quotations?: unknown[]
}

export function attachDemoQuotations<T extends QuotationFixture>(data: T) {
  if (data.quotations?.length) return data
  const siteId = data.sites?.[0]?.id
  const customers = data.leads || []
  const catalog = (data.catalog_items || []).filter((item) => !item.parent_id)
  if (!siteId || !customers.length || !catalog.length) return data
  const quotations = ['draft', 'sent', 'accepted', 'rejected'].map((status, index) => {
    const item = catalog[index % catalog.length]
    const total = Number(item.target_sale_price) * (index + 1)
    return {
      id: `quote-${siteId}-${index + 1}`, site_id: siteId,
      lead_id: customers[index % customers.length].id, purpose: 'sales', status,
      currency: item.currency || 'USD', subtotal: total, total,
      discount_total: 0, tax_total: 0,
      valid_until: isoDaysFromNow(14).slice(0, 10),
      created_at: isoDaysAgo(index + 1), updated_at: isoNow(),
      notes: 'Sample commercial proposal. Demo quotations are read-only.',
    }
  })
  const quotation_items = quotations.map((quote, index) => {
    const item = catalog[index % catalog.length]
    return {
      id: `${quote.id}-item`, quotation_id: quote.id, catalog_item_id: item.id,
      name: item.name, quantity: index + 1, unit_price: Number(item.target_sale_price),
      subtotal: quote.total,
    }
  })
  return { ...data, quotations, quotation_items }
}