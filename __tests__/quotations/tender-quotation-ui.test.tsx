import { fireEvent, render, screen } from '@testing-library/react'
import { QuotesTable } from '@/app/components/documents/quotes-table'
import { TenderQuotationDetail } from '@/app/quotations/components/TenderQuotationDetail'
import { QuotationInvoice } from '@/app/quotations/components/QuotationInvoice'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/quotations/components/QuotationInvoice', () => ({ QuotationInvoice: jest.fn(() => <div>Shared quotation document</div>) }))

const quote = { id: 'quote-1', entityName: 'Buyer', status: 'sent', total: 25, currency: 'USD', createdAt: '2026-10-01T00:00:00Z' }
it('adds a tender link in the same table without hijacking detail navigation', () => {
  const open = jest.fn()
  render(<QuotesTable rows={[{ ...quote, tenderUrl: '/tenders/buyer/services' }, { ...quote, id: 'sale-2', entityName: 'Sales customer' }]}
    page={1} pageSize={50} totalCount={2} entityColumnLabel="Client" emptyTitle="Empty" emptyDescription="" onPageChange={jest.fn()} onRowClick={open} />)
  const link = screen.getByRole('link', { name: 'View tender' })
  expect(link).toHaveAttribute('href', '/tenders/buyer/services')
  expect(link).toHaveTextContent('Tender')
  fireEvent.click(link)
  expect(open).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Buyer'))
  expect(open).toHaveBeenCalledWith('quote-1')
  expect(screen.getAllByRole('link', { name: 'View tender' })).toHaveLength(1)
})

it('reuses the invoice for tender detail without passing sales mutation handlers', () => {
  const quotation = { id: 'proposal', purpose: 'procurement', tender_url: '/tenders/buyer/services', reference: 'REF-42' }
  render(<TenderQuotationDetail quotation={quotation} />)
  expect(screen.getByText('Shared quotation document')).toBeInTheDocument()
  expect(screen.getByText('REF-42')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'View tender' })).toHaveAttribute('href', quotation.tender_url)
  expect(jest.mocked(QuotationInvoice).mock.calls.at(-1)?.[0]).toEqual({ quotation })
  expect(screen.queryByRole('button', { name: /edit|send|delete|accept|print/i })).not.toBeInTheDocument()
})