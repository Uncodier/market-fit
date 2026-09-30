"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Get conversations for a lead
 */
export async function getLeadConversations(siteId: string, leadId: string) {
  try {
    const supabase = await createClient();

    // Fetch conversations from the database with specific filters including channel and status
    const { data, error } = await supabase
      .from("conversations")
      .select(`
        id,
        title,
        channel,
        custom_data,
        status,
        last_message_at,
        created_at,
        messages (
          content,
          created_at,
          role
        )
      `)
      .eq('site_id', siteId)
      .eq('lead_id', leadId)
      .eq('is_archived', false)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching lead conversations:", error);
      return { error: error.message };
    }

    if (!data || data.length === 0) {
      return { conversations: [] };
    }
    
    // Transform the data to match the Conversation interface needed by the component
    const conversations = data.map((item: {
      id: string
      title: string | null
      channel: string | null
      custom_data: any
      status: string | null
      last_message_at: string | null
      created_at: string
      messages?: Array<{
        content: string
        created_at: string
        role: string
      }> | null
    }) => {
      // Get the last message content if available from the nested messages
      const lastMessageContent = item.messages && item.messages.length > 0 
        ? item.messages[item.messages.length - 1].content 
        : '';
      
      // Get channel from direct field or custom_data, default to 'web'
      let channel = item.channel || item.custom_data?.channel || 'web';
      
      // Normalize website_chat to web since they are the same
      if (channel === 'website_chat') {
        channel = 'web';
      }
      
      // Get status from database, default to 'active'
      const status = item.status || 'active';
      
      return {
        id: item.id,
        channel: channel as 'web' | 'email' | 'whatsapp',
        subject: item.title || 'No Subject',
        message: lastMessageContent || '',
        date: item.last_message_at || item.created_at,
        status: status as 'pending' | 'active' | 'closed' | 'archived'
      };
    });

    return { conversations };
  } catch (error) {
    console.error("Error in getLeadConversations:", error);
    return { error: "Failed to fetch lead conversations", conversations: [] };
  }
}

