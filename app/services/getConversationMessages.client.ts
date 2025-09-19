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
        messages (*)
      `)
      .eq("id", conversationId)
      .single()

    if (error || !conversation || !Array.isArray(conversation.messages)) return []

    const sorted = [...conversation.messages].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

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


