import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { listBuyerQuotes } from '@/app/buyer/actions'
import { useRouter } from 'next/navigation'
import { ProcurementQuotesPanel } from '@/app/purchases/procurement/commerce/ProcurementQuotesPanel'
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'

jest.mock('@/app/buyer/actions', () => ({ listBuyerQuotes: jest.fn() }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: null }) }))

const quote = { id: 'procurement-a', supplier_name: 'Chair supplier', reference: 'CHAIR-001', tender_id: 'tender-a', tender_title: 'Office chairs',
  source: 'supplier_submitted', award_id: null, net_amount_minor: 1234, tax_amount_minor: 100, currency: 'USD', recorded_at: '2026-10-29T00:00:00Z', lines: [] }
const merchant = { id: 'merchant-a', site: { name: 'Online supplier' }, status: 'sent', total: 50, currency: 'USD', created_at: '2026-10-28T00:00:00Z' }
const push = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
  jest.mocked(fetch).mockImplementation(async url => ({ ok: true, json: async () => ({ data: String(url).includes('/quotes?') ? [quote] : [] }) }) as Response)
  jest.mocked(listBuyerQuotes).mockResolvedValue({ data: [merchant], count: 1 })
})

test('shows only site quotations and never mixes in the signed-in buyer personal quotations', async () => {
  render(<><TopBarPrimaryActionsSlot /><ProcurementQuotesPanel siteId="buyer-a" /></>)
  await screen.findByText('Chair supplier')
  expect(screen.queryByText('Online supplier')).not.toBeInTheDocument()
  expect(listBuyerQuotes).not.toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledWith('/api/procurement/commerce/quotes?site_id=buyer-a', expect.any(Object))
  expect(screen.getAllByRole('table')).toHaveLength(1)
  expect(screen.getAllByText('$13.34')).toHaveLength(2)
  const chip = screen.getByRole('link', { name: 'View tender' })
  expect(chip).toHaveAttribute('href', '/purchases/tenders/tender-a')
  fireEvent.click(chip)
  expect(push).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Chair supplier'))
  expect(push).toHaveBeenCalledWith('/purchases/quotes/procurement-a')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test.each([true, false])('tender-scoped quotations omit the redundant tender chip (embedded: %s)', async embedded => {
  render(<ProcurementQuotesPanel siteId="buyer-a" tenderId="tender-a" embedded={embedded} />)
  await screen.findByText('Chair supplier')
  const table = within(screen.getByRole('table'))
  expect(table.queryByRole('link', { name: 'View tender' })).not.toBeInTheDocument()
  expect(table.queryByText('Office chairs')).not.toBeInTheDocument()
  expect(table.getByText('CHAIR-001')).toBeInTheDocument()
  expect(table.getByText('Supplier submitted')).toBeInTheDocument()
  expect(table.getAllByText('$13.34')).toHaveLength(2)
  fireEvent.click(table.getByText('Chair supplier'))
  expect(push).toHaveBeenCalledWith('/purchases/quotes/procurement-a')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('embedded view excludes other tenders and never loads merchant quotations', async () => {
  render(<ProcurementQuotesPanel siteId="buyer-a" tenderId="other-tender" embedded />)
  await screen.findByText('No procurement quotations recorded.')
  expect(screen.queryByText('Chair supplier')).not.toBeInTheDocument()
  expect(listBuyerQuotes).not.toHaveBeenCalled()
})

test('searches only the active site quotations', async () => {
  render(<ProcurementQuotesPanel siteId="buyer-a" />)
  await screen.findByText('Chair supplier')
  fireEvent.change(screen.getAllByPlaceholderText('Search documents…')[0], { target: { value: 'Online supplier' } })
  await waitFor(() => expect(screen.queryByText('Chair supplier')).not.toBeInTheDocument())
  expect(screen.queryByText('Online supplier')).not.toBeInTheDocument()
  fireEvent.change(screen.getAllByPlaceholderText('Search documents…')[0], { target: { value: 'CHAIR-001' } })
  expect(screen.getByText('Chair supplier')).toBeInTheDocument()
})

test('a site access error stays an error without falling back to personal quotations', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ error: 'Forbidden' }) } as Response)
  render(<ProcurementQuotesPanel siteId="buyer-a" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(listBuyerQuotes).not.toHaveBeenCalled()
})

test('switching sites clears the previous site rows and ignores its late response', async () => {
  let resolvePrevious: (response: Response) => void = () => { throw new Error('Previous request was not started') }
  jest.mocked(fetch).mockImplementation(async url => {
    if (String(url).includes('/quotes?site_id=buyer-a')) {
      return new Promise<Response>(resolve => { resolvePrevious = resolve })
    }
    return { ok: true, json: async () => ({ data: String(url).includes('/quotes?')
      ? [{ ...quote, id: 'quote-b', supplier_name: 'Pigs supplier' }] : [] }) } as Response
  })
  const { rerender } = render(<ProcurementQuotesPanel siteId="buyer-a" />)
  rerender(<ProcurementQuotesPanel siteId="pigs" />)
  await screen.findByText('Pigs supplier')
  await act(async () => {
    resolvePrevious({ ok: true, json: async () => ({ data: [quote] }) } as Response)
  })
  await waitFor(() => expect(screen.queryByText('Chair supplier')).not.toBeInTheDocument())
  expect(screen.getByText('Pigs supplier')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/api/procurement/commerce/quotes?site_id=pigs', expect.any(Object))
  rerender(<ProcurementQuotesPanel siteId="buyer-c" />)
  expect(screen.queryByText('Pigs supplier')).not.toBeInTheDocument()
  await screen.findByText('Pigs supplier')
  expect(listBuyerQuotes).not.toHaveBeenCalled()
})

test('workspace toolbar is full-width outside the padded scrolling content and has no refresh button', async () => {
  const { container } = render(<ProcurementQuotesPanel siteId="buyer-a" />)
  await screen.findByText('Chair supplier')
  const section = screen.getByRole('region', { name: 'Received quotations' })
  const toolbar = container.querySelector('[data-toolbar-font]')
  expect(toolbar?.parentElement).toBe(section)
  expect(section).not.toHaveClass('p-4', 'space-y-4')
  const tableBody = Array.from(section.children).find(child => child.classList.contains('overflow-auto'))
  expect(tableBody?.parentElement).toBe(section)
  expect(tableBody).toContainElement(screen.getByRole('table'))
  expect(tableBody).not.toContainElement(toolbar as HTMLElement)
  expect(toolbar?.querySelector('.overflow-x-auto')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
})

test('embedded quotations align add at the right edge and status filters inside the table without search', async () => {
  const { container } = render(<ProcurementQuotesPanel siteId="buyer-a" tenderId="tender-a" embedded />)
  await screen.findByText('Chair supplier')
  expect(container.querySelector('[data-toolbar-font]')).toBeNull()
  const heading = screen.getByRole('heading', { name: 'Received quotations' })
  expect(within(heading.parentElement!).getByRole('button', { name: 'Record external quotation' })).toBeEnabled()
  expect(heading.parentElement).toHaveClass('w-full', 'flex')
  expect(screen.getByRole('button', { name: 'Record external quotation' }).parentElement).toHaveClass('ml-auto', 'shrink-0')
  expect(screen.queryByPlaceholderText('Search documents…')).not.toBeInTheDocument()
  expect(screen.getByRole('table').parentElement?.parentElement).toContainElement(screen.getByRole('tab', { name: 'Pending review' }))
  expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Accepted' }), { button: 0, ctrlKey: false })
  expect(screen.queryByText('Chair supplier')).not.toBeInTheDocument()
  expect(screen.getByRole('table')).toBeInTheDocument()
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'All' }), { button: 0, ctrlKey: false })
  expect(screen.getByText('Chair supplier')).toBeInTheDocument()
  fireEvent.click(within(heading.parentElement!).getByRole('button', { name: 'Record external quotation' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

test('embedded empty quotations keep all table columns visible and filters remain interactive', async () => {
  render(<ProcurementQuotesPanel siteId="buyer-a" tenderId="other-tender" embedded />)
  await screen.findByText('No procurement quotations recorded.')
  const table = screen.getByRole('table')
  expect(within(table).getAllByRole('columnheader')).toHaveLength(5)
  expect(within(table).getByRole('columnheader', { name: 'Supplier' })).toBeInTheDocument()
  expect(within(table).getByRole('cell', { name: 'No procurement quotations recorded.' })).toHaveAttribute('colspan', '5')
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Accepted' }), { button: 0, ctrlKey: false })
  expect(screen.getByRole('tab', { name: 'Accepted' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('table')).toBeInTheDocument()
})

test('embedded sealed quotations keep the table structure without disclosing supplier rows', async () => {
  jest.mocked(fetch).mockImplementation(async url => ({ ok: true, json: async () => ({ data: [],
    envelopes: String(url).includes('/quotes?') ? [{ tender_id: 'tender-a', publication_id: 'publication-a',
      tender_title: 'Office chairs', opening_at: '2090-01-01T00:00:00Z', received_count: 2 }] : [] }) }) as Response)
  render(<ProcurementQuotesPanel siteId="buyer-a" tenderId="tender-a" embedded />)
  await screen.findByRole('region', { name: 'Sealed quotations' })
  expect(within(screen.getByRole('table')).getAllByRole('columnheader')).toHaveLength(5)
  expect(screen.queryByText('Chair supplier')).not.toBeInTheDocument()
})