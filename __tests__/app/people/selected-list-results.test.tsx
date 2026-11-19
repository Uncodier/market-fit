import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SelectedListResults } from '@/app/people/selected-list-results'
import { createClient } from '@/lib/supabase/client'
import { deferred } from './test-helpers'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))

const list = { id: 'list-a', siteId: 'site-a' }
const parent = { id: list.id, name: 'Processed selection', status: 'completed', icp_criteria: { source: 'selected_people' } }
const members = [
  { ordinal: 1, person_id: 'person-a', processing_status: 'completed', outcome: 'matched', leads: { id: 'lead-a', name: 'Alice', email: null } },
  { ordinal: 2, person_id: 'person-b', processing_status: 'completed', outcome: 'no_match', leads: null },
  { ordinal: 3, person_id: 'person-c', processing_status: 'completed', outcome: 'needs_review', leads: null },
]
const maybeSingle = jest.fn()
const range = jest.fn()
const eq = jest.fn().mockReturnThis()
const select = jest.fn().mockReturnThis()
const order = jest.fn().mockReturnThis()
const from = jest.fn(() => ({ select, eq, order, range, maybeSingle }))
const actorSession = { user: { id: 'actor-a' } }
const getSession = jest.fn()
let authListener: (_event: string, session: { user: { id: string } } | null) => void

beforeEach(() => {
  jest.clearAllMocks()
  maybeSingle.mockReset().mockResolvedValue({ data: parent, error: null })
  range.mockReset().mockResolvedValue({ data: members, count: 3, error: null })
  getSession.mockReset().mockResolvedValue({ data: { session: actorSession }, error: null })
  ;(createClient as jest.Mock).mockReturnValue({ from, auth: {
    getSession,
    onAuthStateChange: jest.fn(callback => {
      authListener = callback
      let subscribed = true
      // Supabase emits INITIAL_SESSION asynchronously for every subscription.
      void Promise.resolve().then(() => { if (subscribed) callback('INITIAL_SESSION', actorSession) })
      return { data: { subscription: { unsubscribe: jest.fn(() => { subscribed = false }) } } }
    }),
  } })
})

it('opens completed lists with real outcomes and links only accessible generated leads', async () => {
  render(<SelectedListResults list={list} onClose={jest.fn()} />)
  expect(await screen.findByText('Alice')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('List status: Completed · 3 selected people')
  expect(screen.getByText('No match')).toBeInTheDocument()
  expect(screen.getByText('Needs review')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'View lead' })).toHaveAttribute('href', '/leads/lead-a')
  expect(eq).toHaveBeenCalledWith('site_id', 'site-a')
  expect(eq).toHaveBeenCalledWith('icp_mining_id', 'list-a')
  expect(range).toHaveBeenCalledWith(0, 24)
})

it('shows pending members rather than assuming the whole list is completed', async () => {
  maybeSingle.mockResolvedValue({ data: { ...parent, status: 'running' }, error: null })
  range.mockResolvedValue({ data: [{ ...members[0], leads: null, processing_status: 'pending', outcome: null }], count: 1, error: null })
  render(<SelectedListResults list={list} onClose={jest.fn()} />)
  expect(await screen.findByText('Pending')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('In Progress')
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

it('fails closed for an RLS-hidden parent without fetching members', async () => {
  maybeSingle.mockResolvedValue({ data: null, error: null })
  render(<SelectedListResults list={list} onClose={jest.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load list members')
  expect(from).not.toHaveBeenCalledWith('icp_mining_people')
})

it('keeps database failures visible and allows a fresh retry', async () => {
  range.mockResolvedValueOnce({ data: null, count: null, error: { message: 'Unavailable' } })
  render(<SelectedListResults list={list} onClose={jest.fn()} />)
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('Alice')).toBeInTheDocument()
})

it('paginates persisted members instead of requesting provider search', async () => {
  range.mockResolvedValue({ data: members, count: 26, error: null })
  render(<SelectedListResults list={list} onClose={jest.fn()} />)
  await screen.findByText('Alice')
  fireEvent.click(screen.getByRole('button', { name: /next/i }))
  await waitFor(() => expect(range).toHaveBeenCalledWith(25, 49))
  await screen.findByText('Alice')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it.each(['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'])('loads the list when %s reports the same user during session resolution', async event => {
  const pending = deferred<{ data: { session: typeof actorSession }; error: null }>()
  getSession.mockReturnValueOnce(pending.promise)
  render(<SelectedListResults list={list} onClose={jest.fn()} />)
  act(() => authListener(event, actorSession))
  await act(async () => pending.resolve({ data: { session: actorSession }, error: null }))
  expect(await screen.findByText('Alice')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('refreshes a pregenerated list despite a new initial-session notification', async () => {
  render(<SelectedListResults list={list} onClose={jest.fn()} />)
  await screen.findByText('Alice')
  maybeSingle.mockResolvedValue({ data: { ...parent, name: 'Refreshed selection' }, error: null })
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(await screen.findByText('Refreshed selection')).toBeInTheDocument()
  expect(range).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('keeps an in-flight member read on token refresh for the same user', async () => {
  const pending = deferred<{ data: typeof members; count: number; error: null }>()
  range.mockReturnValueOnce(pending.promise)
  render(<SelectedListResults list={list} onClose={jest.fn()} />)
  await waitFor(() => expect(range).toHaveBeenCalled())
  act(() => authListener('TOKEN_REFRESHED', actorSession))
  await act(async () => pending.resolve({ data: members, count: 3, error: null }))
  expect(await screen.findByText('Alice')).toBeInTheDocument()
})

it.each(['SIGNED_OUT', 'SIGNED_IN', 'switch-back'])('rejects stale session resolution after %s changes identity', async event => {
  const pending = deferred<{ data: { session: typeof actorSession }; error: null }>()
  getSession.mockReturnValueOnce(pending.promise)
  render(<SelectedListResults list={list} onClose={jest.fn()} />)
  await act(async () => { await Promise.resolve() })
  act(() => {
    authListener(event === 'SIGNED_OUT' ? 'SIGNED_OUT' : 'SIGNED_IN', event === 'SIGNED_OUT' ? null : { user: { id: 'actor-b' } })
    if (event === 'switch-back') authListener('SIGNED_IN', actorSession)
  })
  await act(async () => pending.resolve({ data: { session: actorSession }, error: null }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Your session changed')
  expect(from).not.toHaveBeenCalled()
  expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled()
})

it('clears already visible members immediately on sign-out', async () => {
  render(<SelectedListResults list={list} onClose={jest.fn()} />)
  await screen.findByText('Alice')
  act(() => authListener('SIGNED_OUT', null))
  expect(screen.getByRole('alert')).toHaveTextContent('Your session changed')
  expect(screen.queryByText('Alice')).not.toBeInTheDocument()
})

it('discards an in-flight read and visible data when authenticated identity changes', async () => {
  const pending = deferred<{ data: typeof members; count: number; error: null }>()
  range.mockReturnValueOnce(pending.promise)
  render(<SelectedListResults list={list} onClose={jest.fn()} />)
  await waitFor(() => expect(range).toHaveBeenCalled())
  act(() => authListener('SIGNED_IN', { user: { id: 'actor-b' } }))
  await act(async () => pending.resolve({ data: members, count: 3, error: null }))
  expect(screen.getByRole('alert')).toHaveTextContent('Your session changed')
  expect(screen.queryByText('Alice')).not.toBeInTheDocument()
})

it('does not publish a late response from a previous site', async () => {
  const pending = deferred<{ data: typeof members; count: number; error: null }>()
  range.mockReturnValueOnce(pending.promise)
  const { rerender } = render(<SelectedListResults list={list} onClose={jest.fn()} />)
  await waitFor(() => expect(range).toHaveBeenCalled())
  maybeSingle.mockResolvedValue({ data: { ...parent, name: 'Other site' }, error: null })
  range.mockResolvedValue({ data: [], count: 0, error: null })
  rerender(<SelectedListResults list={{ id: 'list-b', siteId: 'site-b' }} onClose={jest.fn()} />)
  await screen.findByText('Other site')
  await act(async () => pending.resolve({ data: members, count: 3, error: null }))
  expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  expect(screen.getByText('No selected people in this list.')).toBeInTheDocument()
})