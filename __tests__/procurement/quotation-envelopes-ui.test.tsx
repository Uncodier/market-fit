import { fireEvent, render, screen } from '@testing-library/react'
import { ProcurementQuotesPanel } from '@/app/purchases/procurement/commerce/ProcurementQuotesPanel'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: null }) }))

const envelope = { tender_id: 'tender-a', publication_id: 'publication-a', tender_title: 'Equipment sourcing',
  opening_at: '2090-01-02T12:00:00Z', received_count: 3 }
const quote = { id: 'quote-a', supplier_name: 'Opened supplier', reference: 'Opened quote', tender_id: 'tender-a',
  tender_title: 'Equipment sourcing', recorded_at: '2026-10-29T12:00:00Z', currency: 'USD', net_amount_minor: 200,
  tax_amount_minor: 0, source: 'buyer_recorded', award_id: null, lines: [] }
function mockResponse(envelopes = [envelope], data: unknown[] = []) {
  jest.mocked(fetch).mockImplementation(async url => ({ ok: true, json: async () => String(url).includes('/quotes?')
    ? { data, envelopes } : { data: [] } }) as Response)
}
beforeEach(() => { jest.clearAllMocks(); mockResponse() })

test.each([false, true])('shows the envelope and count without a false empty state (embedded=%s)', async embedded => {
  render(<ProcurementQuotesPanel siteId="buyer-a" tenderId={embedded ? 'tender-a' : undefined} embedded={embedded} />)
  expect(await screen.findByText('Sealed quotations received: 3')).toBeInTheDocument()
  expect(screen.getByText(/Supplier identities, prices and attachments remain hidden/)).toBeInTheDocument()
  expect(screen.getByText(/Opening:/)).toBeInTheDocument()
  expect(screen.getByText('Sealed')).toBeInTheDocument()
  expect(screen.getByText('3')).toHaveClass('tabular-nums')
  expect(screen.getByText(/Opening:/).closest('time')).toHaveAttribute('dateTime', envelope.opening_at)
  expect(screen.queryByText('No procurement quotations recorded.')).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Equipment sourcing' })).toHaveAttribute('href', '/purchases/tenders/tender-a')
  expect(fetch).toHaveBeenCalledWith('/api/procurement/commerce/quotes?site_id=buyer-a', expect.objectContaining({ cache: 'no-store' }))
})
test('does not let review filters or search hide the received count', async () => {
  render(<ProcurementQuotesPanel siteId="buyer-a" />)
  await screen.findByText('Sealed quotations received: 3')
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Accepted' }), { button: 0, ctrlKey: false })
  fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'No matching supplier' } })
  expect(screen.getByText('Sealed quotations received: 3')).toBeInTheDocument()
  expect(screen.queryByText('No procurement quotations recorded.')).not.toBeInTheDocument()
})
test('scopes receipts by tender and resets them when the workspace changes', async () => {
  const view = render(<ProcurementQuotesPanel siteId="buyer-a" tenderId="tender-b" embedded />)
  await screen.findByText('No procurement quotations recorded.')
  expect(screen.queryByText('Sealed quotations received: 3')).not.toBeInTheDocument()
  view.rerender(<ProcurementQuotesPanel siteId="buyer-a" tenderId="tender-a" embedded />)
  await screen.findByText('Sealed quotations received: 3')
  mockResponse([])
  view.rerender(<ProcurementQuotesPanel siteId="buyer-b" tenderId="tender-a" embedded />)
  await screen.findByText('No procurement quotations recorded.')
  expect(screen.queryByText('Sealed quotations received: 3')).not.toBeInTheDocument()
})
test('shows opened quotations alongside sealed envelopes, then replaces envelopes on reload after opening', async () => {
  mockResponse([envelope], [quote])
  const view = render(<ProcurementQuotesPanel key="before" siteId="buyer-a" embedded />)
  await screen.findByText('Sealed quotations received: 3')
  expect(screen.getByText('Opened supplier')).toBeInTheDocument()
  mockResponse([], [quote])
  view.rerender(<ProcurementQuotesPanel key="after" siteId="buyer-a" embedded />)
  await screen.findByText('Opened supplier')
  expect(screen.queryByText('Sealed quotations received: 3')).not.toBeInTheDocument()
})
test('shows retrieval failures instead of an empty successful receipt list', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ error: 'Procurement access denied' }) } as Response)
  render(<ProcurementQuotesPanel siteId="buyer-a" embedded />)
  await screen.findByRole('alert')
  expect(screen.queryByText('No procurement quotations recorded.')).not.toBeInTheDocument()
  expect(screen.queryByText('Sealed quotations received: 3')).not.toBeInTheDocument()
})