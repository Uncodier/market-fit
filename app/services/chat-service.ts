import { createClient } from "@/lib/supabase/client"
import { Conversation, Message, ConversationWithMessages, MessageWithSender, ConversationListItem, ChatMessage } from "@/app/types/chat"
import { Agent } from "@/app/types/agents"
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from "@/types/supabase"
import { randomUUID } from 'crypto'

/**
 * Generate a UUID
 */
export function generateUUID(): string {
  try {
    // Use crypto.randomUUID() if available (Node.js environments)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback for older environments: Use random values to generate a UUID
    // First check if we have crypto.getRandomValues available
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
    
    // Final fallback using Math.random (less secure but ensures we have a UUID)
    console.warn('Using Math.random fallback for UUID generation - less secure!');
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  } catch (error) {
    // If all else fails, generate a timestamp-based pseudo-UUID
    console.error('UUID generation error:', error);
    
    try {
      // Try one more approach with Math.random directly handling any toString issues
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        try {
          const r = Math.floor(Math.random() * 16);
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          // Use explicit number-to-string conversion to avoid any toString issues
          return (v < 10) ? String(v) : String.fromCharCode(87 + v); // 'a' is charCode 97, so 97-10=87
        } catch (innerError) {
          // Handle any unexpected error in the replace function
          console.error('Critical error in UUID generation fallback:', innerError);
          // Just return a digit or letter based on simple math operation
          return Math.floor(Math.random() * 10).toString();
        }
      });
    } catch (finalError) {
      // If absolutely everything fails, use timestamp only
      const timestamp = new Date().getTime();
      const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `fallback-${timestamp}-${randomPart}`;
    }
  }
}

// Get API server URL from environment variables
const API_SERVER_URL = process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.API_SERVER_URL || '';

// Ensure URL has proper protocol and use correct host
const getFullApiUrl = (baseUrl: string) => {
  if (!baseUrl) return '';
  
  // If already has http:// or https://, extract the host and port
  let apiUrl = baseUrl;
  
  if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
    // Extract the protocol, host, and port
    const url = new URL(baseUrl);
    const protocol = url.protocol;
    const port = url.port;
    
    // If we're in a browser environment and the baseUrl is using localhost
    if (typeof window !== 'undefined' && url.hostname === 'localhost') {
      // Get the current origin
      const origin = window.location.origin;
      const originUrl = new URL(origin);
      
      // If we're accessing from an IP address instead of localhost
      if (originUrl.hostname !== 'localhost' && /^\d+\.\d+\.\d+\.\d+$/.test(originUrl.hostname)) {
        // Replace localhost with the same IP as the origin
        apiUrl = `${protocol}//${originUrl.hostname}:${port}`;
        console.log(`Replaced localhost with origin IP: ${apiUrl}`);
      }
    }
    
    return apiUrl;
  }
  
  // If it's just a host:port without protocol, add http://
  return `http://${baseUrl}`;
};

// Full URL with protocol
const FULL_API_SERVER_URL = getFullApiUrl(API_SERVER_URL);

// Initialize Supabase client with error handling
let supabaseClientInitialized = false;
const supabase: SupabaseClient<Database> = createClient();

// Check if essential methods are present
if (!supabase.from) {
  console.error("CRITICAL ERROR: supabase.from is undefined");
} else {
  console.log("supabase.from is available");
}

if (!supabase.auth) {
  console.error("CRITICAL ERROR: supabase.auth is undefined");
} else {
  console.log("supabase.auth is available");
}

// Test connection
supabase.auth.getSession().then((result) => {
  if (result.error) {
    console.error("Error verifying Supabase session in chat-service:", result.error);
  } else {
    console.log("Supabase client initialized successfully in chat-service.ts");
    if (result.data.session) {
      console.log("User is authenticated:", result.data.session.user.id);
    } else {
      console.log("No active session found - user is not authenticated");
    }
    supabaseClientInitialized = true;
  }
});

/**
 * Checks if the API server is available
 */
export async function checkApiServerAvailability(): Promise<boolean> {
  try {
    // Muchos servidores no tienen una ruta /health, intentamos con la raíz
    const API_URL = `${FULL_API_SERVER_URL}/`;
    console.log("Checking API server availability at:", API_URL);
    
    // Set a short timeout to avoid long waits
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(API_URL, {
      method: 'GET',
      mode: 'no-cors', // Cambiamos a no-cors para evitar problemas CORS
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Con modo no-cors, siempre devuelve un status de tipo "opaque"
    // así que solo verificamos que la respuesta existe
    return true;
  } catch (error) {
    console.error("API server is not available:", error);
    return false;
  }
}

// Cache for user data to avoid redundant fetches
const userCache: Record<string, { name: string, avatar_url: string | null }> = {};

/**
 * Fetch user data by user ID
 */
async function getUserData(userId: string): Promise<{ name: string, avatar_url: string | null } | null> {
  // Check cache first
  if (userCache[userId]) {
    return userCache[userId];
  }

  try {
    // First try to get the user from the profiles table (created by a trigger in Supabase)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, name, avatar_url")
      .eq("id", userId)
      .single();

    if (!profileError && profile) {
      // Cache the user data from profiles
      const userData = {
        name: profile.name || (profile.email ? profile.email.split('@')[0] : 'Team Member'),
        avatar_url: profile.avatar_url
      };
      
      userCache[userId] = userData;
      return userData;
    }

    // If profile not found, try to get auth user data directly
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(userId);
      
      if (!authError && authUser) {
        const userData = {
          name: authUser.user_metadata?.name || 
                authUser.user_metadata?.full_name || 
                (authUser.email ? authUser.email.split('@')[0] : 'Team Member'),
          avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null
        };
        
        userCache[userId] = userData;
        return userData;
      }
    } catch (authError) {
      console.error("Error getting auth user data:", authError);
    }
    
    // If we still don't have user data, return a fallback with truncated ID
    console.log("Could not find user data for user ID:", userId);
    const fallbackData = {
      name: `Team Member (${userId.substring(0, 8)}...)`,
      avatar_url: null
    };
    
    // Still cache this fallback to avoid repeated lookups
    userCache[userId] = fallbackData;
    return fallbackData;
  } catch (error) {
    console.error("Unexpected error fetching user data:", error);
    return {
      name: `Team Member (${userId.substring(0, 8)}...)`,
      avatar_url: null
    };
  }
}

/**
 * Get all conversations for a site
 */
export async function getConversations(siteId: string): Promise<ConversationListItem[]> {
  try {
    console.log(`🔍 DEBUG: getConversations called for site: ${siteId}`);
    const supabase = createClient();
    
    // Primero obtenemos las conversaciones
    const { data: conversations, error: conversationsError } = await supabase
      .from("conversations")
      .select(`
        id,
        title,
        agent_id,
        lead_id,
        last_message_at,
        created_at,
        messages (
          content,
          created_at,
          role,
          user_id
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
      console.log('🔍 DEBUG: No conversations found for site', siteId);
      return []
    }
    
    console.log(`🔍 DEBUG: Retrieved ${conversations.length} conversations from database`);
    console.log('🔍 DEBUG: First conversation titles:', conversations.slice(0, 3).map((c: any) => c.title));
    
    // Obtenemos los IDs de los agentes
    const agentIds = conversations.map((conv: any) => conv.agent_id).filter(Boolean)
    
    // Obtenemos los IDs de leads
    const leadIds = conversations.map((conv: any) => conv.lead_id).filter(Boolean)
    
    // Inicializamos los mapas de agentes y leads
    let agentsMap: Record<string, string> = {};
    let leadsMap: Record<string, string> = {};
    
    // Si hay IDs de agentes, obtenemos sus nombres
    if (agentIds.length > 0) {
      const { data: agents, error: agentsError } = await supabase
        .from("agents")
        .select("id, name")
        .in("id", agentIds)

      if (agentsError) {
        console.error("Error fetching agents:", agentsError)
      } else {
        // Creamos un mapa de agentes para búsqueda rápida
        agentsMap = (agents || []).reduce((map: Record<string, string>, agent: any) => {
          map[agent.id] = agent.name;
          return map;
        }, {});
      }
    }
    
    // Si hay IDs de leads, obtenemos sus nombres
    if (leadIds.length > 0) {
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("id, name, company")
        .in("id", leadIds)

      if (leadsError) {
        console.error("Error fetching leads:", leadsError)
      } else {
        // Creamos un mapa de leads para búsqueda rápida
        leadsMap = (leads || []).reduce((map: Record<string, string>, lead: any) => {
          const companyName = lead.company && typeof lead.company === 'object' && lead.company.name 
            ? lead.company.name 
            : (typeof lead.company === 'string' ? lead.company : '');
          
          map[lead.id] = lead.name + (companyName ? ` (${companyName})` : '');
          return map;
        }, {});
      }
    }

    // Mapeamos las conversaciones con toda la información disponible
    return conversations.map((conv: any) => {
      const lastMessage = conv.messages && conv.messages.length > 0
        ? conv.messages[conv.messages.length - 1].content
        : undefined

      // Usar last_message_at si está disponible, o created_at como respaldo
      const messageDate = conv.last_message_at || conv.created_at || new Date().toISOString()
      
      // Get lead name if available
      const leadId = conv.lead_id || "";
      const leadName = leadId ? leadsMap[leadId] : "";
      
      // Generate a better title if we have a lead name
      let title = conv.title || "Untitled Conversation";
      if (leadName && (!conv.title || conv.title === "Untitled Conversation")) {
        title = `Chat with ${leadName}`;
      }
      
      // Get agent name with fallback
      const agentId = conv.agent_id || "";
      const agentName = agentsMap[agentId] || 
        (agentId && agentId !== "" ? "Unknown Agent" : "Agent");
      
      return {
        id: conv.id || "",
        title: title,
        agentId: agentId,
        agentName: agentName,
        leadName: leadName || undefined,
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
  title: string,
  options?: {
    lead_id?: string;
    is_private?: boolean;
    visitor_id?: string;
    status?: string;
    is_agent_conversation?: boolean; // New flag to indicate this is just an agent conversation
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
    avatar_url: userAvatarUrl || `/avatars/user-default.png`,
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
      metadata: msg.custom_data as Record<string, any> | undefined
    };
    
    // Caso específico: mensajes de miembros del equipo (team_member)
    if (role === "team_member") {
      const userId = msg.user_id;
      
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
              chatMessage.sender_avatar = chatMessage.sender_avatar || userData.avatar_url || "/avatars/user-default.png";
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
    icon: data.icon || getRoleBasedIcon(data.role, data.type), // Usar el icono de la DB o determinar uno basado en el rol/tipo
    role: data.role || undefined,
    tools: data.tools || {},
    activities: data.activities || {},
    integrations: data.integrations || {},
    supervisor: data.supervisor || undefined
  }
}

/**
 * Determina un icono apropiado basado en el rol o tipo del agente
 */
function getRoleBasedIcon(role?: string, type?: string): string {
  // Si hay un rol, intentar determinar el icono basado en él
  if (role) {
    const roleLower = role.toLowerCase();
    
    if (roleLower.includes("growth") && roleLower.includes("lead")) {
      return "BarChart";
    } else if (roleLower.includes("growth") && roleLower.includes("market")) {
      return "TrendingUp";
    } else if (roleLower.includes("data") && roleLower.includes("analyst")) {
      return "PieChart";
    } else if (roleLower.includes("ux") || roleLower.includes("designer")) {
      return "Smartphone";
    } else if (roleLower.includes("sales") || roleLower.includes("crm")) {
      return "ShoppingCart";
    } else if (roleLower.includes("support") || roleLower.includes("customer")) {
      return "HelpCircle";
    } else if (roleLower.includes("content") || roleLower.includes("copywriter")) {
      return "FileText";
    }
  }
  
  // Si no hay rol o no se pudo determinar, usar el tipo
  if (type) {
    switch (type.toLowerCase()) {
      case "marketing":
        return "TrendingUp";
      case "sales":
        return "ShoppingCart";
      case "support":
        return "HelpCircle";
      case "product":
        return "Smartphone";
    }
  }
  
  // Fallback predeterminado
  return "User";
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
    
    // Ordenar mensajes por fecha de creación antes de convertirlos
    const sortedMessages = [...conversation.messages].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateA - dateB; // Orden ascendente (más antiguos primero)
    });
    
    console.log("🔄 Mensajes ordenados por fecha:", sortedMessages.map(m => ({
      id: m.id.substring(0, 6),
      role: m.role,
      created_at: m.created_at
    })));
    
    // Convertir mensajes a formato ChatMessage
    return await convertMessagesToChatFormat(sortedMessages);
  } catch (error) {
    console.error("Error in getConversationMessages:", error);
    return [];
  }
}

/**
 * Sends a team member intervention message in a conversation
 */
export async function sendTeamMemberIntervention(
  conversationId: string,
  message: string,
  userId: string,
  agentId: string,
  options?: {
    conversation_title?: string;
    lead_id?: string;
    visitor_id?: string;
    site_id?: string;
  }
): Promise<any> {
  // Log the API URL being used
  const API_URL = `${FULL_API_SERVER_URL}/api/agents/chat/intervention`;
  console.log("Sending intervention to API URL:", API_URL);
  
  const requestBody = {
    conversationId,
    message,
    user_id: userId,
    agentId,
    conversation_title: options?.conversation_title,
    lead_id: options?.lead_id,
    visitor_id: options?.visitor_id,
    site_id: options?.site_id,
  };
  
  console.log("Intervention request payload:", JSON.stringify(requestBody));
  
  try {
    // Single fetch attempt
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      let errorMsg = `Error sending intervention: ${response.status} ${response.statusText}`;
      const errorData = await response.json().catch(() => null);
      if (errorData) {
        errorMsg = errorData.message || errorData.error || errorMsg;
      }
      throw new Error(errorMsg);
    }
    
    const responseData = await response.json().catch(() => ({ success: true }));
    console.log("Intervention API response:", responseData);
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