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
  workflow_id?: string
  workflowRunId?: string
  run_id?: string
  callId?: string
  delivery_status?: string
  error?: string
}

export type InterventionAcceptedResponse = {
  success?: boolean
  data?: {
    conversation_id?: string
    message?: {
      message_id?: string
      content?: string
      created_at?: string
      custom_data?: Record<string, unknown> | null
    }
    channel_send?: InterventionChannelSend
  }
}

/**
 * 2xx means the API accepted the row. Only treat as a client-side fail when
 * Delivery never started. Voice uses a provider call ID rather than Temporal.
 */
export function shouldTreatInterventionAsFailed(responseData: InterventionAcceptedResponse | null | undefined): boolean {
  const channelSend = responseData?.data?.channel_send
  if (!channelSend) return false
  if (channelSend.callId || channelSend.delivery_status === 'placement_unknown') return false
  if (channelSend.success === true) return false
  if (channelSend.method === "none") return false
  return !getInterventionWorkflowId(channelSend)
}

export function isInterventionDeliveryUnconfirmed(responseData: InterventionAcceptedResponse): boolean {
  return responseData.data?.channel_send?.delivery_status === 'placement_unknown'
}

export function getInterventionWorkflowId(channelSend?: InterventionChannelSend): string | undefined {
  return channelSend?.workflowId || channelSend?.workflow_id || channelSend?.workflowRunId || channelSend?.run_id
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
