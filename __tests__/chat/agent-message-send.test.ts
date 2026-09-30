/** @jest-environment node */

import { sendAgentMessage } from '@/app/services/chat-send'

jest.mock('@/app/services/chat-runtime', () => ({ FULL_API_SERVER_URL: 'https://external.example.test' }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

const accepted = { success: true, data: { messages: { assistant: { message_id: 'message-1', content: 'Hello' } } } }
const send = () => sendAgentMessage('conversation-1', 'Private draft', 'agent-1', {
  site_id: 'site-1', team_member_id: 'user-1',
})

beforeEach(() => {
  jest.mocked(fetch).mockReset()
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => jest.restoreAllMocks())

it('uses the authenticated same-origin route, not an anonymous external request', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(accepted))
  await expect(send()).resolves.toEqual(accepted)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('/api/agents/chat/message', expect.objectContaining({
    method: 'POST', credentials: 'same-origin', signal: expect.any(AbortSignal),
    body: JSON.stringify({ conversationId: 'conversation-1', message: 'Private draft', site_id: 'site-1' }),
  }))
  expect(jest.mocked(fetch).mock.calls[0][1]?.headers).toEqual({
    'Content-Type': 'application/json', Accept: 'application/json',
  })
  expect(console.log).not.toHaveBeenCalled()
})

it.each([
  { error: { code: 'UNAUTHORIZED', message: 'Please sign in again.' } },
  { error: 'Please sign in again.' },
])('extracts a readable auth error instead of coercing an object: %j', async body => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(body, { status: 401 }))
  await expect(send()).rejects.toThrow('Please sign in again.')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(console.error).not.toHaveBeenCalled()
})

it.each([null, {}, { success: true }, { success: false }, {
  success: true, data: { messages: { assistant: { content: 'Not saved' } } },
}])('does not fabricate acceptance for an incomplete response: %j', async body => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(body))
  await expect(send()).rejects.toThrow('could not be confirmed')
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('does not fabricate success for HTML or automatically replay a network failure', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(new Response('<html>Gateway error</html>'))
  await expect(send()).rejects.toThrow('could not be confirmed')
  jest.mocked(fetch).mockRejectedValueOnce(new Error('Network unavailable'))
  await expect(send()).rejects.toThrow('Network unavailable')
  expect(fetch).toHaveBeenCalledTimes(2)
})