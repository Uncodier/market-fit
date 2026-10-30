import { fireEvent, render, screen, within } from '@testing-library/react'
import { LocalizationProvider, useLocalization } from '@/app/context/LocalizationContext'
import { QuotesTable } from '@/app/components/documents/quotes-table'
import { BuyerQuoteDocument } from '@/app/buyer/components/BuyerQuoteDocument'
import { QuotationInvoice } from '@/app/quotations/components/QuotationInvoice'
import { receivedQuotationRows } from '@/app/purchases/procurement/commerce/received-quotations'
import type { ProcurementQuotation } from '@/app/purchases/procurement/commerce/contracts'
import { toBuyerQuoteDto } from '@/app/buyer/quote-dto'
import { procurementMessage } from '@/app/purchases/procurement/i18n/messages'

jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: null }) }))
jest.mock('react-markdown', () => ({ __esModule: true, default: () => null }))
jest.mock('remark-gfm', () => ({ __esModule: true, default: () => null }))

const quote: ProcurementQuotation = {
  id: 'free-text', title: 'Proposal', supplier_id: 'supplier', supplier_name: 'Supplier',
  tender_id: 'tender', tender_title: 'Tender', publication_id: 'publication', procurement_revision: 1,
  currency: 'USD', net_amount_minor: 1234, tax_amount_minor: null, recorded_at: '2026-10-29T00:00:00Z',
  reference: 'REF', source: 'supplier_submitted', award_id: null,
  lines: [{ id: 'line', name: 'Custom service', quantity: 1, unit_net_minor: 1234,
    net_amount_minor: 1234, tax_amount_minor: null, catalog_item_id: null }],
}

test('nullable taxes and free-text catalog identity survive quotation DTOs and list integration', () => {
  const pending = receivedQuotationRows([quote], [], key => key)[0]
  expect(pending).toMatchObject({ total: null, net: 12.34 })
  expect(receivedQuotationRows([{ ...quote, tax_amount_minor: 0 }], [], key => key)[0].total).toBe(12.34)
  expect(receivedQuotationRows([{ ...quote, tax_amount_minor: 100 }], [], key => key)[0].total).toBe(13.34)
  const dto = toBuyerQuoteDto({ id: 'quote', total: null, tax_total: null, subtotal: 12.34,
    items: [{ catalog_item_id: null, name: 'Custom service' }] })
  expect(dto).toMatchObject({ total: null, tax_total: null, subtotal: 12.34 })
  expect(dto.items[0].catalog_item_id).toBeNull()
})

test('pending order and invalid explicitly linked catalog diagnostics are localized', () => {
  for (const locale of ['es', 'fr', 'de', 'ja'] as const) {
    expect(procurementMessage('Quotation catalog mapping and taxes must be resolved before ordering', locale))
      .not.toBe('Quotation catalog mapping and taxes must be resolved before ordering')
    expect(procurementMessage('A catalog item linked to this tender is unavailable or uses a different currency. Ask the buyer to correct the linked item. Your quotation was not submitted.', locale))
      .not.toContain('link every tender line')
  }
})

function PendingDocuments() {
  const { t, setLocale } = useLocalization()
  const quotation = { id: 'quote', status: 'sent', currency: 'USD', subtotal: 12.34,
    total: null, tax_total: null, discount_total: 0, items: [], created_at: '2026-10-29T00:00:00Z' }
  return <>
    {(['en', 'es', 'fr', 'de', 'ja'] as const).map(locale => <button key={locale} onClick={() => setLocale(locale)}>{locale}</button>)}
    <section data-testid="list"><QuotesTable rows={receivedQuotationRows([quote], [{ id: 'mapped', status: 'sent',
      total: 50, currency: 'USD', created_at: '2026-10-28T00:00:00Z' }], t)} page={1} pageSize={50} totalCount={2}
      entityColumnLabel="Supplier" emptyTitle="Empty" emptyDescription="" onPageChange={() => undefined} onRowClick={() => undefined} /></section>
    <section data-testid="buyer"><BuyerQuoteDocument quotation={quotation} /></section>
    <section data-testid="tender"><QuotationInvoice quotation={quotation} /></section>
  </>
}

test('buyer lists, page aggregate and quotation details localize pending taxes without a zero or final total', () => {
  localStorage.clear()
  document.cookie = 'makinari-locale=; Max-Age=0; path=/'
  render(<LocalizationProvider preferenceScope="pending-tax-test"><PendingDocuments /></LocalizationProvider>)
  const labels = { en: 'Taxes pending', es: 'Impuestos pendientes', fr: 'Taxes en attente', de: 'Steuern ausstehend', ja: '税額未確定' }
  for (const [locale, label] of Object.entries(labels)) {
    fireEvent.click(screen.getByRole('button', { name: locale }))
    expect(within(screen.getByTestId('list')).getAllByText(label)).toHaveLength(2)
    expect(within(screen.getByTestId('buyer')).getAllByText(label)).toHaveLength(3)
    expect(within(screen.getByTestId('tender')).getAllByText(label)).toHaveLength(3)
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument()
    expect(screen.queryByText('$62.34')).not.toBeInTheDocument()
  }
})

test('resolved zero taxes keep the net amount as the final total', () => {
  localStorage.clear()
  document.cookie = 'makinari-locale=; Max-Age=0; path=/'
  const quotation = { id: 'quote', status: 'sent', currency: 'USD', subtotal: 12.34,
    total: 12.34, tax_total: 0, discount_total: 0, items: [] }
  render(<LocalizationProvider preferenceScope="resolved-tax-test"><BuyerQuoteDocument quotation={quotation} /></LocalizationProvider>)
  expect(screen.queryByText('Taxes pending')).not.toBeInTheDocument()
  expect(screen.getAllByText('$12.34')).toHaveLength(3)
})