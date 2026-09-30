import type { InterventionRequestOptions } from "@/app/services/intervention-request"
import { FULL_API_SERVER_URL } from "./chat-runtime"
import { buildInterventionRequestBody } from "@/app/services/intervention-request"
import { supabase } from "./chat-runtime"
import { createClient } from "@/lib/supabase/client"
import { InterventionRequestError } from "@/app/services/mark-intervention-message-failed"
import { shouldTreatInterventionAsFailed } from "@/app/services/intervention-request"

/**
 * Sends a team member intervention message in a conversation
 */
export async function sendTeamMemberIntervention(
  conversationId: string,
  message: string,
  userId: string,
  agentId: string,
  options?: InterventionRequestOptions
): Promise<any> {
  // Log the API URL being used
  const API_URL = `${FULL_API_SERVER_URL}/api/agents/chat/intervention`;
  console.log("Sending intervention to API URL:", API_URL);
  
  const requestBody = buildInterventionRequestBody(
    conversationId,
    message,
    userId,
    agentId,
    options
  );
  
  console.log("Intervention request payload:", JSON.stringify(requestBody));
  
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    }

    // Single fetch attempt
    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      mode: 'cors',
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      let errorMsg = `Error sending intervention: ${response.status} ${response.statusText}`;
      const errorData = await response.json().catch(() => null);
      if (errorData) {
        errorMsg = errorData.error?.message || errorData.message || errorMsg;
      }
      throw new InterventionRequestError(errorMsg, {
        message_id: errorData?.data?.message_id || errorData?.message_id,
        conversation_id: errorData?.data?.conversation_id || errorData?.conversation_id,
      });
    }
    
    const responseData = await response.json().catch(() => ({ success: true }));
    console.log("Intervention API response:", responseData);

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
    console.error('Error sending team member intervention:', error);
    console.error('API server URL configured as:', FULL_API_SERVER_URL);
    throw error;
  }
}

/**
 * Sends a direct message to an agent in a conversation
 */
export async function sendAgentMessage(
  conversationId: string,
  message: string,
  agentId: string,
  options: {
    site_id: string,
    lead_id?: string,
    visitor_id?: string,
    team_member_id: string
  }
): Promise<any> {
  // Log the API URL being used
  const API_URL = `${FULL_API_SERVER_URL}/api/agents/chat/message`;
  console.log("Sending message to agent at:", API_URL);
  
  const requestBody = {
    conversationId,
    message,
    agentId,
    site_id: options.site_id,
    lead_id: options.lead_id,
    visitor_id: options.visitor_id,
    team_member_id: options.team_member_id
  };
  
  console.log("Agent message request payload:", JSON.stringify(requestBody, null, 2));
  
  try {
    // Single POST request without any preflight checks
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify(requestBody),
    });
    
    console.log("Agent message API response status:", response.status, response.statusText);
    
    if (!response.ok) {
      let errorMsg = `Error sending agent message: ${response.status} ${response.statusText}`;
      const responseText = await response.text().catch(() => "Failed to get response text");
      console.error("Error response text:", responseText);
      
      try {
        const errorData = JSON.parse(responseText);
        console.error("Error response data:", errorData);
        errorMsg = errorData.message || errorData.error || errorMsg;
      } catch (jsonError) {
        console.error("Failed to parse error response as JSON:", jsonError);
      }
      
      throw new Error(errorMsg);
    }
    
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (jsonError) {
      console.warn("Failed to parse response as JSON, using default success response:", jsonError);
      responseData = { success: true, message: "Message sent (response not JSON)" };
    }
    
    console.log("Agent message API response data:", responseData);
    return responseData;
  } catch (error) {
    console.error('Error sending agent message:', error);
    console.error('API server URL configured as:', FULL_API_SERVER_URL);
    console.error('Network error - API server might be unavailable');
    throw error;
  }
}
