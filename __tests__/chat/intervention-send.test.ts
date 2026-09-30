/** @jest-environment node */

import { sendTeamMemberIntervention } from '@/app/services/chat-send'
import { interventionErrorMessageId, interventionSavedMessageId } from '@/app/services/mark-intervention-message-failed'

jest.mock('@/app/services/chat-runtime', () => ({ FULL_API_SERVER_URL: 'https://external.example.test' }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

function send() {
  return sendTeamMemberIntervention('conversation-1', 'Opening greeting', 'user-1', 'agent-1', { site_id: 'site-1' })
}

function accepted(channel_send: Record<string, unknown> = {}) {
  return { success: true, data: { conversation_id: 'conversation-1', message: { message_id: 'message-1' }, channel_send } }
}

beforeEach(() => jest.mocked(fetch).mockReset())

it('sends through the same-origin authenticated proxy once and accepts a voice call ID', async () => {
  const response = accepted({ success: true, method: 'voice_agent_call', callId: 'call-1' })
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(response))
  await expect(send()).resolves.toEqual(response)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('/api/agents/chat/intervention', expect.objectContaining({
    method: 'POST', credentials: 'same-origin', signal: expect.any(AbortSignal),
  }))
})

it.each([null, {}, { success: true }, { success: false }])('does not fabricate acceptance for malformed success: %j', async body => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(body))
  await expect(send()).rejects.toThrow('could not be confirmed')
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('does not fabricate acceptance for a non-JSON response', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(new Response('html'))
  await expect(send()).rejects.toThrow('could not be confirmed')
})

it('exposes the saved row on a definite delivery rejection', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(accepted({ success: false, method: 'voice_agent_call', error: 'Consent is required' })))
  const error = await send().catch(error => error)
  expect(error.message).toBe('Consent is required')
  expect(interventionErrorMessageId(error)).toBe('message-1')
})

it('does not mark an ambiguous placement failed or replay the request', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(accepted({ success: false, method: 'voice_agent_call', delivery_status: 'placement_unknown' })))
  const error = await send().catch(error => error)
  expect(error.message).toContain('unconfirmed')
  expect(interventionErrorMessageId(error)).toBeUndefined()
  expect(interventionSavedMessageId(error)).toBe('message-1')
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('preserves a known call acceptance even if a later step reports failure', async () => {
  const response = accepted({ success: false, method: 'voice_agent_call', callId: 'call-1' })
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(response))
  await expect(send()).resolves.toEqual(response)
})

it('handles authentication errors and definite post-save HTTP failures', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ error: 'Unauthorized' }, { status: 401 }))
  await expect(send()).rejects.toThrow('Unauthorized')
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ success: false,
    execution_started: false,
    data: { message_id: 'message-1', conversation_id: 'conversation-1' }, error: { message: 'Workflow unavailable' },
  }, { status: 500 }))
  expect(interventionErrorMessageId(await send().catch(error => error))).toBe('message-1')
})

it('does not infer non-start from a saved ID on an unspecified server error', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ success: false,
    data: { message_id: 'message-1', conversation_id: 'conversation-1' },
  }, { status: 500 }))
  expect(interventionErrorMessageId(await send().catch(error => error))).toBeUndefined()
})

it('does not infer failure from a gateway error after a call was already placed', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ success: false,
    data: { message_id: 'message-1', channel_send: { callId: 'call-1' } },
  }, { status: 500 }))
  expect(interventionErrorMessageId(await send().catch(error => error))).toBeUndefined()
})

it('never automatically retries a network failure', async () => {
  jest.mocked(fetch).mockRejectedValueOnce(new Error('Failed to fetch'))
  expect(interventionErrorMessageId(await send().catch(error => error))).toBeUndefined()
  expect(fetch).toHaveBeenCalledTimes(1)
})