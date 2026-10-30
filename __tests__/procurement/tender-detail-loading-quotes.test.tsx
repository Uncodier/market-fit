import { act, fireEvent, render, screen } from '@testing-library/react'
import { TenderDetail } from '@/app/purchases/tenders/tender-detail'
import Loading from '@/app/purchases/tenders/[id]/loading'

jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: mockSite }) }))
jest.mock('@/app/purchases/procurement/commerce/ProcurementQuotesPanel', () => ({
  ProcurementQuotesPanel: ({ siteId, tenderId, embedded }: { siteId: string; tenderId: string; embedded: boolean }) =>
    <div data-testid="received-quotes" data-site-id={siteId} data-tender-id={tenderId} data-embedded={String(embedded)} />,
}))

const siteId = '00000000-0000-4000-8000-000000000001'
const tenderId = '00000000-0000-4000-8000-000000000002'
let mockSite: { id: string; name: string } | null = null

const detail = {
  tender: {
    id: tenderId, title: 'Equipment sourcing', description: 'Chairs for the workspace', status: 'draft', version: 2,
    visibility: 'private', global_visible: false, participation: 'invitation_only', opening_policy: 'after_close',
    currency: 'USD', net_amount_minor: 5000, requirements: [],
    participation_deadline: '2090-01-01T00:00:00Z', opening_at: '2090-01-02T00:00:00Z',
  },
  publications: [], participants: [], site_slug: 'test-workspace', portal_enabled: false, publication_pending: false,
}

function response(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response
}

function expectDetailSkeleton(container: HTMLElement) {
  const status = screen.getByRole('status', { name: 'Loading content' })
  expect(status).toHaveAttribute('aria-busy', 'true')
  expect(container.querySelectorAll('[data-toolbar-font]')).toHaveLength(1)
  expect(status.querySelector('header .h-11.w-11')).toBeInTheDocument()
  expect(status.querySelector('main')).toHaveClass('lg:flex-1')
  expect(status.querySelector('aside')).toHaveClass('lg:w-[340px]', 'xl:w-[380px]', 'lg:border-l')
  expect(status.querySelector('main')?.closest('[aria-hidden="true"]')).toBeInTheDocument()
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  expect(screen.queryByTestId('received-quotes')).not.toBeInTheDocument()
}

beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } })
beforeEach(() => {
  jest.clearAllMocks()
  mockSite = { id: siteId, name: 'Test workspace' }
})

test('route navigation renders the dedicated detail skeleton with one toolbar', () => {
  const { container } = render(<Loading />)
  expectDetailSkeleton(container)
  expect(fetch).not.toHaveBeenCalled()
})

test('site hydration and initial tender retrieval share the exact same skeleton', async () => {
  mockSite = null
  let resolveTender!: (value: Response) => void
  const pendingTender = new Promise<Response>(resolve => { resolveTender = resolve })
  jest.mocked(fetch).mockImplementation(url => String(url).includes('/suppliers?')
    ? Promise.resolve(response({ suppliers: [] })) : pendingTender)
  const { container, rerender } = render(<TenderDetail id={tenderId} />)
  expectDetailSkeleton(container)
  const hydrationMarkup = container.innerHTML
  expect(fetch).not.toHaveBeenCalled()

  mockSite = { id: siteId, name: 'Test workspace' }
  rerender(<TenderDetail id={tenderId} />)
  expectDetailSkeleton(container)
  expect(container.innerHTML).toBe(hydrationMarkup)
  expect(fetch).toHaveBeenCalledWith(`/api/procurement/tenders/${tenderId}?site_id=${siteId}`, expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }))

  await act(async () => { resolveTender(response(detail)) })
  expect(await screen.findByRole('heading', { name: detail.tender.title, level: 2 })).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: 'Loading content' })).not.toBeInTheDocument()
  expect(container.querySelectorAll('[data-toolbar-font]')).toHaveLength(1)
})

test('received quotations are a scoped embedded tab, not a bottom purchases link', async () => {
  jest.mocked(fetch).mockImplementation(async url => response(String(url).includes('/suppliers?') ? { suppliers: [] } : detail))
  const { container } = render(<TenderDetail id={tenderId} />)
  await screen.findByRole('heading', { name: detail.tender.title, level: 2 })
  expect(screen.queryByTestId('received-quotes')).not.toBeInTheDocument()
  expect(container.querySelector('a[href="/purchases/quotes"]')).not.toBeInTheDocument()
  const quotesTab = screen.getByRole('tab', { name: 'Received quotations' })
  fireEvent.mouseDown(quotesTab, { button: 0, ctrlKey: false })
  expect(quotesTab).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByTestId('received-quotes')).toHaveAttribute('data-site-id', siteId)
  expect(screen.getByTestId('received-quotes')).toHaveAttribute('data-tender-id', tenderId)
  expect(screen.getByTestId('received-quotes')).toHaveAttribute('data-embedded', 'true')
  expect(container.querySelectorAll('[data-toolbar-font]')).toHaveLength(1)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Activity' }), { button: 0, ctrlKey: false })
  expect(screen.queryByTestId('received-quotes')).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'All tenders' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Edit working version' })).toHaveAttribute('href', `/purchases/tenders/${tenderId}/edit`)
})

test('initial retrieval failures remain errors and retry returns to the single detail skeleton', async () => {
  jest.mocked(fetch).mockImplementation(async url => response(String(url).includes('/suppliers?') ? { suppliers: [] } : { error: 'Tender access denied' }, String(url).includes('/suppliers?')))
  const { container } = render(<TenderDetail id={tenderId} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Tender access denied')
  expect(screen.queryByRole('status', { name: 'Loading content' })).not.toBeInTheDocument()
  jest.mocked(fetch).mockImplementation(() => new Promise<Response>(() => {}))
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expectDetailSkeleton(container)
})

test('detail has no manual refresh action and tab navigation retains the loaded content', async () => {
  jest.mocked(fetch).mockImplementation(async url => response(String(url).includes('/suppliers?') ? { suppliers: [] } : detail))
  render(<TenderDetail id={tenderId} />)
  await screen.findByRole('heading', { name: detail.tender.title, level: 2 })
  const previousCalls = jest.mocked(fetch).mock.calls.length
  expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Received quotations' }), { button: 0, ctrlKey: false })
  expect(jest.mocked(fetch).mock.calls).toHaveLength(previousCalls)
  expect(screen.getByTestId('received-quotes')).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: 'Loading content' })).not.toBeInTheDocument()
})