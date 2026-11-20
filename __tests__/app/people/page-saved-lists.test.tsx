import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import PeopleSearchPage from '@/app/people/page'
import { createClient } from '@/lib/supabase/client'
import { apiClient } from '@/app/services/api-client-service'
import { deferred } from './test-helpers'
import { toast } from 'sonner'
import { savedSnapshot } from './saved-list-fixtures'

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
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }))

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
const authListeners = new Set<(event: string, session: Session | null) => void>()
const session = { user: { id: 'actor-a' } } as Session

beforeEach(() => {
  mockSiteId = 'site-a'
  jest.clearAllMocks()
  from.mockImplementation(() => ({ select, eq, order }))
  order.mockReset()
  authListeners.clear()
  ;(createClient as jest.Mock).mockReturnValue({ from, auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session }, error: null }),
    onAuthStateChange: jest.fn(callback => {
      authListeners.add(callback)
      return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } }
    }),
  } })
  ;(fetch as jest.Mock).mockReset().mockImplementation(async () => ({ ok: true, json: async () => savedSnapshot({
    id: pendingList.id, siteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  }) }))
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
  await waitFor(() => expect(eq).toHaveBeenCalledWith('site_id', 'site-a'))
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
  await waitFor(() => expect(eq).toHaveBeenCalledWith('site_id', 'site-a'))

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

it('does not run an unfiltered search when loading a selected-person list', async () => {
  ;(apiClient.get as jest.Mock).mockResolvedValue({ success: true, data: {
    icp_mining: { source: 'selected_people' }, role_query: null,
  } })
  ;(apiClient.post as jest.Mock).mockClear()
  render(<PeopleSearchPage />)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Saved lists' }))
  const selectedList = await screen.findByText('List 11111111…')
  await act(async () => { fireEvent.click(selectedList) })
  expect(apiClient.post).not.toHaveBeenCalled()
  expect(toast.info).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Back to search' })).not.toBeInTheDocument()
})

it('opens a completed selected-person list without rerunning search or enrichment', async () => {
  mockSiteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  order.mockResolvedValue({ data: [{ ...pendingList, status: 'completed' }], error: null })
  ;(apiClient.get as jest.Mock).mockResolvedValue({ success: true, data: {
    icp_mining: { source: 'selected_people', status: 'completed' }, role_query: null,
  } })
  const snapshot = savedSnapshot({ id: pendingList.id, siteId: mockSiteId, name: 'Completed selection', status: 'completed' })
  snapshot.members[0].result.person.full_name = 'Processed person'
  ;(fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => snapshot })
  render(<PeopleSearchPage />)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Saved lists' }))
  const savedList = await screen.findByText('List 11111111…')
  await act(async () => { fireEvent.click(savedList) })
  expect(await screen.findByText('Processed person')).toBeInTheDocument()
  expect(screen.getByRole('status', { name: 'Status' })).toHaveTextContent('Completed')
  expect(screen.getByRole('progressbar', { name: 'Processing' })).toHaveAttribute('aria-valuenow', '100')
  for (const name of ['Person Name', 'Role Title', 'Company', 'Processing', 'Outcome', 'Lead']) {
    expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
  }
  expect(apiClient.post).not.toHaveBeenCalled()
  expect(toast.info).not.toHaveBeenCalled()
})

it('does not report an empty list for a malformed database response', async () => {
  order.mockResolvedValue({ data: null, error: null })
  render(<PeopleSearchPage />)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Saved lists' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load saved lists')
  expect(screen.queryByText('No saved lists yet')).not.toBeInTheDocument()
})

it('keeps saved company IDs, domains and person location IDs when searching again', async () => {
  const query = { organizations: [42, '43'], organization_domains: ['acme.com'], person_locations: [71, '72'] }
  ;(apiClient.get as jest.Mock).mockResolvedValue({ success: true, data: { role_query: { query } } })
  ;(apiClient.post as jest.Mock).mockResolvedValue({ success: true, data: { search_results: [], total_persons: 0 } })
  render(<PeopleSearchPage />)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Saved lists' }))
  const savedList = await screen.findByText('List 11111111…')
  await act(async () => { fireEvent.click(savedList) })
  expect(apiClient.post).not.toHaveBeenCalled()
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Search people' }))
  expect(screen.getByRole('button', { name: 'Remove ID 42' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Remove ID 43' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Remove ID 71' })).toBeInTheDocument()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })
  for (const suffix of ['', '/totals']) {
    expect(apiClient.post).toHaveBeenCalledWith(`/api/finder/person_role_search${suffix}`,
      expect.objectContaining({ organizations: [42, 43], organization_domains: ['acme.com'], person_locations: [71, 72] }), { includeAuth: true })
  }
})

async function openMembershipList(query?: Record<string, unknown>) {
  mockSiteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ;(apiClient.get as jest.Mock).mockResolvedValue({ success: true, data: query
    ? { icp_mining: { source: 'person_role_search' }, role_query: { query } }
    : { icp_mining: { source: 'selected_people' }, role_query: null } })
  const view = render(<PeopleSearchPage />)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Saved lists' }))
  fireEvent.click(await screen.findByText('List 11111111…'))
  const person = await screen.findByText('Alice')
  return { ...view, person }
}

it('automatically runs an empty filter-based list once using its original filters', async () => {
  mockSiteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const snapshot = savedSnapshot({ id: pendingList.id, siteId: mockSiteId, members: [], total: 0, completed: 0 })
  ;(fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => snapshot })
  const query = { site_id: 'ignored', page: 4, provider_only_field: 'kept' }
  ;(apiClient.get as jest.Mock).mockResolvedValue({ success: true, data: { role_query: { query } } })
  ;(apiClient.post as jest.Mock).mockResolvedValue({ success: true, data: { search_results: [], total_persons: 0 } })
  const breadcrumb = jest.spyOn(window, 'dispatchEvent')
  render(<PeopleSearchPage />)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Saved lists' }))
  fireEvent.click(await screen.findByText('List 11111111…'))
  expect(await screen.findByText('No people match this saved search.')).toBeInTheDocument()
  expect(apiClient.post).toHaveBeenCalledTimes(2)
  expect(apiClient.post).toHaveBeenCalledWith('/api/finder/person_role_search',
    { ...query, site_id: mockSiteId, page: 0 }, { includeAuth: true })
  expect(breadcrumb).toHaveBeenCalledWith(expect.objectContaining({ type: 'people:list-breadcrumb', detail: snapshot.name }))
  expect(screen.queryByRole('button', { name: 'Run saved search' })).not.toBeInTheDocument()
})

it('shows members of a mixed list in one table and only runs its exact saved filters on demand', async () => {
  const query = { site_id: 'ignored', page: 12, organizations: [42], provider_only_field: 'kept' }
  const { person } = await openMembershipList(query)
  expect(screen.getAllByRole('table')).toHaveLength(1)
  expect(within(person.closest('tr')!).getByText('Matched')).toBeInTheDocument()
  expect(apiClient.post).not.toHaveBeenCalled()
  ;(apiClient.post as jest.Mock).mockImplementation(async (endpoint: string) => ({ success: true,
    data: endpoint.endsWith('/totals') ? { total_persons: 24 } : { search_results: [{ person: { id: '99', full_name: 'Live search result' } }] } }))
  fireEvent.click(person)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run saved search' })) })
  expect(await screen.findByText('Live search result')).toBeInTheDocument()
  expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enrich selected' })).toBeDisabled()
  expect(screen.queryByRole('columnheader', { name: 'Processing' })).not.toBeInTheDocument()
  for (const suffix of ['', '/totals']) {
    expect(apiClient.post).toHaveBeenCalledWith(`/api/finder/person_role_search${suffix}`,
      { ...query, site_id: mockSiteId, page: 0 }, { includeAuth: true })
  }
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Go to page' }), { target: { value: '2' } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Go$/ })) })
  for (const suffix of ['', '/totals']) {
    expect(apiClient.post).toHaveBeenCalledWith(`/api/finder/person_role_search${suffix}`,
      { ...query, site_id: mockSiteId, page: 1 }, { includeAuth: true })
  }
})

it('drops list selections when starting a different search via the sidebar', async () => {
  const { person } = await openMembershipList()
  fireEvent.click(person)
  expect(screen.getByRole('button', { name: 'Enrich selected (1)' })).toBeEnabled()
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Search people' }))
  ;(apiClient.post as jest.Mock).mockImplementation(async (endpoint: string) => ({ success: true,
    data: endpoint.endsWith('/totals') ? { total_persons: 1 } : { search_results: [{ person: { id: '99', full_name: 'New person' } }] } }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })
  expect(await screen.findByText('New person')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enrich selected' })).toBeDisabled()
  expect(apiClient.post).toHaveBeenCalledTimes(2)
})

it.each(['site', 'session'] as const)('retires a pending confirmation and list rows on %s change', async boundary => {
  const { person, rerender } = await openMembershipList()
  fireEvent.click(person)
  fireEvent.click(screen.getByRole('button', { name: 'Enrich selected (1)' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  if (boundary === 'site') {
    mockSiteId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    rerender(<PeopleSearchPage />)
  } else {
    await act(async () => { for (const listener of [...authListeners]) listener('SIGNED_OUT', null) })
  }
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enrich selected' })).toBeDisabled()
  expect(apiClient.post).not.toHaveBeenCalled()
})