import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RequestDetail } from '@/app/purchases/requests/request-detail'
import { TenderDetail } from '@/app/purchases/tenders/tender-detail'
import { TenderEditor } from '@/app/purchases/tenders/tender-editor'
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'

let mockSite = { id: 'buyer-a', name: 'Workspace A' }
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: mockSite }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
const fetchMock = jest.mocked(fetch)
const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response
const calls = (path: string) => fetchMock.mock.calls.filter(([url]) => String(url).includes(path))
function pending() {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>(done => { resolve = done })
  return { promise, resolve }
}
const request = { request: { id: 'r1', title: 'Office request', description: 'Needed by the workshop', revision: 2, requester_id: 'actor',
  status: 'draft', currency: 'USD', net_amount_minor: 0, resolved_plan: null }, actor_id: 'actor', can_manage: true, stages: [], audit: [],
  items: [{ id: 'item-1', catalog_item_id: 'sku-1', revision: 2, description: 'Stock item', quantity: 1, unit_net_minor: 0, tax_snapshot: [] }] }
const tender = { id: 't1', title: 'Tender A', description: 'Closed bid', status: 'draft', version: 2, visibility: 'private',
  participation: 'invitation_only', opening_policy: 'after_close', currency: 'USD', net_amount_minor: 0, requirements: [],
  participation_deadline: '2090-01-01T00:00:00Z', opening_at: '2090-01-02T00:00:00Z' }
const detail = { tender, publications: [], participants: [], site_slug: 'workspace', portal_enabled: false, publication_pending: false }
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => '11111111-1111-4111-8111-111111111111' })
})
beforeEach(() => { fetchMock.mockReset(); mockSite = { id: 'buyer-a', name: 'Workspace A' } })

test('service lines share one tax read only when needed and never inherit a closed or previous workspace’s taxes', async () => {
  const late = pending(), other = pending()
  fetchMock.mockImplementation(async url => String(url).includes('/references?') ? response({ options: [{ id: 'sku-1', label: 'Selected SKU' }] })
    : !String(url).includes('/taxes?') ? response(request)
    : String(url).includes('buyer-b') ? response({ taxes: [{ id: 'b', name: 'Current tax', rate: 20 }] })
    : calls('/taxes?').length === 1 ? late.promise : other.promise)
  const view = render(<RequestDetail id="r1" />)
  const edit = () => fireEvent.click(screen.getByRole('button', { name: 'Edit request' }))
  const addService = () => fireEvent.click(screen.getByRole('button', { name: 'Add line' }))
  await screen.findByText('Needed by the workshop')
  expect(fetch).toHaveBeenCalledTimes(1)
  edit()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(calls('/taxes?')).toHaveLength(0)
  addService(); addService()
  expect(calls('/taxes?')).toHaveLength(1)
  const signal = calls('/taxes?')[0][1]!.signal!
  fireEvent.click(screen.getByRole('button', { name: 'Cancel edit' }))
  expect(signal.aborted).toBe(true)
  edit(); addService()
  expect(calls('/taxes?')).toHaveLength(2)
  await act(async () => late.resolve(response({ taxes: [{ id: 'late', name: 'Closed tax', rate: 5 }] })))
  expect(screen.queryByLabelText('Closed tax (5%)')).not.toBeInTheDocument()
  const otherSignal = calls('/taxes?')[1][1]!.signal!
  mockSite = { id: 'buyer-b', name: 'Workspace B' }
  view.rerender(<RequestDetail id="r1" />)
  expect(otherSignal.aborted).toBe(true)
  await screen.findByText('Needed by the workshop')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  edit(); addService(); addService()
  expect(await screen.findAllByLabelText('Current tax (20%)')).toHaveLength(2)
  await screen.findByRole('button', { name: /Remove Selected SKU/ })
  await act(async () => other.resolve(response({ taxes: [{ id: 'a', name: 'Foreign tax', rate: 10 }] })))
  expect(screen.queryByLabelText('Foreign tax (10%)')).not.toBeInTheDocument()
  expect(calls('/taxes?')).toHaveLength(3)
  expect(calls('/references?').filter(([url]) => String(url).includes('buyer-b'))).toHaveLength(1)
})

test('invitation choices load only on an editable Suppliers tab; leaving aborts and removes the selection', async () => {
  const first = pending()
  fetchMock.mockImplementation(async url => String(url).includes('/suppliers?') ? calls('/suppliers?').length === 1 ? first.promise
    : response({ suppliers: [{ id: 's2', name: 'Current supplier' }] }) : response(detail))
  const view = render(<TenderDetail id="t1" />)
  await screen.findByRole('heading', { level: 2, name: 'Tender A' })
  expect(fetch).toHaveBeenCalledTimes(1)
  const tab = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0, ctrlKey: false })
  tab('Suppliers')
  expect(screen.getByRole('button', { name: 'Register invitation' })).toBeDisabled()
  const signal = calls('/suppliers?')[0][1]!.signal!
  tab('Activity')
  expect(signal.aborted).toBe(true)
  tab('Suppliers')
  await waitFor(() => expect(screen.getByLabelText('Approved supplier')).toBeEnabled())
  fireEvent.click(screen.getByLabelText('Approved supplier'))
  await act(async () => first.resolve(response({ suppliers: [{ id: 'old', name: 'Stale supplier' }] })))
  expect(screen.queryByText('Stale supplier')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Current supplier'))
  expect(screen.getByRole('button', { name: 'Register invitation' })).toBeEnabled()

  fetchMock.mockResolvedValue(response({ ...detail, tender: { ...tender, title: 'Closed tender', status: 'closed' } }))
  view.rerender(<TenderDetail id="closed" />)
  await screen.findByRole('heading', { level: 2, name: 'Closed tender' })
  tab('Suppliers')
  expect(screen.queryByLabelText('Approved supplier')).not.toBeInTheDocument()
  expect(calls('/suppliers?')).toHaveLength(2)
  expect(fetchMock.mock.calls.every(([, init]) => !init?.method)).toBe(true)
})

test('a denied edit route never starts an approved-request picker read', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) } as Response)
  render(<><TopBarPrimaryActionsSlot /><TenderEditor id="denied" /></>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden')
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/procurement/tenders/denied?site_id=buyer-a'])
})