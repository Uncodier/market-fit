import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import PeopleSearchPage from '@/app/people/page'
import { apiClient } from '@/app/services/api-client-service'
import { toast } from 'sonner'
import { deferred } from './test-helpers'

jest.mock('@/app/services/api-client-service', () => ({ apiClient: { post: jest.fn(), get: jest.fn() } }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site-a' } }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({
  t: (key: string) => key === 'commerce.pagination.next' ? 'Next page' : '',
}) }))
jest.mock('@/app/context/BillingLimitContext', () => ({ useBillingLimit: () => ({ showBillingLimit: jest.fn(), showBillingLimitFromError: jest.fn() }) }))
jest.mock('@/app/hooks/use-billing-check', () => ({ useBillingCheck: () => ({ creditsAvailable: 100 }) }))
jest.mock('@/app/hooks/use-mobile-view', () => ({ useIsMobile: () => false }))
jest.mock('@/app/segments/actions', () => ({ getSegments: jest.fn() }))
jest.mock('@/app/commerce/resolve-relation', () => ({ resolveRelationId: jest.fn() }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }))

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  ;(apiClient.post as jest.Mock).mockReset()
  ;(apiClient.get as jest.Mock).mockReset()
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it('disables the actual page Search button until both requests settle and allows another search', async () => {
  const search = deferred<unknown>()
  const totals = deferred<unknown>()
  ;(apiClient.post as jest.Mock).mockReturnValueOnce(search.promise).mockReturnValueOnce(totals.promise)
  render(<PeopleSearchPage />)

  const button = screen.getByRole('button', { name: 'Search' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(button).toBeDisabled()
  expect(button).toHaveTextContent('Searching…')
  expect(apiClient.post).toHaveBeenCalledTimes(2)

  await act(async () => { search.resolve({ success: true, data: { search_results: [], total_search_results: 0 } }) })
  expect(button).toBeDisabled()
  await act(async () => { totals.resolve({ success: true, data: { total_persons: 0 } }) })
  expect(button).toBeEnabled()
  expect(button).toHaveTextContent('Search')

  ;(apiClient.post as jest.Mock).mockResolvedValue({ success: true, data: { search_results: [], total_persons: 0 } })
  await act(async () => { fireEvent.click(button) })
  expect(apiClient.post).toHaveBeenCalledTimes(4)
  expect(button).toBeEnabled()
})

it('cancels the actual page lookup when Clear resets filters', async () => {
  ;(apiClient.get as jest.Mock).mockResolvedValue({ success: true, data: { results: [] } })
  render(<PeopleSearchPage />)
  fireEvent.click(screen.getByRole('heading', { name: 'Industry' }))
  const input = screen.getByPlaceholderText('Search industries')
  fireEvent.change(input, { target: { value: 'q' } })
  await act(async () => { jest.advanceTimersByTime(80) })
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
  await act(async () => { jest.advanceTimersByTime(500) })
  expect(input).toHaveValue('')
  expect(apiClient.get).not.toHaveBeenCalled()
})

it.each(['draft', 'Enter'] as const)('resolves a company name entered via %s for both search and totals', async mode => {
  ;(apiClient.get as jest.Mock).mockResolvedValue({ success: true, data: { results: [{ id: '42', text: 'Acme' }] } })
  ;(apiClient.post as jest.Mock).mockResolvedValue({ success: true, data: { search_results: [], total_persons: 0 } })
  render(<PeopleSearchPage />)
  fireEvent.click(screen.getByRole('heading', { name: 'Company' }))
  const input = screen.getByPlaceholderText('Search companies')
  fireEvent.change(input, { target: { value: 'Acme' } })
  if (mode === 'Enter') fireEvent.keyDown(input, { key: 'Enter' })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })
  for (const suffix of ['', '/totals']) {
    expect(apiClient.post).toHaveBeenCalledWith(`/api/finder/person_role_search${suffix}`,
      expect.objectContaining({ organizations: [42] }), { includeAuth: true })
  }
})

it.each([
  { results: [] },
  { results: [{ id: 42, text: 'Acme Consulting' }] },
  { results: [{ id: 42, text: 'Acme' }, { id: 43, text: 'Acme' }] },
])('does not run an unfiltered search when a company cannot be uniquely resolved: %j', async ({ results }) => {
  ;(apiClient.get as jest.Mock).mockResolvedValue({ success: true, data: { results } })
  render(<PeopleSearchPage />)
  fireEvent.click(screen.getByRole('heading', { name: 'Company' }))
  const input = screen.getByPlaceholderText('Search companies')
  fireEvent.change(input, { target: { value: 'Acme' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })
  expect(apiClient.post).not.toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Acme'))
})

it('preserves selected provider IDs and manually entered domains', async () => {
  ;(apiClient.get as jest.Mock).mockResolvedValue({ success: true, data: { results: [{ id: '42', text: 'Acme' }] } })
  ;(apiClient.post as jest.Mock).mockResolvedValue({ success: true, data: { search_results: [], total_persons: 0 } })
  render(<PeopleSearchPage />)
  fireEvent.click(screen.getByRole('heading', { name: 'Company' }))
  const input = screen.getByPlaceholderText('Search companies')
  fireEvent.change(input, { target: { value: 'Acme' } })
  await act(async () => { jest.advanceTimersByTime(250) })
  fireEvent.click(screen.getByRole('button', { name: 'Acme' }))
  fireEvent.change(input, { target: { value: 'acme.com' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })
  expect(apiClient.post).toHaveBeenCalledWith('/api/finder/person_role_search',
    expect.objectContaining({ organizations: [42], organization_domains: ['acme.com'] }), { includeAuth: true })
})

it.each(['draft', 'Enter', 'suggestion'] as const)('includes the person location entered via %s in search and totals', async mode => {
  ;(apiClient.get as jest.Mock).mockResolvedValue({ success: true, data: { results: [{ id: '71', text: 'Mexico City, Mexico' }] } })
  ;(apiClient.post as jest.Mock).mockResolvedValue({ success: true, data: { search_results: [], total_persons: 0 } })
  render(<PeopleSearchPage />)
  fireEvent.click(screen.getByRole('heading', { name: 'Location' }))
  const input = screen.getByPlaceholderText('Search locations')
  fireEvent.change(input, { target: { value: 'Mexico City, Mexico' } })
  if (mode === 'Enter') fireEvent.keyDown(input, { key: 'Enter' })
  if (mode === 'suggestion') {
    await act(async () => { jest.advanceTimersByTime(250) })
    fireEvent.click(screen.getByRole('button', { name: 'Mexico City, Mexico' }))
  }
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })
  for (const suffix of ['', '/totals']) {
    expect(apiClient.post).toHaveBeenCalledWith(`/api/finder/person_role_search${suffix}`,
      expect.objectContaining({ person_locations: [71] }), { includeAuth: true })
  }
})

it.each([
  { results: [] },
  { results: [{ id: 71, text: 'Paris, France' }, { id: 72, text: 'Paris, Texas' }] },
])('blocks search instead of ignoring an unresolved person location: %j', async ({ results }) => {
  ;(apiClient.get as jest.Mock).mockResolvedValue({ success: true, data: { results } })
  render(<PeopleSearchPage />)
  fireEvent.click(screen.getByRole('heading', { name: 'Location' }))
  fireEvent.change(screen.getByPlaceholderText('Search locations'), { target: { value: 'Paris' } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })
  expect(apiClient.post).not.toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Paris'))
})

it('clears the person location draft when all filters are cleared', async () => {
  ;(apiClient.post as jest.Mock).mockResolvedValue({ success: true, data: { search_results: [], total_persons: 0 } })
  render(<PeopleSearchPage />)
  fireEvent.click(screen.getByRole('heading', { name: 'Location' }))
  fireEvent.change(screen.getByPlaceholderText('Search locations'), { target: { value: 'Paris' } })
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })
  expect(apiClient.get).not.toHaveBeenCalled()
  expect(apiClient.post).toHaveBeenCalledWith('/api/finder/person_role_search',
    expect.objectContaining({ person_locations: undefined }), { includeAuth: true })
})

const lookupCases = [
  ['Industry', 'Search industries', 'person_industries'],
  ['Industry', 'Search industries to exclude', 'person_industries_exclude'],
  ['Skills', 'Search skills', 'person_skills'],
  ['Location & Industry', 'Search locations', 'organization_locations'],
  ['Location & Industry', 'Search industries', 'organization_industries'],
  ['Location & Industry', 'Search industries to exclude', 'organization_industries_exclude'],
  ['Location & Industry', 'Keywords', 'organization_keywords'],
  ['Web & Tech', 'Search technologies', 'organization_web_technologies'],
  ['Job Postings', 'Search locations', 'job_post_locations'],
  ['Job Postings', 'Search locations to exclude', 'job_post_locations_exclude'],
] as const

describe.each(lookupCases)('%s / %s (%s)', (heading, placeholder, field) => {
  it.each(['draft', 'Enter', 'suggestion'] as const)('sends %s input to search and totals', async mode => {
    ;(apiClient.get as jest.Mock).mockResolvedValue({ success: true, data: { results: [{ id: '42', text: 'Exact' }] } })
    ;(apiClient.post as jest.Mock).mockResolvedValue({ success: true, data: { search_results: [], total_persons: 0 } })
    render(<PeopleSearchPage />)
    fireEvent.click(screen.getByRole('heading', { name: heading }))
    const input = screen.getByPlaceholderText(placeholder)
    fireEvent.change(input, { target: { value: 'Exact' } })
    if (mode === 'Enter') fireEvent.keyDown(input, { key: 'Enter' })
    if (mode === 'suggestion') {
      await act(async () => { jest.advanceTimersByTime(250) })
      fireEvent.click(screen.getByRole('button', { name: 'Exact' }))
    }
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })
    for (const suffix of ['', '/totals']) {
      expect(apiClient.post).toHaveBeenCalledWith(`/api/finder/person_role_search${suffix}`,
        expect.objectContaining({ [field]: [42] }), { includeAuth: true })
    }
  })

  it('clears the draft without leaving a hidden filter', async () => {
    ;(apiClient.post as jest.Mock).mockResolvedValue({ success: true, data: { search_results: [], total_persons: 0 } })
    render(<PeopleSearchPage />)
    fireEvent.click(screen.getByRole('heading', { name: heading }))
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: 'Exact' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })
    expect(apiClient.get).not.toHaveBeenCalled()
    expect(apiClient.post).toHaveBeenCalledWith('/api/finder/person_role_search',
      expect.objectContaining({ [field]: undefined }), { includeAuth: true })
  })
})

it('includes and clears a company LinkedIn draft from the dedicated section', async () => {
  ;(apiClient.post as jest.Mock).mockResolvedValue({ success: true, data: { search_results: [], total_persons: 0 } })
  render(<PeopleSearchPage />)
  const headings = screen.getAllByRole('heading', { name: 'LinkedIn Identifiers' })
  fireEvent.click(headings[1])
  const input = screen.getByPlaceholderText('linkedin.com/company/slug')
  fireEvent.change(input, { target: { value: 'acme' } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })
  expect(apiClient.post).toHaveBeenCalledWith('/api/finder/person_role_search',
    expect.objectContaining({ organization_linkedin_public_identifiers: ['acme'] }), { includeAuth: true })
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
  expect(input).toHaveValue('')
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })
  expect(apiClient.post).toHaveBeenLastCalledWith('/api/finder/person_role_search/totals',
    expect.objectContaining({ organization_linkedin_public_identifiers: undefined }), { includeAuth: true })
})

it('includes and clears domain draft text without requiring Enter', async () => {
  ;(apiClient.post as jest.Mock).mockResolvedValue({ success: true, data: { search_results: [], total_persons: 0 } })
  render(<PeopleSearchPage />)
  fireEvent.click(screen.getByRole('heading', { name: 'Domains' }))
  const input = screen.getAllByPlaceholderText('example.com')[0]
  fireEvent.change(input, { target: { value: 'acme.com' } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })
  expect(apiClient.post).toHaveBeenCalledWith('/api/finder/person_role_search',
    expect.objectContaining({ organization_domains: ['acme.com'] }), { includeAuth: true })
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
  expect(input).toHaveValue('')
})

it('keeps the pagination inside a viewport-sized, scrollable results panel', async () => {
  ;(apiClient.post as jest.Mock)
    .mockResolvedValueOnce({
      success: true,
      data: {
        search_results: [{
          id: 'person-1',
          person: { id: 'person-1', full_name: 'Ada Lovelace' },
          organization: { id: 'org-1', name: 'Analytical Engines' },
          role_title: 'CTO',
        }],
        total_search_results: 20,
      },
    })
    .mockResolvedValueOnce({ success: true, data: { total_persons: 20 } })

  render(<PeopleSearchPage />)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })

  const nextPage = screen.getByRole('button', { name: 'Next page' })
  const resultsPanel = nextPage.closest('div.fixed')
  const scrollArea = nextPage.closest('.overflow-y-auto')

  expect(resultsPanel).not.toBeNull()
  expect(resultsPanel).not.toHaveClass('h-full')
  expect(scrollArea).not.toBeNull()
  expect(scrollArea).toHaveClass('min-h-0')
  expect(scrollArea).toContainElement(nextPage)
  expect(nextPage).toBeEnabled()
})

it.each([
  ['search', 'Search', 0],
  ['totals', 'Search', 0],
  ['search', 'Next page', 1],
  ['totals', 'Next page', 1],
] as const)('clears old rows when %s fails after %s instead of showing stale pagination', async (failedRequest, action, page) => {
  const searchResponse = {
    success: true,
    data: {
      search_results: [{
        id: 'person-1',
        person: { id: 'person-1', full_name: 'Ada Lovelace' },
        organization: { id: 'org-1', name: 'Analytical Engines' },
        role_title: 'CTO',
      }],
      total_search_results: 20,
    },
  }
  const totalsResponse = { success: true, data: { total_persons: 20 } }
  const failure = { success: false, error: { message: 'Finder unavailable. Please try again.' } }
  ;(apiClient.post as jest.Mock).mockResolvedValueOnce(searchResponse).mockResolvedValueOnce(totalsResponse)
  render(<PeopleSearchPage />)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })
  expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
  expect(screen.getByText(/^Showing/)).toHaveTextContent(/^Showing 1 to 1 of 20 people$/)

  ;(apiClient.post as jest.Mock)
    .mockResolvedValueOnce(failedRequest === 'search' ? failure : searchResponse)
    .mockResolvedValueOnce(failedRequest === 'totals' ? failure : totalsResponse)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: action })) })

  expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled()
  expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
  expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(toast.error).toHaveBeenCalledWith('Finder unavailable. Please try again.')
  expect(apiClient.post).toHaveBeenCalledTimes(4)
  for (const suffix of ['', '/totals']) {
    expect(apiClient.post).toHaveBeenCalledWith(`/api/finder/person_role_search${suffix}`,
      expect.objectContaining({ page, site_id: 'site-a' }), { includeAuth: true })
  }
})