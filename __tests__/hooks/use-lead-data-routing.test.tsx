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

it('loads outbound-call eligibility and refreshes revoked consent without changing channels', async () => {
  const leads = {
    id: 'lead-1', name: 'Voice contact', site_id: 'site-1', phone: '+12025550123',
    do_not_call: false, voice_call_consent_status: 'granted', voice_call_consent_at: '2026-01-01T00:00:00Z',
  }
  const conversation = { channel: 'voice', lead_id: leads.id, leads }
  maybeSingle.mockResolvedValue({ data: conversation, error: null })
  const { result } = renderHook(() => useLeadData('voice', 'site-1'), { wrapper })
  await waitFor(() => expect(result.current.isConversationReady).toBe(true))
  expect(select.mock.calls[0][0]).toContain('voice_call_consent_status')
  expect(select.mock.calls[0][0]).toContain('voice_call_consent_at')
  expect(select.mock.calls[0][0]).toContain('do_not_call')
  expect(result.current.leadData).toMatchObject(leads)
  maybeSingle.mockResolvedValue({ data: { ...conversation, leads: { ...leads, voice_call_consent_status: 'revoked' } }, error: null })
  await act(async () => { await result.current.refreshLeadData() })
  expect(result.current.leadData).toMatchObject({ voice_call_consent_status: 'revoked' })
  expect(result.current.conversationChannel).toBe('voice')
})

it.each([
  { data: null, error: null },
  { data: null, error: { message: 'lookup failed' } },
])('never reports a missing or failed conversation lookup as ready', async response => {
  maybeSingle.mockResolvedValueOnce(response)
  const { result } = renderHook(() => useLeadData('missing', 'site-1'), { wrapper })
  await waitFor(() => expect(result.current.isLoadingLead).toBe(false))
  expect(result.current.isConversationReady).toBe(false)
  expect(result.current.conversationLoadFailed).toBe(true)
  expect(result.current.isAgentOnlyConversation).toBe(false)
})

it('does not report a slow pending conversation as a failure before the request returns an error', async () => {
  jest.useFakeTimers()
  try {
    let finish!: (value: unknown) => void
    maybeSingle.mockReturnValueOnce(new Promise(done => { finish = done }))
    const { result } = renderHook(() => useLeadData('slow', 'site-1'), { wrapper })

    await act(async () => { await jest.advanceTimersByTimeAsync(60_000) })
    expect(maybeSingle).toHaveBeenCalledTimes(1)
    expect(result.current.isLoadingLead).toBe(true)
    expect(result.current.conversationLoadFailed).toBe(false)

    await act(async () => { finish({ data: null, error: { message: 'Lookup failed' } }) })
    expect(result.current.isLoadingLead).toBe(false)
    expect(result.current.conversationLoadFailed).toBe(true)
  } finally {
    jest.useRealTimers()
  }
})

it('keeps WhatsApp replies available when the optional visitor relationship fails', async () => {
  maybeSingle.mockResolvedValueOnce({ data: { channel: 'whatsapp', visitor_id: 'visitor-1' }, error: null })
  let resolveVisitor!: (value: unknown) => void
  maybeSingle.mockReturnValueOnce(new Promise(done => { resolveVisitor = done }))
  const { result } = renderHook(() => useLeadData('wa', 'site-1'), { wrapper })
  await waitFor(() => expect(maybeSingle).toHaveBeenCalledTimes(2))
  expect(select.mock.calls[0][0]).not.toContain('visitors')
  expect(select.mock.calls[1][0]).toBe('visitor:visitors!fk_visitor(custom_data)')
  expect(eq.mock.calls.slice(-3)).toEqual([['id', 'wa'], ['site_id', 'site-1'], ['visitor_id', 'visitor-1']])
  expect(result.current.isConversationReady).toBe(true)
  expect(result.current.isLoadingVisitorPhone).toBe(true)
  await act(async () => resolveVisitor({ data: null, error: { code: 'PGRST200' } }))
  expect(result.current.isConversationReady).toBe(true)
  expect(result.current.isLoadingVisitorPhone).toBe(false)
  expect(result.current.conversationLoadFailed).toBe(false)
  expect(result.current.conversationChannel).toBe('whatsapp')
  expect(result.current.visitorPhone).toBeUndefined()
})

it('keeps visitor phone metadata scoped when switching conversations', async () => {
  maybeSingle.mockResolvedValueOnce({ data: { channel: 'whatsapp', visitor_id: 'visitor-1' }, error: null })
    .mockResolvedValueOnce({ data: { visitor: { custom_data: { whatsapp_phone: '+12025550123' } } }, error: null })
    .mockResolvedValueOnce({ data: { channel: 'whatsapp', visitor_id: null }, error: null })
  const { result, rerender } = renderHook(({ id, site }) => useLeadData(id, site), {
    wrapper, initialProps: { id: 'wa', site: 'site-1' },
  })
  await waitFor(() => expect(result.current.visitorPhone).toBe('+12025550123'))
  rerender({ id: 'another', site: 'site-2' })
  expect(result.current.visitorPhone).toBeUndefined()
  await waitFor(() => expect(result.current.isConversationReady).toBe(true))
  expect(result.current.visitorPhone).toBeUndefined()
})

it('recovers reply access after retrying a failed conversation lookup', async () => {
  maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'Lookup failed' } })
    .mockResolvedValueOnce({ data: { channel: 'whatsapp' }, error: null })
  const { result } = renderHook(() => useLeadData('wa', 'site-1'), { wrapper })
  await waitFor(() => expect(result.current.conversationLoadFailed).toBe(true))
  expect(result.current.isConversationReady).toBe(false)
  await act(async () => { await result.current.refreshLeadData() })
  expect(result.current.conversationLoadFailed).toBe(false)
  expect(result.current.isConversationReady).toBe(true)
})

it('exposes DM identity without fabricating a linked lead, then honors the real linked lead', async () => {
  const conversation = {
    channel: 'instagram', lead_id: null, visitor_id: null, leads: null,
    custom_data: { source: 'outstand_dm', participant_display_name: 'Taylor', participant_profile_picture: 'https://example.com/taylor.jpg' },
  }
  maybeSingle.mockResolvedValue({ data: conversation, error: null })
  const { result } = renderHook(() => useLeadData('dm', 'site-1'), { wrapper })
  await waitFor(() => expect(result.current.isConversationReady).toBe(true))
  expect(result.current.isLead).toBe(false)
  expect(result.current.leadData).toBeNull()
  expect(result.current.participantIdentity).toEqual({ name: 'Taylor', avatarUrl: 'https://example.com/taylor.jpg', channel: 'instagram' })

  maybeSingle.mockResolvedValue({ data: { ...conversation, lead_id: 'lead-1', leads: { id: 'lead-1', name: 'Manual CRM name' } }, error: null })
  await act(async () => { await result.current.refreshLeadData() })
  expect(result.current.isLead).toBe(true)
  expect(result.current.leadData).toMatchObject({ id: 'lead-1', name: 'Manual CRM name', avatarUrl: 'https://example.com/taylor.jpg' })
  expect(result.current.participantIdentity?.name).toBe('Manual CRM name')
})

it('never leaks a previous DM identity while switching conversations or sites', async () => {
  maybeSingle.mockResolvedValue({ data: { channel: 'instagram', custom_data: { source: 'outstand_dm', participant_display_name: 'Taylor' } }, error: null })
  const { result, rerender } = renderHook(({ id, site }) => useLeadData(id, site), {
    wrapper, initialProps: { id: 'first', site: 'site-1' },
  })
  await waitFor(() => expect(result.current.participantIdentity?.name).toBe('Taylor'))
  let resolve!: (value: unknown) => void
  maybeSingle.mockReturnValueOnce(new Promise(done => { resolve = done }))
  rerender({ id: 'second', site: 'site-2' })
  expect(result.current.participantIdentity).toBeUndefined()
  await act(async () => { resolve({ data: { channel: 'instagram', custom_data: { participant_display_name: null } }, error: null }) })
  await waitFor(() => expect(result.current.participantIdentity?.name).toBe('Instagram contact'))
  expect(eq).toHaveBeenCalledWith('site_id', 'site-2')
})