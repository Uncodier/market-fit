import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { ProcurementQuotationDetail } from '@/app/purchases/quotes/quotation-detail'
import type { ProcurementQuotationDetail as Detail } from '@/app/purchases/procurement/commerce/quotation-detail-contracts'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'user-a' } }) }))

const detail: Detail = {
  quotation: { id: 'quote-a', title: 'Workplace proposal', reference: 'TECH-01', supplier_id: 'supplier-a', supplier_name: 'Technology supplier',
    tender_id: 'tender-a', tender_title: 'Office tender', publication_id: 'publication-a', procurement_revision: 2,
    currency: 'USD', net_amount_minor: 50000, tax_amount_minor: 4000, recorded_at: '2026-10-20T09:00:00Z', source: 'supplier_submitted', award_id: null,
    lines: [{ id: 'line-a', name: 'Onboarding service', quantity: 2, unit_net_minor: 25000, net_amount_minor: 50000, tax_amount_minor: 4000 }] },
  supplier: { id: 'supplier-a', name: 'Technology supplier', status: 'approved', commercial_terms: 'Net 30 after acceptance',
    contacts: [{ name: 'Taylor Brooks', email: 'taylor@example.test', phone: '+1 555 0100', role: 'Account manager', is_primary: true }] },
}

function tab(name: string) {
  fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0, ctrlKey: false })
}

function setup(siteId = 'buyer-a', id = 'quote-a') {
  const cache = new Map()
  const view = render(<SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}><ProcurementQuotationDetail siteId={siteId} id={id} /></SWRConfig>)
  return { ...view, change: (nextSite: string, nextId: string) => view.rerender(
    <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}><ProcurementQuotationDetail siteId={nextSite} id={nextId} /></SWRConfig>) }
}

beforeEach(() => {
  jest.clearAllMocks()
  document.cookie = 'market_fit_demo_site_id=; max-age=0; path=/'
  localStorage.clear()
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: detail }) } as Response)
})

test('opens a full evaluation workspace with amounts, product lines and related resources', async () => {
  setup()
  await screen.findByRole('heading', { name: 'Workplace proposal' })
  expect(fetch).toHaveBeenCalledWith('/api/procurement/commerce/quotes/quote-a?site_id=buyer-a', { cache: 'no-store' })
  expect(screen.getByText('$540.00')).toBeInTheDocument()
  expect(screen.getByText('Onboarding service')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Office tender' })).toHaveAttribute('href', '/purchases/tenders/tender-a')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Back to quotations' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open tender' })).toHaveAttribute('href', '/purchases/tenders/tender-a')
  expect(screen.queryByRole('tab', { name: 'Supplier' })).not.toBeInTheDocument()
  const panel = within(screen.getByRole('complementary'))
  expect(panel.getByText('Taylor Brooks')).toBeInTheDocument()
  expect(panel.getByText('taylor@example.test')).toBeInTheDocument()
  expect(panel.getByText('Net 30 after acceptance')).toBeInTheDocument()
  expect(panel.getByRole('link', { name: 'Technology supplier' })).toHaveAttribute('href', '/suppliers/supplier-a')
})

test('keeps unavailable supplier information distinct from empty contacts and terms', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: { ...detail, supplier: null } }) } as Response)
  setup()
  await screen.findByRole('heading', { name: 'Workplace proposal' })
  const sidebar = within(screen.getByRole('complementary'))
  expect(sidebar.getByText('Supplier details are unavailable in this workspace.')).toBeInTheDocument()
  expect(sidebar.queryByText('Taylor Brooks')).not.toBeInTheDocument()
  expect(sidebar.queryByRole('link', { name: 'Technology supplier' })).not.toBeInTheDocument()
  expect(sidebar.queryByRole('heading', { name: 'Commercial terms' })).not.toBeInTheDocument()
})

test('shows explicit empty states for authorized supplier contacts and terms', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: { ...detail, supplier: { ...detail.supplier, contacts: [], commercial_terms: '' } } }) } as Response)
  setup()
  await screen.findByRole('heading', { name: 'Workplace proposal' })
  const sidebar = within(screen.getByRole('complementary'))
  expect(sidebar.getByText('No contacts added.')).toBeInTheDocument()
  expect(sidebar.getByText('No commercial terms recorded.')).toBeInTheDocument()
})

test('never presents missing taxes as zero or a confirmed gross total', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: { ...detail, quotation: { ...detail.quotation, tax_amount_minor: null } } }) } as Response)
  setup()
  await screen.findByRole('heading', { name: 'Workplace proposal' })
  expect(screen.queryByText('$540.00')).not.toBeInTheDocument()
  expect(screen.getAllByText('Taxes pending').length).toBeGreaterThan(0)
})

test.each([403, 404, 503])('shows an explicit failure rather than demo or personal quote fallback (%s)', async status => {
  jest.mocked(fetch).mockResolvedValue({ ok: false, status, json: async () => ({ error: 'private backend detail' }) } as Response)
  setup()
  const alert = await screen.findByRole('alert')
  expect(alert).not.toHaveTextContent('private backend detail')
  expect(screen.queryByRole('heading', { name: 'Workplace proposal' })).not.toBeInTheDocument()
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
})

test('clears the previous quotation immediately on route or workspace changes and ignores late responses', async () => {
  let resolveOld!: (response: Response) => void
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('quote-old')
    ? new Promise<Response>(resolve => { resolveOld = resolve })
    : { ok: true, json: async () => ({ data: detail }) } as Response)
  const view = setup('buyer-old', 'quote-old')
  view.change('buyer-a', 'quote-a')
  await screen.findByRole('heading', { name: 'Workplace proposal' })
  await act(async () => resolveOld({ ok: true, json: async () => ({ data: { ...detail, quotation: { ...detail.quotation, id: 'quote-old', title: 'Stale quotation' } } }) } as Response))
  expect(screen.queryByText('Stale quotation')).not.toBeInTheDocument()
  jest.mocked(fetch).mockImplementation(() => new Promise(() => {}))
  view.change('buyer-b', 'quote-a')
  expect(screen.queryByText('Workplace proposal')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
})

test('demo detail shows supplier evidence and approvals without API calls or enabled mutations', async () => {
  setup('demo-saas-en-123', 'demo-quote-northstar')
  expect(screen.getByRole('heading', { name: 'Workplace technology proposal' })).toBeInTheDocument()
  expect(screen.getByText('Workstation onboarding service')).toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Supplier' })).not.toBeInTheDocument()
  const sidebar = within(screen.getByRole('complementary'))
  expect(sidebar.getByText('Taylor Brooks')).toBeInTheDocument()
  expect(sidebar.getByText('Casey Chen')).toBeInTheDocument()
  expect(sidebar.getByText('delivery@northstar.example')).toBeInTheDocument()
  expect(sidebar.getByRole('heading', { name: 'Commercial terms' })).toBeInTheDocument()
  tab('Certificates & proposal')
  expect(sidebar.getByText('Casey Chen')).toBeInTheDocument()
  expect(screen.queryByText('Demo evidence preview')).not.toBeInTheDocument()
  expect(screen.getAllByRole('article')).toHaveLength(3)
  tab('Approvals')
  expect(screen.getByRole('button', { name: 'Request whole-tender award' })).toBeDisabled()
  expect(await screen.findByText('Budget owner review')).toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})

test('awarded quotations keep the order approval workflow', async () => {
  setup('demo-saas-en-123', 'demo-quote-cedar')
  tab('Approvals')
  expect(screen.getByRole('button', { name: 'Request purchase order' })).toBeDisabled()
  expect(fetch).not.toHaveBeenCalled()
})

test('missing demo quotations do not render another supplier or contact a real API', () => {
  setup('demo-saas-en-123', 'missing')
  expect(screen.getByRole('alert')).toBeInTheDocument()
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})