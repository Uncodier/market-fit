jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: null }) }))
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ProcurementQuotesPanel } from '@/app/purchases/procurement/commerce/ProcurementQuotesPanel'
import { ProcurementOrdersPanel } from '@/app/purchases/procurement/commerce/ProcurementOrdersPanel'
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'

beforeEach(() => {
  jest.clearAllMocks()
  render(<TopBarPrimaryActionsSlot />)
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => '00000000-0000-4000-8000-000000000099' })
})
it('loads actual quote/options API data and states empty scope without fabricated suppliers', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [] }) } as Response)
  render(<ProcurementQuotesPanel siteId="buyer-a" />)
  await screen.findByText('No procurement quotations recorded.')
  expect(fetch).toHaveBeenCalledWith('/api/procurement/commerce/quotes?site_id=buyer-a', expect.any(Object))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Record external quotation' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByText('No eligible open tender is available.')).toBeInTheDocument()
})
it('shows access failure rather than a misleading empty successful order list', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ error: 'Forbidden' }) } as Response)
  render(<ProcurementOrdersPanel siteId="buyer-a" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden')
})
it('does not carry a prior buyer workspace quotation into a new workspace', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [] }) } as Response)
  const view = render(<ProcurementQuotesPanel siteId="buyer-a" />)
  await screen.findByText('No procurement quotations recorded.')
  view.rerender(<ProcurementQuotesPanel siteId="buyer-b" />)
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/procurement/commerce/quotes?site_id=buyer-b', expect.any(Object)))
})

it('uses document rows and retains an identical failed receipt across dialog dismissal', async () => {
  const order = { id: 'order-a', supplier_name: 'Approved supplier', currency: 'USD', net_amount_minor: 500,
    created_at: '2026-10-01T00:00:00Z', lines: [{ id: 'line-a', name: 'Service', quantity: 2, received_quantity: 0 }] }
  jest.mocked(fetch).mockImplementation(async (_url, options) => ({
    ok: options?.method !== 'POST', json: async () => options?.method === 'POST' ? { error: 'Retry safely' } : { data: [order] },
  }) as Response)
  render(<ProcurementOrdersPanel siteId="buyer-a" />)
  fireEvent.click(await screen.findByRole('button', { name: 'Items and acceptance' }))
  fireEvent.change(screen.getByLabelText(/Service —/), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Acceptance note'), { target: { value: 'Checked in person' } })
  fireEvent.click(screen.getByRole('button', { name: 'Record non-stock acceptance' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Retry safely')
  expect(screen.getByLabelText('Acceptance note')).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Close and keep draft' }))
  fireEvent.click(screen.getByRole('button', { name: 'Items and acceptance' }))
  expect(screen.getByLabelText('Acceptance note')).toHaveValue('Checked in person')
  fireEvent.click(screen.getByRole('button', { name: 'Retry identical receipt' }))
  await waitFor(() => expect(jest.mocked(fetch).mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2))
  const posts = jest.mocked(fetch).mock.calls.filter(([, options]) => options?.method === 'POST')
  expect(posts[0][1]?.body).toBe(posts[1][1]?.body)
})