import { render, screen } from '@testing-library/react'
import { TenderQuotationDetail } from '@/app/quotations/components/TenderQuotationDetail'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { name: 'Supplier company', settings: {} } }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('react-markdown', () => ({ __esModule: true, default: () => null }))
jest.mock('remark-gfm', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/app/components/simple-messages-view/utils/markdownComponents', () => ({ markdownComponents: {} }))

it('renders the actual shared quotation invoice with company, buyer, lines and total read-only', () => {
  render(<TenderQuotationDetail quotation={{
    id: 'proposal-123', purpose: 'procurement', status: 'sent', reference: 'Q-2026-42', title: 'Maintenance tender',
    tender_url: '/tenders/buyer/maintenance', created_at: '2026-10-01T12:00:00Z', currency: 'USD',
    site: { name: 'Supplier company' }, lead: { name: 'Buyer company' },
    subtotal: 25, tax_total: 4, total: 29,
    items: [{ id: 'line', name: 'Equipment inspection', quantity: 5, unit_price: 5, subtotal: 25 }],
  }} />)
  expect(screen.getByText('Supplier company')).toBeInTheDocument()
  expect(screen.getByText('Buyer company')).toBeInTheDocument()
  expect(screen.getByText('Equipment inspection')).toBeInTheDocument()
  expect(screen.getByText('Maintenance tender')).toBeInTheDocument()
  expect(screen.getAllByText('$29.00').length).toBeGreaterThan(0)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'View tender' })).toHaveAttribute('href', '/tenders/buyer/maintenance')
})