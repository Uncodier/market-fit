import { act, fireEvent, render, screen } from '@testing-library/react'
import { usePathname, useSearchParams } from 'next/navigation'
import DashboardPage from '@/app/dashboard/page'
import CostsPage from '@/app/costs/page'

const mockFirstSite = '11111111-1111-4111-8111-111111111111'
let mockSite = mockFirstSite
let mockActor: string | null = 'actor-a'
let mockLoading = false
let mockScope: 'matching' | 'missing' | 'wrong-actor' | 'wrong-site' = 'matching'
let mockFlags: { _isMock?: boolean; _isDemo?: boolean } = {}
const mockReads = jest.fn()
const mockDateLimits = jest.fn()

jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: mockSite }, isLoading: mockLoading,
  requestScope: mockScope === 'missing' ? null : {
    actorId: mockScope === 'wrong-actor' ? 'other-actor' : mockActor, siteId: mockScope === 'wrong-site' ? 'other-site' : mockSite,
  },
}) }))
jest.mock('@/app/hooks/use-auth', () => ({ useAuth: () => ({ user: mockActor ? { id: mockActor } : null, isLoading: false }) }))
jest.mock('@/app/hooks/use-prevent-refresh', () => ({ usePageRefreshPrevention: () => ({ shouldPreventRefresh: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '', locale: 'en' }) }))
jest.mock('@/app/components/ui/sticky-header', () => ({ StickyHeader: ({ children }: React.PropsWithChildren) => children }))
jest.mock('@/app/components/ui/date-range-picker', () => ({ CalendarDateRangePicker: () => <button>Date range</button> }))
jest.mock('@/app/dashboard/ReportContent', () => ({ ReportContent: ({ segmentId, segmentName }: { segmentId: string; segmentName: string }) =>
  <output data-testid="report">{segmentId}:{segmentName}</output> }))
jest.mock('@/app/components/dashboard/cost-reports', () => ({ CostReports: ({ campaignId, segmentId }: { campaignId: string; segmentId: string }) =>
  <output data-testid="report">{campaignId}:{segmentId}</output> }))
jest.mock('@/app/dashboard/use-report-date-limits', () => ({ useReportDateLimits: (...args: unknown[]) => {
  mockDateLimits(...args)
  return { maxRangeDays: 93, signedOut: !mockActor }
} }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ ...mockFlags, from: (table: string) => ({
  select: (fields: string) => ({ eq: (column: string, site: string) => ({
    order: () => mockReads(table, fields, column, site),
  }) }),
}) }) }))

function route(path: string, params = '') {
  jest.mocked(usePathname).mockReturnValue(path)
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(params) as ReturnType<typeof useSearchParams>)
}
function open(label: string) {
  fireEvent.keyDown(screen.getByRole('combobox', { name: label }), { key: 'ArrowDown' })
}

beforeAll(() => { Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: jest.fn() }) })
afterAll(() => { Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView') })
beforeEach(() => {
  localStorage.clear()
  mockSite = mockFirstSite; mockActor = 'actor-a'; mockLoading = false
  mockScope = 'matching'; mockFlags = {}
  mockDateLimits.mockClear()
  mockReads.mockReset().mockImplementation(async (table: string) => ({ error: null, data: table === 'segments'
    ? [{ id: 's1', name: 'New customers' }] : [{ id: 'c1', title: 'Summer campaign' }] }))
})

it('opens the all-segment Dashboard with its date policy and report but no segment lookup', async () => {
  route('/dashboard', 'tab=sales')
  render(<DashboardPage />)
  expect(await screen.findByTestId('report')).toHaveTextContent('all:All segments')
  expect(mockDateLimits).toHaveBeenCalledWith(mockSite, 'sales', 'summary')
  expect(mockReads.mock.calls.map(([table]) => table)).toEqual([])
  open('Segment')
  const segment = await screen.findByRole('option', { name: 'New customers' })
  expect(mockReads.mock.calls).toEqual([['segments', 'id, name', 'site_id', mockSite]])
  fireEvent.keyDown(segment, { key: 'Enter' })
  expect(screen.getByTestId('report')).toHaveTextContent('s1:New customers')
  expect(screen.getByRole('combobox', { name: 'Segment' })).toHaveTextContent('New customers')
})

it('opens Costs without either options list; choosing a campaign does not read segments', async () => {
  route('/costs')
  render(<CostsPage />)
  expect(await screen.findByTestId('report')).toHaveTextContent('all:all')
  expect(mockReads.mock.calls.map(([table]) => table)).toEqual([])
  open('Campaign')
  fireEvent.keyDown(await screen.findByRole('option', { name: 'Summer campaign' }), { key: 'Enter' })
  expect(screen.getByTestId('report')).toHaveTextContent('c1:all')
  expect(mockReads.mock.calls).toEqual([['campaigns', 'id, title', 'site_id', mockSite]])
})

it('keeps an explicit cost deep link scoped and loads the selected label without opening its picker', async () => {
  route('/costs', 'segmentId=s1')
  const view = render(<CostsPage />)
  expect(screen.getByTestId('report')).toHaveTextContent('all:s1')
  expect(await screen.findByText('New customers')).toBeVisible()
  expect(mockReads.mock.calls).toEqual([['segments', 'id, name', 'site_id', mockSite]])
  mockSite = '22222222-2222-4222-8222-222222222222'
  view.rerender(<CostsPage />)
  expect(screen.getByTestId('report')).toHaveTextContent('all:all')
  expect(screen.queryByText('New customers')).not.toBeInTheDocument()
  expect(mockReads).toHaveBeenCalledTimes(1)
})

it.each(['site', 'actor'])('ignores a pending lookup on %s change, without prefetching the next scope', async change => {
  route('/dashboard')
  let finish!: (value: unknown) => void
  mockReads.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(<DashboardPage />)
  open('Segment')
  expect(mockReads).toHaveBeenCalledTimes(1)
  if (change === 'actor') mockActor = 'actor-b'
  else mockSite = '22222222-2222-4222-8222-222222222222'
  view.rerender(<DashboardPage />)
  await act(async () => finish({ data: [{ id: 'old', name: 'Old scope' }], error: null }))
  expect(screen.queryByText('Old scope')).not.toBeInTheDocument()
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(mockReads).toHaveBeenCalledTimes(1)
  open('Segment')
  expect(await screen.findByRole('option', { name: 'New customers' })).toBeVisible()
  expect(mockReads).toHaveBeenCalledTimes(2)
})

it('keeps option failures separate from empty results and retries only those options', async () => {
  route('/dashboard')
  mockReads.mockResolvedValueOnce({ data: null, error: { code: '42501' } })
  render(<DashboardPage />)
  open('Segment')
  expect(await screen.findByRole('alert')).toHaveTextContent(/segment/i)
  expect(screen.queryByRole('option', { name: 'New customers' })).not.toBeInTheDocument()
  fireEvent.click(await screen.findByRole('button', { name: /retry segment/i }))
  await screen.findByRole('combobox', { name: 'Segment' })
  open('Segment')
  expect(await screen.findByRole('option', { name: 'New customers' })).toBeVisible()
  expect(mockReads).toHaveBeenCalledTimes(2)
})

it.each(['hydrating', 'signed out', 'placeholder', 'malformed', 'missing', 'wrong-actor', 'wrong-site', 'social', 'traffic'])('does not load segment options while %s', async state => {
  mockLoading = state === 'hydrating'
  if (state === 'signed out') mockActor = null
  if (state === 'placeholder') mockSite = 'default'
  if (state === 'malformed') mockSite = 'not-a-workspace-id'
  if (state === 'missing' || state === 'wrong-actor' || state === 'wrong-site') mockScope = state
  route('/dashboard', `tab=${state === 'traffic' || state === 'social' ? state : 'overview'}`)
  render(<DashboardPage />)
  const trigger = screen.queryByRole('combobox', { name: 'Segment' })
  if (trigger) fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(mockReads).not.toHaveBeenCalled()
})

it('drops both a deep-link selection and a pending lookup across account A → signed out → account B', async () => {
  route('/costs', 'campaignId=c1')
  let finish!: (value: unknown) => void
  mockReads.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(<CostsPage />)
  expect(screen.getByTestId('report')).toHaveTextContent('c1:all')
  mockActor = null; view.rerender(<CostsPage />)
  expect(screen.queryByTestId('report')).not.toBeInTheDocument()
  mockActor = 'actor-b'; view.rerender(<CostsPage />)
  await act(async () => finish({ data: [{ id: 'c1', title: 'Private campaign' }], error: null }))
  expect(screen.queryByText('Private campaign')).not.toBeInTheDocument()
  expect(screen.getByTestId('report')).toHaveTextContent('all:all')
  expect(mockReads).toHaveBeenCalledTimes(1)
})

it.each([{ _isMock: true }, { _isMock: true, _isDemo: true }])('does not read real site options from a mock client (%j)', async flags => {
  mockFlags = flags
  route('/dashboard'); render(<DashboardPage />); open('Segment')
  expect(await screen.findByRole('alert')).toHaveTextContent(/segment/i)
  expect(mockReads).not.toHaveBeenCalled()
})

it('retains the registered local demo picker without letting a demo identity target a real workspace', async () => {
  mockActor = null; mockSite = 'demo-habituall'; mockFlags = { _isMock: true, _isDemo: true }
  localStorage.setItem('currentSiteId', mockSite)
  route('/dashboard'); const view = render(<DashboardPage />)
  open('Segment')
  expect(await screen.findByRole('option', { name: 'New customers' })).toBeVisible()
  expect(mockReads).toHaveBeenCalledWith('segments', 'id, name', 'site_id', 'demo-habituall')
  mockSite = mockFirstSite; view.rerender(<DashboardPage />)
  expect(screen.queryByText('New customers')).not.toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Segment' })).toBeDisabled()
  expect(mockReads).toHaveBeenCalledTimes(1)
})