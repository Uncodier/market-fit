import { act, renderHook, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import type { ReactNode } from 'react'
import { useLeadData } from '@/app/hooks/useLeadData'

const maybeSingle = jest.fn()
const eq = jest.fn()
const select = jest.fn()
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: () => ({ select }) }) }))
jest.mock('@/app/services/user-service', () => ({ getUserData: jest.fn() }))

function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>{children}</SWRConfig>
}

beforeEach(() => {
  jest.clearAllMocks()
  select.mockReturnValue({ eq })
  eq.mockReturnValue({ eq, maybeSingle })
  window.history.replaceState(null, '', '/chat')
})

it('treats a voice conversation without a lead or visitor as external, even with a private URL mode', async () => {
  window.history.replaceState(null, '', '/chat?mode=private')
  maybeSingle.mockResolvedValue({ data: { channel: 'voice', lead_id: null, visitor_id: null, leads: null }, error: null })
  const { result } = renderHook(() => useLeadData('conversation-voice', 'site-1'), { wrapper })
  await waitFor(() => expect(result.current.isConversationReady).toBe(true))
  expect(result.current.isAgentOnlyConversation).toBe(false)
  expect(result.current.conversationChannel).toBe('voice')
  expect(result.current.leadData).toBeNull()
  expect(eq).toHaveBeenCalledWith('site_id', 'site-1')
})

it('does not retain internal routing while another conversation is loading', async () => {
  maybeSingle.mockResolvedValueOnce({ data: { channel: 'web', lead_id: null, visitor_id: null }, error: null })
  const { result, rerender } = renderHook(({ id }) => useLeadData(id, 'site-1'), {
    wrapper, initialProps: { id: 'internal' },
  })
  await waitFor(() => expect(result.current.isAgentOnlyConversation).toBe(true))
  let resolve!: (value: unknown) => void
  maybeSingle.mockReturnValueOnce(new Promise(done => { resolve = done }))
  rerender({ id: 'voice' })
  expect(result.current.isConversationReady).toBe(false)
  expect(result.current.isAgentOnlyConversation).toBe(false)
  await act(async () => {
    resolve({ data: { channel: 'voice', lead_id: null, visitor_id: null }, error: null })
  })
  await waitFor(() => expect(result.current.isConversationReady).toBe(true))
  expect(result.current.isAgentOnlyConversation).toBe(false)
})

it('preserves an explicitly private web discussion from persisted data', async () => {
  maybeSingle.mockResolvedValue({ data: { channel: 'web', custom_data: { is_private: true }, lead_id: null, visitor_id: 'legacy-visitor' }, error: null })
  const { result } = renderHook(() => useLeadData('private', 'site-1'), { wrapper })
  await waitFor(() => expect(result.current.isConversationReady).toBe(true))
  expect(result.current.isAgentOnlyConversation).toBe(true)
})

it.each([
  { data: null, error: null },
  { data: null, error: { message: 'lookup failed' } },
])('never reports a missing or failed conversation lookup as ready', async response => {
  maybeSingle.mockResolvedValueOnce(response)
  const { result } = renderHook(() => useLeadData('missing', 'site-1'), { wrapper })
  await waitFor(() => expect(result.current.isLoadingLead).toBe(false))
  expect(result.current.isConversationReady).toBe(false)
  expect(result.current.isAgentOnlyConversation).toBe(false)
})