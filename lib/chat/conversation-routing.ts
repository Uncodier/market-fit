type ConversationRoutingData = {
  channel?: unknown
  lead_id?: unknown
  visitor_id?: unknown
  custom_data?: unknown
}

function metadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function conversationChannel(conversation: ConversationRoutingData): string {
  const custom = metadata(conversation.custom_data)
  const raw = conversation.channel || custom.channel || custom.source
  const channel = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (channel === 'website_chat') return 'web'
  if (channel === 'zavu_inbound_voice' || channel === 'zavu_outbound_voice') return 'voice'
  if (!channel && custom.voice_mode === 'agent_call') return 'voice'
  return channel || 'web'
}

/** Missing contact links do not turn an external conversation into an internal agent chat. */
export function isInternalAgentConversation(conversation: ConversationRoutingData): boolean {
  const custom = metadata(conversation.custom_data)
  return conversationChannel(conversation) === 'web' &&
    (custom.is_private === true || (!conversation.lead_id && !conversation.visitor_id)) &&
    custom.channel_delivery !== true && custom.voice_mode !== 'agent_call'
}

export const VOICE_LEAD_REQUIRED = 'No call started. Link this conversation to a lead with a phone number and call consent before calling.'