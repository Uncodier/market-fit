import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import PeopleSearchPage from '@/app/people/page'
import { createClient } from '@/lib/supabase/client'
import { deferred } from './test-helpers'

let mockSiteId = 'site-a'

jest.mock('@/app/services/api-client-service', () => ({ apiClient: { post: jest.fn(), get: jest.fn() } }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: mockSiteId } }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
jest.mock('@/app/context/BillingLimitContext', () => ({ useBillingLimit: () => ({ showBillingLimit: jest.fn(), showBillingLimitFromError: jest.fn() }) }))
jest.mock('@/app/hooks/use-billing-check', () => ({ useBillingCheck: () => ({ creditsAvailable: 100 }) }))
jest.mock('@/app/hooks/use-mobile-view', () => ({ useIsMobile: () => false }))
jest.mock('@/app/segments/actions', () => ({ getSegments: jest.fn() }))
jest.mock('@/app/commerce/resolve-relation', () => ({ resolveRelationId: jest.fn() }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }))

const pendingList = {
  id: '11111111-1111-4111-8111-111111111111',
  name: null,
  status: 'pending',
  role_query_id: '22222222-2222-4222-8222-222222222222',
  total_targets: 1188,
}

const select = jest.fn().mockReturnThis()
const eq = jest.fn().mockReturnThis()
const order = jest.fn()
const from = jest.fn(() => ({ select, eq, order }))

beforeEach(() => {
  mockSiteId = 'site-a'
  jest.clearAllMocks()
  ;(createClient as jest.Mock).mockReturnValue({ from })
  order.mockResolvedValue({ data: [pendingList], error: null })
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
})

it('shows a pending unnamed list using a flat site-scoped ICP query', async () => {
  render(<PeopleSearchPage />)
  expect(from).not.toHaveBeenCalledWith('icp_mining')

  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Saved lists' }))
  expect(await screen.findByText('List 11111111…')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Pending' })).toBeInTheDocument()
  expect(from).toHaveBeenCalledWith('icp_mining')
  expect(from).not.toHaveBeenCalledWith('segments')
  expect(eq).toHaveBeenCalledWith('site_id', 'site-a')
  expect(select.mock.calls[0][0]).not.toContain('role_query_segments')
  expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
})

it('shows an actionable error rather than an empty list, and retries the load', async () => {
  order
    .mockResolvedValueOnce({ data: null, error: { code: 'PGRST200', message: 'Query failed' } })
    .mockResolvedValueOnce({ data: [pendingList], error: null })

  render(<PeopleSearchPage />)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Saved lists' }))
  expect(await screen.findByText('Could not load saved lists. Please try again.')).toBeInTheDocument()
  expect(screen.queryByText('No saved lists yet')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('List 11111111…')).toBeInTheDocument()
  expect(order).toHaveBeenCalledTimes(2)
})

it('refreshes on return to Saved lists, including newly created lists', async () => {
  order
    .mockResolvedValueOnce({ data: [pendingList], error: null })
    .mockResolvedValueOnce({ data: [{ ...pendingList, id: 'fresh-id', name: 'New list' }], error: null })

  render(<PeopleSearchPage />)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Saved lists' }))
  expect(await screen.findByText('List 11111111…')).toBeInTheDocument()
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Search people' }))
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Saved lists' }))

  expect(await screen.findByText('New list')).toBeInTheDocument()
  expect(screen.queryByText('List 11111111…')).not.toBeInTheDocument()
  expect(order).toHaveBeenCalledTimes(2)
})

it('never shows another site’s lists or a late response from a previous site', async () => {
  const firstSite = deferred<{ data: typeof pendingList[]; error: null }>()
  order.mockReturnValueOnce(firstSite.promise).mockResolvedValueOnce({
    data: [{ ...pendingList, id: 'second-id', name: 'Second site list' }], error: null,
  })

  const { rerender } = render(<PeopleSearchPage />)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Saved lists' }))
  expect(eq).toHaveBeenCalledWith('site_id', 'site-a')

  mockSiteId = 'site-b'
  rerender(<PeopleSearchPage />)
  expect(await screen.findByText('Second site list')).toBeInTheDocument()
  expect(eq).toHaveBeenCalledWith('site_id', 'site-b')

  await act(async () => { firstSite.resolve({ data: [pendingList], error: null }) })
  expect(screen.getByText('Second site list')).toBeInTheDocument()
  expect(screen.queryByText('List 11111111…')).not.toBeInTheDocument()
})

it('only displays the empty state after a successful empty response', async () => {
  order.mockResolvedValue({ data: [], error: null })
  render(<PeopleSearchPage />)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Saved lists' }))
  expect(await screen.findByText('No saved lists yet')).toBeInTheDocument()
})

it('does not report an empty list for a malformed database response', async () => {
  order.mockResolvedValue({ data: null, error: null })
  render(<PeopleSearchPage />)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Saved lists' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load saved lists')
  expect(screen.queryByText('No saved lists yet')).not.toBeInTheDocument()
})