import { createClient } from "@/lib/supabase/client"
import { Conversation, Message, ConversationWithMessages, MessageWithSender, ConversationListItem, ChatMessage } from "@/app/types/chat"
import { Agent } from "@/app/types/agents"

const supabase = createClient()

/**
 * Get all conversations for a site
 */
export async function getConversations(siteId: string): Promise<ConversationListItem[]> {
  try {
    // Primero obtenemos las conversaciones
    const { data: conversations, error: conversationsError } = await supabase
      .from("conversations")
      .select(`
        id,
        title,
        agent_id,
        last_message_at,
        created_at,
        messages (
          content,
          created_at,
          role
        )
      `)
      .eq("site_id", siteId)
      .eq("is_archived", false)
      .order("last_message_at", { ascending: false })

    if (conversationsError) {
      console.error("Error fetching conversations:", conversationsError)
      return []
    }

    if (!conversations || conversations.length === 0) {
      return []
    }

    // Obtenemos los IDs de los agentes
    const agentIds = conversations.map((conv: any) => conv.agent_id).filter(Boolean)
    
    // Si no hay IDs de agentes, devolvemos las conversaciones sin información de agente
    if (agentIds.length === 0) {
      return conversations.map((conv: any) => {
        const lastMessage = conv.messages && conv.messages.length > 0
          ? conv.messages[conv.messages.length - 1].content
          : undefined

        // Usar last_message_at si está disponible, o created_at como respaldo
        const messageDate = conv.last_message_at || conv.created_at || new Date().toISOString()

        return {
          id: conv.id || "",
          title: conv.title || "Untitled Conversation",
          agentId: conv.agent_id || "",
          agentName: "Agent",
          lastMessage,
          timestamp: new Date(messageDate),
          messageCount: conv.messages?.length || 0
        }
      })
    }

    // Obtenemos los agentes en una consulta separada
    const { data: agents, error: agentsError } = await supabase
      .from("agents")
      .select("id, name")
      .in("id", agentIds)

    if (agentsError) {
      console.error("Error fetching agents:", agentsError)
      // Continuamos sin información de agentes
    }

    // Creamos un mapa de agentes para búsqueda rápida
    const agentsMap = (agents || []).reduce((map: Record<string, string>, agent: any) => {
      map[agent.id] = agent.name
      return map
    }, {} as Record<string, string>)

    // Mapeamos las conversaciones
    return conversations.map((conv: any) => {
      const lastMessage = conv.messages && conv.messages.length > 0
        ? conv.messages[conv.messages.length - 1].content
        : undefined

      // Usar last_message_at si está disponible, o created_at como respaldo
      const messageDate = conv.last_message_at || conv.created_at || new Date().toISOString()
      
      console.log(`Conversation ${conv.id} timestamp:`, messageDate)

      return {
        id: conv.id || "",
        title: conv.title || "Untitled Conversation",
        agentId: conv.agent_id || "",
        agentName: agentsMap[conv.agent_id] || "Agent",
        lastMessage,
        timestamp: new Date(messageDate),
        messageCount: conv.messages?.length || 0
      }
    })
  } catch (error) {
    console.error("Unexpected error in getConversations:", error)
    return []
  }
}

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

  return data as ConversationWithMessages
}

/**
 * Create a new conversation
 */
export async function createConversation(
  siteId: string,
  userId: string,
  agentId: string,
  title: string
): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      site_id: siteId,
      user_id: userId,
      agent_id: agentId,
      title
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating conversation:", error)
    return null
  }

  return data
}

/**
 * Add a message to a conversation
 */
export async function addMessage(
  conversationId: string,
  role: "user" | "agent" | "assistant",
  senderId: string | null,
  content: string,
  metadata?: Record<string, any>
): Promise<Message | null> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role: role,
      sender_id: senderId,
      content,
      metadata
    })
    .select()
    .single()

  if (error) {
    console.error("Error adding message:", error)
    return null
  }

  return data
}

/**
 * Convert database messages to chat messages format
 */
export function convertMessagesToChatFormat(messages: Message[]): ChatMessage[] {
  return messages.map(msg => {
    // If role is undefined, determine a default based on other message properties
    let role: "user" | "agent" | "assistant";
    
    if (!msg.role) {
      console.warn(`Message ${msg.id} has undefined role:`, msg);
      // Default to "user" if there's a sender_id, otherwise "assistant"
      role = msg.sender_id ? "user" : "assistant";
    } else {
      role = msg.role as "user" | "agent" | "assistant";
    }
    
    return {
      id: msg.id,
      role,
      text: msg.content,
      timestamp: new Date(msg.created_at),
      metadata: msg.metadata as Record<string, any> | undefined
    };
  });
}

/**
 * Convert chat messages to database format
 */
export function convertChatMessageToDbFormat(
  conversationId: string,
  message: ChatMessage,
  senderId?: string
): Partial<Message> {
  return {
    conversation_id: conversationId,
    role: message.role,
    sender_id: senderId || null,
    content: message.text,
    metadata: message.metadata
  }
}

/**
 * Get agent details for a conversation
 */
export async function getAgentForConversation(agentId: string): Promise<Agent | null> {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single()

  if (error) {
    console.error("Error fetching agent:", error)
    return null
  }

  // Convert to Agent type
  return {
    id: data.id,
    name: data.name,
    description: data.description || "",
    type: data.type,
    status: data.status,
    conversations: data.conversations,
    successRate: data.success_rate,
    lastActive: data.last_active || new Date().toISOString(),
    icon: "User", // Default icon
    role: data.role || undefined,
    tools: data.tools || {},
    activities: data.activities || {},
    integrations: data.integrations || {},
    supervisor: data.supervisor || undefined
  }
}

/**
 * Get messages for a specific conversation
 */
export async function getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    if (!conversationId) {
      return [];
    }
    
    // Si es una conversación nueva (empieza con "new-"), devolvemos una lista vacía
    if (conversationId.startsWith("new-")) {
      return [];
    }
    
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select(`
        *,
        messages (
          *
        )
      `)
      .eq("id", conversationId)
      .single();
      
    if (conversationError) {
      console.error("Error fetching conversation:", conversationError);
      return [];
    }
    
    if (!conversation || !conversation.messages || !Array.isArray(conversation.messages)) {
      return [];
    }
    
    // Convertir mensajes a formato ChatMessage
    return convertMessagesToChatFormat(conversation.messages);
  } catch (error) {
    console.error("Error in getConversationMessages:", error);
    return [];
  }
} 