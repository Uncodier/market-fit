import { conversationChannel, isInternalAgentConversation } from '@/lib/chat/conversation-routing'

it.each(['voice', 'email', 'whatsapp', 'sms', 'telegram', 'instagram', 'messenger'])(
  'never routes a contactless %s conversation to the internal assistant', channel => {
    expect(isInternalAgentConversation({ channel, lead_id: null, visitor_id: null })).toBe(false)
  },
)

it.each([
  { channel: 'voice' },
  { custom_data: { channel: 'voice' } },
  { custom_data: { source: 'zavu_inbound_voice', voice_mode: 'agent_call' } },
])('detects direct and legacy voice metadata: %j', conversation => {
  expect(conversationChannel(conversation)).toBe('voice')
  expect(isInternalAgentConversation(conversation)).toBe(false)
})

it('preserves internal chats without contacts and never infers mode from a URL or title', () => {
  expect(isInternalAgentConversation({ channel: 'web', lead_id: null, visitor_id: null })).toBe(true)
  expect(isInternalAgentConversation({ lead_id: null, visitor_id: null })).toBe(true)
  expect(isInternalAgentConversation({ channel: 'website_chat', lead_id: 'lead', visitor_id: null })).toBe(false)
  expect(isInternalAgentConversation({ channel: 'web', visitor_id: 'visitor' })).toBe(false)
  expect(isInternalAgentConversation({ channel: 'web', custom_data: { channel_delivery: true } })).toBe(false)
  expect(isInternalAgentConversation({ channel: 'web', custom_data: { is_private: true }, visitor_id: 'legacy-private-visitor' })).toBe(true)
  expect(isInternalAgentConversation({ channel: 'voice', custom_data: { is_private: true } })).toBe(false)
})