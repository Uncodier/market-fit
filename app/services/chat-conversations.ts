import type { ConversationWithMessages } from "@/app/types/chat"
import { supabase } from "./chat-runtime"
import type { CommunicationChannel } from "@/lib/site-channels"
import type { Conversation } from "@/app/types/chat"
import { generateUUID } from "./chat-runtime"
import { createClient } from "@/lib/supabase/client"

/**
 * Get a single conversation with all its messages
 */
export async function getConversation(conversationId: string): Promise<ConversationWithMessages | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select(`
      *,
      messages (
        *
      )
    `)
    .eq("id", conversationId)
    .single()

  if (error) {
    console.error("Error fetching conversation:", error)
    return null
  }

  return data
}

/**
 * Create a new conversation
 */
export async function createConversation(
  siteId: string,
  userId: string,
  agentId: string,
  title: string,
  options?: {
    lead_id?: string;
    is_private?: boolean;
    visitor_id?: string;
    status?: string;
    is_agent_conversation?: boolean; // New flag to indicate this is just an agent conversation
    channel?: CommunicationChannel;
  }
): Promise<Conversation | null> {
  console.log("==== createConversation called ====");
  console.log("Parameters received:");
  console.log("- siteId:", siteId);
  console.log("- userId:", userId);
  console.log("- agentId:", agentId);
  console.log("- title:", title);
  console.log("- options:", options);
  
  // Validate parameters
  if (!siteId) {
    console.error("ERROR: siteId is required");
    return null;
  }
  
  if (!userId) {
    console.error("ERROR: userId is required");
    return null;
  }
  
  if (!agentId) {
    console.error("ERROR: agentId is required");
    return null;
  }
  
  try {
    console.log("Building conversation data...");
    
    // Build conversation data with all required fields
    const conversationData: any = {
      site_id: siteId,
      user_id: userId,
      agent_id: agentId,
      title: title,
      status: options?.status || 'active',
      is_archived: false,
      // Set current timestamp for these fields
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_message_at: new Date().toISOString()
    };

    // Add optional fields if provided
    if (options) {
      if (options.lead_id) {
        conversationData.lead_id = options.lead_id;
      }
      
      // For agent conversations, skip visitor_id generation completely
      if (options.is_agent_conversation) {
        console.log("This is an agent conversation - no visitor_id needed");
        // Explicitly set visitor_id to null for agent conversations
        // to ensure it's not required by the database
        conversationData.visitor_id = null;
      } else if (options.visitor_id) {
        // Make sure the visitor_id is a valid UUID
        // If it looks like a UUID, use it directly
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(options.visitor_id)) {
          conversationData.visitor_id = options.visitor_id;
        } else {
          // Otherwise, generate a new UUID
          console.warn("Provided visitor_id is not a valid UUID - generating a UUID instead");
          conversationData.visitor_id = generateUUID();
        }
      } else if (!options.lead_id && !options.is_agent_conversation) {
        // Only generate visitor_id if no lead_id is provided
        // No need to add visitor_id for conversations with agents or teams
        console.warn("No visitor_id provided and no lead_id - generating a UUID");
        conversationData.visitor_id = generateUUID();
      }
      
      if (options.is_private) {
        conversationData.is_private = options.is_private;
      }
    } else if (!conversationData.lead_id) {
      // This could be an agent conversation but no options were specified
      // Let's still generate a UUID for backwards compatibility but log a warning
      console.warn("No options provided - generating a UUID visitor_id for backward compatibility");
      conversationData.visitor_id = generateUUID();
    }

    console.log("Submitting conversation data to database:", conversationData);
    
    // Try to log the Supabase instance state
    console.log("Supabase client status:", 
      supabase ? "initialized" : "not initialized"
    );

    console.log("Performing database insert operation...");
    const { data, error } = await supabase
      .from("conversations")
      .insert(conversationData)
      .select()
      .single();

    if (error) {
      console.error("===== ERROR CREATING CONVERSATION =====");
      console.error("Database error:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      console.error("Error details:", error.details);
      console.error("Error hint:", error.hint);
      console.error("Data being inserted:", conversationData);
      return null;
    }

    console.log("Successfully created conversation:", data);
    return data;
  } catch (error) {
    console.error("===== UNEXPECTED ERROR IN createConversation =====");
    console.error("Error:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace available");
    return null;
  } finally {
    console.log("==== createConversation completed ====");
  }
}

/**
 * Helper function to set conversation channel (for testing and migration purposes)
 */
export async function setConversationChannel(
  conversationId: string,
  channel: CommunicationChannel
): Promise<boolean> {
  try {
    const supabase = createClient();
    
    // Get current custom_data
    const { data: conversation, error: fetchError } = await supabase
      .from("conversations")
      .select("custom_data")
      .eq("id", conversationId)
      .single();
      
    if (fetchError) {
      console.error("Error fetching conversation:", fetchError);
      return false;
    }
    
    const existingCustomData = conversation?.custom_data || {};
    const updatedCustomData = {
      ...existingCustomData,
      channel: channel
    };
    
    const { error: updateError } = await supabase
      .from("conversations")
      .update({ custom_data: updatedCustomData })
      .eq("id", conversationId);
      
    if (updateError) {
      console.error("Error updating conversation channel:", updateError);
      return false;
    }
    
    console.log(`Successfully set conversation ${conversationId} channel to ${channel}`);
    return true;
  } catch (error) {
    console.error("Unexpected error setting conversation channel:", error);
    return false;
  }
}
