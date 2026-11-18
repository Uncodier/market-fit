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
let authListener: (_event: string, session: { user: { id: string } } | null) => void

beforeEach(() => {
  jest.clearAllMocks()
  maybeSingle.mockResolvedValue({ data: parent, error: null })
  range.mockResolvedValue({ data: members, count: 3, error: null })
  ;(createClient as jest.Mock).mockReturnValue({ from, auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'actor-a' } } }, error: null }),
    onAuthStateChange: jest.fn(callback => {
      authListener = callback
      return { data: { subscription: { unsubscribe: jest.fn() } } }
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