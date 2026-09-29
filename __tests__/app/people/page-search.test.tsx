import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import PeopleSearchPage from '@/app/people/page'
import { apiClient } from '@/app/services/api-client-service'
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