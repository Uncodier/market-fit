import type { Message } from "@/app/types/chat"
import { supabase } from "./chat-runtime"
import type { ChatMessage } from "@/app/types/chat"
import { withMappedCommandStatus } from "@/app/services/map-chat-command-status"
import { getUserData } from "./chat-profiles"

/**
 * Add a message to a conversation
 * @deprecated Use sendTeamMemberIntervention or sendAgentMessage instead. Direct database operations are not recommended.
 */
export async function addMessage(
  conversationId: string,
  role: "user" | "agent" | "assistant" | "team_member" | "visitor" | "system",
  userId: string | null,
  content: string,
  metadata?: Record<string, any>
): Promise<Message | null> {
  // Warning about using this function directly
  console.warn(
    "⚠️ WARNING: Using addMessage directly is deprecated. " +
    "Messages should be created through the API using sendTeamMemberIntervention or sendAgentMessage. " +
    "Direct database operations may cause inconsistencies."
  );

  // Determinamos qué campo de ID rellenar según el rol
  let messageData: any = {
    conversation_id: conversationId,
    role: role,
    content,
    custom_data: metadata || {}
  };
  
  // Asignamos el ID al campo correcto según el tipo de mensaje
  if (role === "team_member" || role === "user") {
    messageData.user_id = userId;
  } else if (role === "agent" || role === "assistant") {
    messageData.agent_id = userId;
  } else if (role === "visitor") {
    messageData.visitor_id = userId;
  }
  
  const { data, error } = await supabase
    .from("messages")
    .insert(messageData)
    .select()
    .single();

  if (error) {
    console.error("Error adding message:", error);
    return null;
  }

  return data;
}

/**
 * Add a team member message to a conversation
 * @deprecated Use sendTeamMemberIntervention instead. Direct database operations are not recommended.
 */
export async function addTeamMemberMessage(
  conversationId: string,
  userId: string,
  userName: string,
  userAvatarUrl: string | null,
  content: string,
  additionalMetadata?: Record<string, any>
): Promise<Message | null> {
  // Warning about using this function directly
  console.warn(
    "⚠️ WARNING: Using addTeamMemberMessage directly is deprecated. " +
    "Team member messages should be created through the API using sendTeamMemberIntervention. " +
    "Direct database operations may cause inconsistencies."
  );

  // Crear metadatos con información del usuario
  const metadata = {
    user_name: userName,
    avatar_url: userAvatarUrl ?? undefined,
    ...additionalMetadata
  };

  // Añadir el mensaje como team_member con el user_id en la columna correcta
  return addMessage(
    conversationId,
    "team_member",
    userId,  // Esto irá a la columna user_id
    content,
    metadata
  );
}

/**
 * Convert database messages to chat messages format
 */
export function convertMessagesToChatFormat(messages: Message[]): Promise<ChatMessage[]> {
  return Promise.all(messages.map(async (msg) => {
    // Determinar el rol
    const role = msg.role as "user" | "agent" | "assistant" | "team_member" | "visitor" | "system";
    
    // Create base message
    const chatMessage: ChatMessage = {
      id: msg.id,
      role,
      text: msg.content,
      timestamp: new Date(msg.created_at),
      metadata: withMappedCommandStatus(msg.custom_data as Record<string, unknown> | null | undefined) as ChatMessage["metadata"],
      command_id: msg.command_id ?? undefined
    };
    
    // Caso específico: mensajes de agentes (agent o assistant)
    if (role === "agent" || role === "assistant") {
      // Agregar el agent_id al mensaje para que pueda ser usado en la UI
      if (msg.agent_id) {
        chatMessage.agent_id = msg.agent_id;
      }
    }
    
    // Caso específico: mensajes de miembros del equipo (team_member) y usuarios (user)
    if (role === "team_member" || role === "user") {
      const userId = msg.user_id;
      
      // Debug logging for role and user_id mapping
      console.log(`🔍 [convertMessagesToChatFormat] Message ${msg.id?.substring(0, 8)}:`, {
        role: role,
        user_id: userId,
        agent_id: msg.agent_id,
        visitor_id: msg.visitor_id,
        content: msg.content?.substring(0, 30) + '...'
      });
      
      // Guardar el user_id en el mensaje de chat para la UI
      if (userId) {
        chatMessage.sender_id = userId;
        
        // Extraer metadata del custom_data
        if (msg.custom_data && typeof msg.custom_data === 'object') {
          const customData = msg.custom_data as any;
          
          // Extraer nombre y avatar si están disponibles
          if (customData.user_name || customData.sender_name) {
            chatMessage.sender_name = customData.user_name || customData.sender_name;
          }
          
          if (customData.avatar_url || customData.sender_avatar) {
            chatMessage.sender_avatar = customData.avatar_url || customData.sender_avatar;
          }
        }
        
        // Si falta nombre o avatar, buscamos en la base de datos con el user_id
        if (!chatMessage.sender_name || !chatMessage.sender_avatar) {
          try {
            const userData = await getUserData(userId);
            if (userData) {
              chatMessage.sender_name = chatMessage.sender_name || userData.name;
              chatMessage.sender_avatar = chatMessage.sender_avatar || userData.avatar_url || undefined;
            }
          } catch (error) {
            console.error("Error al obtener datos del usuario para el mensaje:", error);
          }
        }
      }
    }
    
    return chatMessage;
  }));
}

/**
 * Convert chat messages to database format
 */
export function convertChatMessageToDbFormat(
  conversationId: string,
  message: ChatMessage,
  userId?: string
): Partial<Message> {
  // Base message data
  const messageData: any = {
    conversation_id: conversationId,
    role: message.role,
    content: message.text,
    custom_data: message.metadata || {}
  };
  
  // Determine which ID field to set based on role
  if (message.role === "team_member" || message.role === "user") {
    messageData.user_id = userId || null;
  } else if (message.role === "agent" || message.role === "assistant") {
    messageData.agent_id = userId || null;
  } else if (message.role === "visitor") {
    messageData.visitor_id = userId || null;
  }
  
  return messageData;
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
    
    // Query 1: Get ALL pending messages first (no limit to ensure we get all pending)
    const { data: pendingMessages, error: pendingError } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("custom_data->>status", "pending")
      .order("created_at", { ascending: true })
      .limit(1000); // High limit to get all pending messages
    
    if (pendingError) {
      console.error("❌ Error fetching pending messages:", pendingError);
    } else {
      console.log(`✅ Pending query: Found ${(pendingMessages || []).length} pending messages`);
    }
    
    // Query 2: Get non-pending messages (limit to 40 for initial load)
    const { data: nonPendingMessages, error: nonPendingError } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .or("custom_data->>status.neq.pending,custom_data->>status.is.null")
      .order("created_at", { ascending: true })
      .limit(40); // Limit non-pending to 40 for initial load
    
    if (nonPendingError) {
      console.error("❌ Error fetching non-pending messages:", nonPendingError);
    } else {
      console.log(`✅ Non-pending query: Found ${(nonPendingMessages || []).length} non-pending messages`);
    }
    
    if (pendingError || nonPendingError) {
      console.error("❌ Error fetching messages:", pendingError || nonPendingError);
      return [];
    }
    
    // Combine: pending messages first, then non-pending messages
    const sortedMessages = [...(pendingMessages || []), ...(nonPendingMessages || [])];
    
    console.log(`🔄 [getConversationMessages] Conversation ${conversationId}:`)
    console.log(`📊 Pending messages: ${(pendingMessages || []).length}`)
    console.log(`📊 Non-pending messages: ${(nonPendingMessages || []).length}`)
    console.log("🔄 Mensajes ordenados:", sortedMessages.map(m => ({
      id: m.id.substring(0, 6),
      role: m.role,
      status: m.custom_data && typeof m.custom_data === "object" && !Array.isArray(m.custom_data)
        ? m.custom_data.status : undefined,
      created_at: m.created_at
    })));
    
    // Convertir mensajes a formato ChatMessage
    return await convertMessagesToChatFormat(sortedMessages);
  } catch (error) {
    console.error("Error in getConversationMessages:", error);
    return [];
  }
}
