import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } })
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { TenderEditor } from '@/app/purchases/tenders/tender-editor'
import { TenderList } from '@/app/purchases/tenders/tender-list'
import { TenderDetail } from '@/app/purchases/tenders/tender-detail'
const site = '00000000-0000-4000-8000-000000000001'
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: site } }) }))

beforeEach(() => {
  render(<TopBarPrimaryActionsSlot />)

  jest.clearAllMocks()
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => '00000000-0000-4000-8000-000000000002' })
})
test('creates a working tender without a client publisher or published state', async () => {
  jest.mocked(fetch).mockImplementation(async (_url, init) => ({ ok: true, json: async () => init?.method === 'POST' ? { id: site } : { requests: [] } }) as Response)
  render(<TenderEditor />)
  expect(screen.getByRole('dialog', { name: 'Create tender' })).toBeInTheDocument()
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save working version' })).toBeInTheDocument()
  expect(document.getElementById('page-primary-actions')).toBeEmptyDOMElement()
  expect(screen.getByRole('combobox', { name: 'Visibility' })).toBeInTheDocument()
  expect(screen.getByLabelText('Participation closes (local time)')).not.toHaveAttribute('type', 'datetime-local')
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Equipment sourcing' } })
  fireEvent.change(screen.getByLabelText('Description / specification'), { target: { value: 'Chairs' } })
  fireEvent.change(screen.getByLabelText('Unit net estimate (minor units)'), { target: { value: '5000' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save working version' }))
  await waitFor(() => expect(jest.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true))
  const call = jest.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST')!
  const body = JSON.parse(String(call[1]?.body))
  expect(body).toMatchObject({ expected_version: 0, document: { title: 'Equipment sourcing', visibility: 'private', global_visible: false, participation: 'invitation_only', opening_policy: 'after_close', requirements: [{ unit_net_minor: 5000 }] } })
  expect(body.document).not.toHaveProperty('status'); expect(body.document).not.toHaveProperty('created_by')
})
test('tender board groups actual records without drag or mutation side effects', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ tenders: [{ id: site, title: 'Equipment sourcing', status: 'draft', version: 2, currency: 'USD', net_amount_minor: 5000, participation_deadline: '2090-01-01T00:00:00Z' }], count: 1 }) } as Response)
  render(<TenderList />)
  expect(await screen.findByRole('link', { name: 'Equipment sourcing' })).toHaveAttribute('href', `/purchases/tenders/${site}`)
  expect(within(document.getElementById('page-primary-actions')!).getByRole('link', { name: 'Create tender' })).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Create tender' })).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'Public directory' }).compareDocumentPosition(screen.getByRole('radio', { name: 'Toggle kanban view' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.click(screen.getByRole('radio', { name: 'Toggle kanban view' }))
  expect(screen.getByText(/Read-only board/)).toBeInTheDocument()
  expect(jest.mocked(fetch).mock.calls.some(([, init]) => init?.method)).toBe(false)
})
test('API failure is rendered as an error rather than a fabricated empty list', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ error: 'Tender access denied' }) } as Response)
  render(<TenderList />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Tender access denied')
  expect(screen.queryByText('No tenders match this view.')).not.toBeInTheDocument()
})
test('pending publication shows an honest pending state, not published terms', async () => {
  const tender = { id: site, title: 'Draft tender', status: 'draft', version: 1, visibility: 'private', global_visible: false,
    currency: 'USD', net_amount_minor: 0, requirements: [], participation_deadline: '2090-01-01T00:00:00Z', opening_at: '2090-01-02T00:00:00Z' }
  jest.mocked(fetch).mockImplementation(async (url, init) => ({ ok: true, json: async () => init?.method === 'POST' ? { status: 'pending' } : String(url).includes('/suppliers?') ? { suppliers: [] } : { tender, publications: [], participants: [], site_slug: site, portal_enabled: false } }) as Response)
  render(<TenderDetail id={site} />)
  fireEvent.click(await within(document.getElementById('page-primary-actions')!).findByRole('button', { name: 'Request publication' }))
  expect(await screen.findByText('Publication approval is pending. No new terms have been published.')).toBeInTheDocument()
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Activity' }), { button: 0, ctrlKey: false })
  expect(screen.getByText('Not published. No public access is available.')).toBeInTheDocument()
})