import type { InterventionAcceptedResponse, InterventionRequestOptions } from "@/app/services/intervention-request"
import { buildInterventionRequestBody } from "@/app/services/intervention-request"
import { InterventionRequestError } from "@/app/services/mark-intervention-message-failed"
import { isInterventionDeliveryUnconfirmed, shouldTreatInterventionAsFailed } from "@/app/services/intervention-request"

/**
 * Sends a team member intervention message in a conversation
 */
export async function sendTeamMemberIntervention(
  conversationId: string,
  message: string,
  userId: string,
  agentId: string,
  options?: InterventionRequestOptions
): Promise<InterventionAcceptedResponse> {
  // The server validates the session and conversation before forwarding to the API.
  const API_URL = '/api/agents/chat/intervention';
  
  const requestBody = buildInterventionRequestBody(
    conversationId,
    message,
    userId,
    agentId,
    options
  );
  
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }

    // Single fetch attempt
    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(120_000),
    });
    
    if (!response.ok) {
      let errorMsg = `Error sending intervention: ${response.status} ${response.statusText}`;
      const errorData = await response.json().catch(() => null);
      if (errorData) {
        errorMsg = errorData.error?.message || (typeof errorData.error === 'string' ? errorData.error : undefined) || errorData.message || errorMsg;
      }
      const started = errorData?.data?.channel_send
      const unconfirmed = started?.callId || started?.workflowId || started?.workflow_id || started?.workflowRunId || started?.run_id || started?.delivery_status === 'placement_unknown'
      const definitelyNotStarted = errorData?.execution_started === false || errorData?.data?.execution_started === false
      throw new InterventionRequestError(errorMsg, {
        message_id: unconfirmed || !definitelyNotStarted ? undefined : errorData?.data?.message_id || errorData?.message_id,
        conversation_id: errorData?.data?.conversation_id || errorData?.conversation_id,
      });
    }
    
    const responseData = await response.json().catch(() => null);
    if (responseData?.success !== true || !responseData?.data?.message?.message_id) {
      throw new InterventionRequestError('Delivery could not be confirmed. Check the conversation before retrying.');
    }
    if (isInterventionDeliveryUnconfirmed(responseData)) {
      throw new InterventionRequestError('Call placement is unconfirmed. Check the conversation before retrying.', {
        saved_message_id: responseData.data.message.message_id,
        conversation_id: responseData.data.conversation_id,
      });
    }

    if (shouldTreatInterventionAsFailed(responseData)) {
      throw new InterventionRequestError(
        responseData?.data?.channel_send?.error || "Delivery was not started",
        {
          message_id: responseData?.data?.message?.message_id,
          conversation_id: responseData?.data?.conversation_id,
        }
      );
    }

    return responseData;
  } catch (error) {
    throw error;
  }
}

/**
 * Sends a direct message to an agent in a conversation
 */
export async function sendAgentMessage(
  conversationId: string,
  message: string,
  _agentId: string,
  options: {
    site_id: string,
    lead_id?: string,
    visitor_id?: string,
    team_member_id: string
  }
): Promise<{
  success?: boolean
  data?: { messages?: { assistant?: { message_id?: string; content: string } } }
}> {
  // Preserve the caller signature, but derive all author/agent identities on the server.
  const response = await fetch('/api/agents/chat/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ conversationId, message, site_id: options.site_id }),
    signal: AbortSignal.timeout(120_000),
  })
  const responseData = await response.json().catch(() => null)
  if (!response.ok) {
    const error = responseData?.error
    const message = typeof error === 'string' ? error : error?.message
    throw new Error(typeof message === 'string' ? message : `Error sending agent message: ${response.status}`)
  }
  const assistant = responseData?.data?.messages?.assistant
  if (responseData?.success !== true || typeof assistant?.message_id !== 'string' || !assistant.message_id ||
    typeof assistant.content !== 'string' || !assistant.content) {
    throw new Error('Message acceptance could not be confirmed. Check the conversation before retrying.')
  }
  return responseData
}
