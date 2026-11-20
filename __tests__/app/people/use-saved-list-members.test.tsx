import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSavedListMembers } from '@/app/people/use-saved-list-members'
import { createClient } from '@/lib/supabase/client'
import type { SavedListReference } from '@/app/people/saved-list-types'
import { deferred } from './test-helpers'
import { listId, siteId, savedSnapshot } from './saved-list-fixtures'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
const list = { id: listId, siteId }
const session = { user: { id: 'actor-a' } }
const getSession = jest.fn()
let authListener: (_event: string, value: typeof session | null) => void
const fetchMock = fetch as jest.Mock
function response(snapshot = savedSnapshot()) {
  return { ok: true, json: async () => snapshot }
}
function Harness({ list }: { list: SavedListReference | null }) {
  const saved = useSavedListMembers(list)
  return <>
    <button onClick={saved.refresh} disabled={saved.loading || saved.identityChanged}>Refresh</button>
    <button onClick={() => saved.onPageChange(saved.page + 1)} disabled={saved.loading || saved.identityChanged}>Next</button>
    {saved.loading && <p>Loading</p>}
    {saved.error && <div role="alert">{saved.error}{!saved.identityChanged && <button onClick={saved.refresh}>Retry</button>}</div>}
    {saved.snapshot && <><h2>{saved.snapshot.name}</h2><p role="status">{saved.snapshot.total} members · {saved.snapshot.completed} processed</p>
      {saved.snapshot.members.map(member => <p key={member.personId}>{member.result.person.full_name}</p>)}</>}
  </>
}
beforeEach(() => {
  jest.clearAllMocks()
  fetchMock.mockReset().mockResolvedValue(response())
  getSession.mockReset().mockResolvedValue({ data: { session }, error: null })
  jest.mocked(createClient).mockReturnValue({ auth: { getSession, onAuthStateChange: jest.fn(callback => {
    authListener = callback
    let subscribed = true
    void Promise.resolve().then(() => { if (subscribed) callback('INITIAL_SESSION', session) })
    return { data: { subscription: { unsubscribe: () => { subscribed = false } } } }
  }) } } as never)
})

it('loads actual members through a read-only same-origin endpoint, not provider search', async () => {
  render(<Harness list={list} />)
  expect(await screen.findByText('Alice')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith(`/api/finder/lists/${listId}/members?site_id=${siteId}&page=1`, expect.objectContaining({
    credentials: 'same-origin', cache: 'no-store', signal: expect.any(AbortSignal),
  }))
  expect(screen.getByRole('status')).toHaveTextContent('1 members · 1 processed')
})

it.each(['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'])('does not cancel initial loading on same-user %s', async event => {
  const pending = deferred<{ data: { session: typeof session }; error: null }>()
  getSession.mockReturnValueOnce(pending.promise)
  render(<Harness list={list} />)
  act(() => authListener(event, session))
  await act(async () => pending.resolve({ data: { session }, error: null }))
  expect(await screen.findByText('Alice')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('refreshes and paginates without initial-session false positives', async () => {
  render(<Harness list={list} />)
  await screen.findByText('Alice')
  fetchMock.mockResolvedValueOnce(response(savedSnapshot({ name: 'Refreshed selection' })))
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  await screen.findByText('Refreshed selection')
  fetchMock.mockResolvedValueOnce(response(savedSnapshot({ page: 2, name: 'Second page' })))
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('Second page')
  expect(fetchMock.mock.calls[2][0]).toContain('page=2')
})

it('keeps an in-flight member read on token refresh for the same user', async () => {
  const pending = deferred<ReturnType<typeof response>>()
  fetchMock.mockReturnValueOnce(pending.promise)
  render(<Harness list={list} />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  act(() => authListener('TOKEN_REFRESHED', session))
  await act(async () => pending.resolve(response()))
  expect(await screen.findByText('Alice')).toBeInTheDocument()
})

it.each(['SIGNED_OUT', 'SIGNED_IN', 'switch-back'])('rejects stale session resolution after %s changes identity', async event => {
  const pending = deferred<{ data: { session: typeof session }; error: null }>()
  getSession.mockReturnValueOnce(pending.promise)
  render(<Harness list={list} />)
  await act(async () => { await Promise.resolve() })
  act(() => {
    authListener(event === 'SIGNED_OUT' ? 'SIGNED_OUT' : 'SIGNED_IN', event === 'SIGNED_OUT' ? null : { user: { id: 'actor-b' } })
    if (event === 'switch-back') authListener('SIGNED_IN', session)
  })
  await act(async () => pending.resolve({ data: { session }, error: null }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Your session changed')
  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled()
})

it('clears visible profiles on sign-out', async () => {
  render(<Harness list={list} />)
  await screen.findByText('Alice')
  act(() => authListener('SIGNED_OUT', null))
  expect(screen.getByRole('alert')).toHaveTextContent('Your session changed')
  expect(screen.queryByText('Alice')).not.toBeInTheDocument()
})

it('aborts and rejects a late HTTP response when identity changes', async () => {
  const pending = deferred<ReturnType<typeof response>>()
  fetchMock.mockReturnValueOnce(pending.promise)
  render(<Harness list={list} />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  const signal = fetchMock.mock.calls[0][1].signal
  act(() => authListener('SIGNED_IN', { user: { id: 'actor-b' } }))
  await act(async () => pending.resolve(response()))
  expect(signal.aborted).toBe(true)
  expect(screen.queryByText('Alice')).not.toBeInTheDocument()
})

it('does not publish old-site data and starts the next list at page one', async () => {
  const pending = deferred<ReturnType<typeof response>>()
  fetchMock.mockReturnValueOnce(pending.promise)
  const { rerender } = render(<Harness list={list} />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  const otherList = { id: '44444444-4444-4444-8444-444444444444', siteId: '55555555-5555-4555-8555-555555555555' }
  fetchMock.mockResolvedValueOnce(response(savedSnapshot({ ...otherList, name: 'Other site', members: [], total: 0, completed: 0 })))
  rerender(<Harness list={otherList} />)
  await screen.findByText('Other site')
  await act(async () => pending.resolve(response()))
  expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  expect(fetchMock.mock.calls[1][0]).toContain('page=1')
})

it('clears profiles when returning to search and does not fetch without a list', async () => {
  const { rerender } = render(<Harness list={list} />)
  await screen.findByText('Alice')
  rerender(<Harness list={null} />)
  expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('requires explicit reselection after a real identity change and reloads on reselection', async () => {
  const { rerender } = render(<Harness list={list} />)
  await screen.findByText('Alice')
  act(() => authListener('SIGNED_IN', { user: { id: 'actor-b' } }))
  act(() => authListener('SIGNED_IN', session))
  expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  rerender(<Harness list={{ ...list }} />)
  expect(await screen.findByText('Alice')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('starts at the first page when reopening the same list', async () => {
  const { rerender } = render(<Harness list={list} />)
  await screen.findByText('Alice')
  fetchMock.mockResolvedValueOnce(response(savedSnapshot({ page: 2, name: 'Second page' })))
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('Second page')
  rerender(<Harness list={null} />)
  rerender(<Harness list={{ ...list }} />)
  await screen.findByText('Alice')
  expect(fetchMock.mock.calls[2][0]).toContain('page=1')
})

it.each(['hidden', 'database', 'malformed', 'wrong-site', 'wrong-identity'])('shows retry instead of an empty list after %s failure', async failure => {
  const snapshot = savedSnapshot()
  if (failure === 'hidden') fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })
  if (failure === 'database') fetchMock.mockRejectedValueOnce(new Error('Database unavailable'))
  if (failure === 'malformed') fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ members: [] }) })
  if (failure === 'wrong-site') fetchMock.mockResolvedValueOnce(response({ ...snapshot, siteId: listId }))
  if (failure === 'wrong-identity') fetchMock.mockResolvedValueOnce(response({ ...snapshot, members: [{ ...snapshot.members[0], personId: '999' }] }))
  render(<Harness list={list} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load list members')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('Alice')).toBeInTheDocument()
})