export type InterventionRequestOptions = {
  conversation_title?: string
  lead_id?: string
  visitor_id?: string
  site_id?: string
  message_id?: string
}

export function buildInterventionRequestBody(
  conversationId: string,
  message: string,
  userId: string,
  agentId: string,
  options?: InterventionRequestOptions
) {
  return {
    conversationId,
    conversation_id: conversationId,
    message,
    user_id: userId,
    agentId,
    conversation_title: options?.conversation_title,
    lead_id: options?.lead_id,
    visitor_id: options?.visitor_id,
    site_id: options?.site_id,
    message_id: options?.message_id,
  }
}
