import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Button } from '@/app/components/ui/button'
import { useFinderSearch } from '@/app/people/use-finder-search'
import { apiClient } from '@/app/services/api-client-service'
import { toast } from 'sonner'
import { deferred } from './test-helpers'

jest.mock('@/app/services/api-client-service', () => ({ apiClient: { post: jest.fn() } }))
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }))

const payload = { site_id: 'provided-site', page: 0, role_title: ['Founder'] }
const searchResponse = { success: true, data: { search_results: [{ id: 'p1' }], total_search_results: 3 } }
const totalsResponse = { success: true, data: { total_persons: 2 } }
const failure = { success: false, error: { message: 'Too many requests' } }
type Response = typeof searchResponse | typeof totalsResponse | typeof failure

function SearchHarness({ onResults }: { onResults: (rows: Record<string, unknown>[], total: number) => void }) {
  const { loading, executeSearch, status, error } = useFinderSearch({ siteId: 'site-a', onResults })
  return <>
    <output aria-label="Search status">{status}</output>
    {error && <p role="alert">{error}</p>}
    <Button disabled={loading} onClick={() => executeSearch(payload)}>{loading ? 'Searching…' : 'Search'}</Button>
    <button onClick={() => { void executeSearch(payload); void executeSearch(payload) }}>Shared action twice</button>
  </>
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it.each(['success', 'failure', 'rejection'] as const)(
  'guards concurrent Search invocations until both POSTs settle after %s, then permits manual retry',
  async outcome => {
    const search = deferred<Response>()
    const totals = deferred<Response>()
    ;(apiClient.post as jest.Mock).mockReturnValueOnce(search.promise).mockReturnValueOnce(totals.promise)
    const onResults = jest.fn()
    render(<StrictMode><SearchHarness onResults={onResults} /></StrictMode>)
    expect(screen.getByLabelText('Search status')).toHaveTextContent('idle')

    // Both calls happen in one event before React can render the disabled state.
    fireEvent.click(screen.getByText('Shared action twice'))
    expect(apiClient.post).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Searching…' })).toBeDisabled()
    expect(screen.getByLabelText('Search status')).toHaveTextContent('loading')
    for (const suffix of ['', '/totals']) {
      expect(apiClient.post).toHaveBeenCalledWith(`/api/finder/person_role_search${suffix}`,
        { ...payload, site_id: 'site-a' }, { includeAuth: true })
    }
    expect(payload.site_id).toBe('provided-site')

    await act(async () => {
      if (outcome === 'rejection') search.reject(new Error('Network failed'))
      else search.resolve(outcome === 'success' ? searchResponse : failure)
    })
    expect(screen.getByRole('button', { name: 'Searching…' })).toBeDisabled()
    fireEvent.click(screen.getByText('Shared action twice'))
    fireEvent.click(screen.getByRole('button', { name: 'Searching…' }))
    expect(apiClient.post).toHaveBeenCalledTimes(2)
    expect(onResults).not.toHaveBeenCalled()

    await act(async () => { totals.resolve(totalsResponse) })
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled()
    if (outcome === 'success') {
      expect(onResults).toHaveBeenCalledTimes(1)
      expect(onResults).toHaveBeenCalledWith([{ id: 'p1' }], 2)
      expect(toast.error).not.toHaveBeenCalled()
      expect(screen.getByLabelText('Search status')).toHaveTextContent('success')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    } else {
      expect(onResults).toHaveBeenCalledTimes(1)
      expect(onResults).toHaveBeenCalledWith([], 0)
      expect(toast.error).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('Search status')).toHaveTextContent('error')
      expect(screen.getByRole('alert')).toHaveTextContent(outcome === 'rejection' ? 'Network failed' : 'Too many requests')
    }
    await act(async () => { jest.advanceTimersByTime(60000) })
    expect(apiClient.post).toHaveBeenCalledTimes(2)

    ;(apiClient.post as jest.Mock).mockResolvedValueOnce(searchResponse).mockResolvedValueOnce(totalsResponse)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })
    expect(apiClient.post).toHaveBeenCalledTimes(4)
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled()
    expect(onResults).toHaveBeenLastCalledWith([{ id: 'p1' }], 2)
    expect(screen.getByLabelText('Search status')).toHaveTextContent('success')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  }
)

it('waits for search when totals fails first and never publishes a fallback success', async () => {
  const search = deferred<Response>()
  ;(apiClient.post as jest.Mock).mockReturnValueOnce(search.promise).mockResolvedValueOnce(failure)
  const onResults = jest.fn()
  render(<SearchHarness onResults={onResults} />)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })
  expect(screen.getByRole('button', { name: 'Searching…' })).toBeDisabled()
  fireEvent.click(screen.getByText('Shared action twice'))
  expect(apiClient.post).toHaveBeenCalledTimes(2)
  await act(async () => { search.resolve(searchResponse) })
  expect(onResults).toHaveBeenCalledTimes(1)
  expect(onResults).toHaveBeenCalledWith([], 0)
  expect(screen.getByLabelText('Search status')).toHaveTextContent('error')
  expect(toast.error).toHaveBeenCalledWith('Too many requests')
  expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled()
})

it.each(['success', 'rejection'] as const)('does not publish %s after unmount or block another instance', async outcome => {
  const request = deferred<Response>()
  ;(apiClient.post as jest.Mock).mockReturnValueOnce(request.promise).mockResolvedValueOnce(totalsResponse)
  const onResults = jest.fn()
  const view = render(<SearchHarness onResults={onResults} />)
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  view.unmount()
  await act(async () => {
    if (outcome === 'success') request.resolve(searchResponse)
    else request.reject(new Error('Network failed'))
  })
  expect(onResults).not.toHaveBeenCalled()
  expect(toast.error).not.toHaveBeenCalled()

  ;(apiClient.post as jest.Mock).mockResolvedValueOnce(searchResponse).mockResolvedValueOnce(totalsResponse)
  render(<SearchHarness onResults={onResults} />)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Search' })) })
  expect(apiClient.post).toHaveBeenCalledTimes(4)
  expect(onResults).toHaveBeenCalledTimes(1)
})