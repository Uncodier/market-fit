import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import PeopleSearchPage from '@/app/people/page'
import { apiClient } from '@/app/services/api-client-service'
import { toast } from 'sonner'
import { deferred } from './test-helpers'

jest.mock('@/app/services/api-client-service', () => ({ apiClient: { post: jest.fn(), get: jest.fn() } }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site-a' } }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
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