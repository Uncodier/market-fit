export type InterventionRequestOptions = {
  conversation_title?: string
  lead_id?: string
  visitor_id?: string
  site_id?: string
  message_id?: string
}

export type InterventionChannelSend = {
  success?: boolean
  method?: string
  workflowId?: string
  error?: string
}

export type InterventionAcceptedResponse = {
  success?: boolean
  data?: {
    conversation_id?: string
    message?: { message_id?: string }
    channel_send?: InterventionChannelSend
  }
}

/**
 * 2xx means the API accepted the row. Only treat as a client-side fail when
 * Temporal never started (missing contact or start rejected before a workflowId).
 */
export function shouldTreatInterventionAsFailed(responseData: InterventionAcceptedResponse | null | undefined): boolean {
  const channelSend = responseData?.data?.channel_send
  if (!channelSend) return false
  if (channelSend.success === true) return false
  if (channelSend.method === "none") return false
  return !channelSend.workflowId
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
