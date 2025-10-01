import { createClient } from "@/lib/supabase/client"
import { ChatMessage, Message } from "@/app/types/chat"

export async function getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const supabase = createClient()

    if (!conversationId || conversationId.startsWith("new-")) return []

    const { data: conversation, error } = await supabase
      .from("conversations")
      .select(`
        *,
        messages (
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
        )
      `)
      .eq("id", conversationId)
      .single()

    if (error || !conversation || !Array.isArray(conversation.messages)) return []

    // Sort messages in ascending order (oldest first, newest last) to ensure newest messages appear at the bottom
    const sorted = [...conversation.messages].sort((a: any, b: any) => {
      const timeA = new Date(a.created_at).getTime()
      const timeB = new Date(b.created_at).getTime()
      return timeA - timeB
    })

    // Debug logging to help identify ordering issues
    console.log(`🔍 [getConversationMessages] Conversation ${conversationId}:`)
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
      sender_avatar: msg.custom_data?.avatar_url || msg.custom_data?.sender_avatar
    }))
  } catch (e) {
    console.error("getConversationMessages (client) error:", e)
    return []
  }
}




