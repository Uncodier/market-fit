import { createClient } from "@/lib/supabase/client"
import { ChatMessage, Message } from "@/app/types/chat"

export async function getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const supabase = createClient()

    if (!conversationId || conversationId.startsWith("new-")) return []

    // Query 1: Get ALL pending messages first (no limit to ensure we get all pending)
    const { data: pendingData, error: pendingError } = await supabase
      .from("messages")
      .select(`
        id,
        role,
        content,
        created_at,
        updated_at,
        user_id,
        agent_id,
        visitor_id,
        lead_id,
        command_id,
        custom_data
      `)
      .eq("conversation_id", conversationId)
      .eq("custom_data->>status", "pending")
      .order("created_at", { ascending: true })
      .limit(1000) // High limit to get all pending messages

    if (pendingError) {
      console.error("❌ Error fetching pending messages:", pendingError)
    } else {
      console.log(`✅ Pending query: Found ${pendingData?.length || 0} pending messages`)
    }

    // Query 2: Get non-pending messages (limit to 40 for initial load)
    const { data: nonPendingData, error: nonPendingError } = await supabase
      .from("messages")
      .select(`
        id,
        role,
        content,
        created_at,
        updated_at,
        user_id,
        agent_id,
        visitor_id,
        lead_id,
        command_id,
        custom_data
      `)
      .eq("conversation_id", conversationId)
      .or("custom_data->>status.neq.pending,custom_data->>status.is.null")
      .order("created_at", { ascending: true })
      .limit(40) // Limit non-pending to 40 for initial load

    if (nonPendingError) {
      console.error("❌ Error fetching non-pending messages:", nonPendingError)
    } else {
      console.log(`✅ Non-pending query: Found ${nonPendingData?.length || 0} non-pending messages`)
    }

    if (pendingError || nonPendingError) {
      console.error("❌ Error fetching messages:", pendingError || nonPendingError)
      return []
    }

    // Combine: pending messages first, then non-pending messages. Deduplicate by id
    // in case a message appears in both queries (e.g. status transition or filter edge case).
    const pendingMessages = pendingData || []
    const nonPendingMessages = nonPendingData || []
    const seenIds = new Set<string>()
    const combined: typeof pendingMessages = []
    for (const m of pendingMessages) {
      if (m?.id && !seenIds.has(m.id)) {
        seenIds.add(m.id)
        combined.push(m)
      }
    }
    for (const m of nonPendingMessages) {
      if (m?.id && !seenIds.has(m.id)) {
        seenIds.add(m.id)
        combined.push(m)
      }
    }
    const sorted = combined

    // Debug logging to help identify ordering issues
    console.log(`🔍 [getConversationMessages] Conversation ${conversationId}:`)
    console.log(`📊 Pending messages: ${pendingMessages.length}`)
    console.log(`📊 Non-pending messages: ${nonPendingMessages.length}`)
    console.log(`📊 Total messages: ${sorted.length}`)
    if (sorted.length > 0) {
      console.log(`⏰ First message: ${sorted[0].created_at} (${sorted[0].role})`)
      console.log(`⏰ Last message: ${sorted[sorted.length - 1].created_at} (${sorted[sorted.length - 1].role})`)
      console.log(`📝 Message order:`, sorted.map((msg, index) => `${index + 1}. ${msg.role} at ${msg.created_at}`).slice(0, 5))
      
      // Debug role and user_id mapping
      console.log(`🔍 [Role & User ID Debug]:`)
      sorted.slice(0, 3).forEach((msg, index) => {
        console.log(`  Message ${index + 1}:`, {
          id: msg.id?.substring(0, 8),
          role: msg.role,
          user_id: msg.user_id,
          agent_id: msg.agent_id,
          visitor_id: msg.visitor_id,
          content: msg.content?.substring(0, 20) + '...'
        })
      })
    }

    // Minimal conversion matching chat-service's convertMessagesToChatFormat
    return sorted.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      text: msg.content,
      timestamp: new Date(msg.created_at),
      metadata: msg.custom_data || undefined,
      command_id: msg.command_id || undefined,
      sender_id: msg.user_id || msg.agent_id || msg.visitor_id || undefined,
      sender_name: msg.custom_data?.user_name || msg.custom_data?.sender_name,
      sender_avatar: msg.custom_data?.avatar_url || msg.custom_data?.sender_avatar,
      agent_id: msg.agent_id || undefined
    }))
  } catch (e) {
    console.error("getConversationMessages (client) error:", e)
    return []
  }
}




