"use client"

import React, { useEffect, useState, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/app/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Badge } from "@/app/components/ui/badge"
import { Textarea } from "@/app/components/ui/textarea"
import { Button } from "@/app/components/ui/button"
import * as Icons from "@/app/components/ui/icons"
import { 
  ShoppingCart,
  HelpCircle,
  BarChart,
  Tag,
  Settings,
  Users,
  Check,
  User,
  PieChart,
  MessageSquare
} from "@/app/components/ui/icons"
import { Agent } from "@/app/types/agents"
import { agents } from "@/app/data/mock-agents"
import { Breadcrumb } from "@/app/components/navigation/Breadcrumb"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { useTheme } from "@/app/context/ThemeContext"
import { useSite } from "@/app/context/SiteContext"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { ChatList } from "@/app/components/chat/chat-list"
import { ChatToggle } from "@/app/components/chat/chat-toggle"
import { useCommandK } from "@/app/hooks/use-command-k"
import { ChatMessage } from "@/app/types/chat"
import { getConversationMessages, addMessage, getAgentForConversation, sendTeamMemberIntervention, sendAgentMessage, checkApiServerAvailability, createConversation } from "@/app/services/chat-service"
import { toast } from "react-hot-toast"

// Helper function to format date as "Month Day, Year"
const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

// Helper function to check if two dates are the same day
const isSameDay = (date1: Date, date2: Date) => {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
};

// Helper function to log detailed API errors
const logApiError = (error: any, context: string) => {
  if (error instanceof Error) {
    console.error(`API Error (${context}):`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  } else if (error && typeof error === 'object') {
    console.error(`API Error (${context}):`, JSON.stringify(error));
  } else {
    console.error(`API Error (${context}):`, error);
  }
};

export default function ChatPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const agentId = searchParams.get("agentId") || ""
  const agentName = searchParams.get("agentName") || "Agent"
  const conversationId = searchParams.get("conversationId") || ""
  const [message, setMessage] = useState("")
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const { user } = useAuthContext()
  const { currentSite } = useSite()
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)
  
  // Nuevo estado para la animación de espera mientras responde el agente
  const [isAgentResponding, setIsAgentResponding] = useState(false)
  
  // Debug essential context data for troubleshooting
  console.log("===== CHAT PAGE INITIALIZATION =====");
  console.log("- conversationId:", conversationId);
  console.log("- agentId:", agentId);
  console.log("- agentName:", agentName);
  console.log("- user:", user?.id);
  console.log("- currentSite:", currentSite);
  if (currentSite) {
    console.log("- currentSite.id:", currentSite.id);
  } else {
    console.error("ERROR: currentSite is null or undefined");
  }
  
  // Estado para controlar la visibilidad de la lista de chats
  const [isChatListCollapsed, setIsChatListCollapsed] = useState(false)
  
  // Estado para los mensajes del chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  
  // Estado para los datos del lead
  const [leadData, setLeadData] = useState<any>(null)
  const [isLoadingLead, setIsLoadingLead] = useState(false)
  
  // Estado para saber si es una conversación solo con el agente (sin visitor ni lead)
  const [isAgentOnlyConversation, setIsAgentOnlyConversation] = useState(false)
  
  // Determinar si tenemos un lead
  const isLead = leadData !== null
  
  // Estado para verificar la disponibilidad del API server
  const [isApiServerAvailable, setIsApiServerAvailable] = useState<boolean | null>(null);
  
  // Referencia para la suscripción de Supabase
  const messageSubscriptionRef = useRef<any>(null);
  
  // Cargar datos del lead cuando cambie la conversación
  useEffect(() => {
    // Usamos nuestra función auxiliar para cargar los datos del lead
    if (conversationId && !conversationId.startsWith("new-")) {
      loadLeadData(conversationId, currentSite?.id);
    }
  }, [conversationId, currentSite?.id]);
  
  // Cargar mensajes cuando cambie la conversación seleccionada
  useEffect(() => {
    async function loadMessages() {
      if (!conversationId) return;
      
      setIsLoadingMessages(true);
      
      try {
        // Si es una nueva conversación, mostramos un mensaje de bienvenida
        if (conversationId.startsWith("new-")) {
          setChatMessages([{
            id: "welcome",
            role: "assistant",
            text: `Hello! I'm ${agentName}. How can I help you today?`,
            timestamp: new Date(),
          }]);
        } else {
          // Verificar si es una conversación con el agente primero
          const url = new URL(window.location.href);
          const mode = url.searchParams.get("mode") || searchParams.get("mode");
          
          console.log("Loading messages for conversation:", conversationId);
          console.log("Conversation mode:", mode);
          
          // Cargar mensajes existentes de la API
          const messages = await getConversationMessages(conversationId);
          
          // Log the messages to see the structure
          console.log("Loaded chat messages from API:", messages);
          console.log("Is agent-only conversation:", isAgentOnlyConversation);
          
          if (messages.length > 0) {
            // Ya no convertimos los mensajes team_member a user, mantenemos el rol original siempre
            setChatMessages(messages);
          } else {
            // Si no hay mensajes, establecer un mensaje de bienvenida
            setChatMessages([{
              id: "welcome",
              role: "assistant",
              text: `Hello! I'm ${agentName}. How can I help you today?`,
              timestamp: new Date(),
            }]);
          }
          
          // Suscribirse a nuevos mensajes en tiempo real
          if (!messageSubscriptionRef.current && !conversationId.startsWith("new-")) {
            const supabase = createClient();
            
            console.log(`Setting up real-time subscription for conversation: ${conversationId}`);
            
            // Limpiar cualquier suscripción anterior si existe
            if (messageSubscriptionRef.current) {
              messageSubscriptionRef.current.unsubscribe();
            }
            
            // Crear nueva suscripción
            messageSubscriptionRef.current = supabase
              .channel(`conversation-${conversationId}`)
              .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`
              }, async (payload: { 
                new: { 
                  id: string; 
                  conversation_id: string; 
                  content: string;
                  role: string;
                  created_at: string;
                }
              }) => {
                console.log(`[${new Date().toISOString()}] 📨 Nuevo mensaje via suscripción:`, {
                  id: payload.new.id,
                  role: payload.new.role,
                  contentPreview: payload.new.content.substring(0, 30) + "..."
                });
                
                // Si el mensaje es del asistente, desactivar la animación de espera
                if (payload.new.role === 'assistant') {
                  console.log(`[${new Date().toISOString()}] 🔴🔴🔴 DESACTIVANDO ANIMACIÓN (suscripción - mensaje asistente) 🔴🔴🔴`);
                  // Desactivar inmediatamente, sin esperar
                  setIsAgentResponding(false);
                  
                  // Actualizar los mensajes para añadir inmediatamente la respuesta del asistente
                  setChatMessages(prev => [...prev, {
                    id: payload.new.id,
                    role: 'assistant',
                    text: payload.new.content,
                    timestamp: new Date(payload.new.created_at)
                  }]);
                } else {
                  console.log(`[${new Date().toISOString()}] ⏳ Mensaje no es del asistente (${payload.new.role}), manteniendo animación`);
                }
                
                // Obtener todos los mensajes actualizados para sincronizar completamente
                getConversationMessages(conversationId).then(updatedMessages => {
                  setChatMessages(updatedMessages);
                });
              })
              .subscribe();
          }
        }
      } catch (error) {
        console.error("Error loading messages:", error);
        setChatMessages([{
          id: "error",
          role: "assistant",
          text: "Sorry, there was an error loading the conversation. Please try again.",
          timestamp: new Date(),
        }]);
      } finally {
        setIsLoadingMessages(false);
      }
      
      // Limpiar la suscripción cuando cambie la conversación o se desmonte el componente
      return () => {
        if (messageSubscriptionRef.current) {
          console.log('Unsubscribing from previous conversation');
          messageSubscriptionRef.current.unsubscribe();
          messageSubscriptionRef.current = null;
        }
      };
    }
    
    loadMessages();
  }, [conversationId, agentName, isAgentOnlyConversation, searchParams]);
  
  // Actualizar el breadcrumb cuando se cargue la página
  useEffect(() => {
    // Actualizar el título de la página
    document.title = `Chat with ${agentName} | Market Fit`;
    
    // Emitir un evento para actualizar el breadcrumb
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        agentId,
        agentName
      }
    });
    
    window.dispatchEvent(event);
    
    // Limpiar al desmontar
    return () => {
      document.title = 'Market Fit';
    };
  }, [agentId, agentName]);
  
  // Usar el tema completo para depuración
  const { theme, isDarkMode } = useTheme()
  
  // Inicializar el hook useCommandK
  useCommandK()

  useEffect(() => {
    // Find the agent in our list to get its icon
    const agent = agents.find((a: Agent) => a.id === agentId)
    if (agent) {
      setCurrentAgent(agent)
      console.log("Found agent:", agent.name, "with icon:", agent.icon)
      
      // Verificar si el icono existe
      const IconComponent = agent.icon ? Icons[agent.icon as keyof typeof Icons] : null;
      console.log("IconComponent exists:", !!IconComponent)
    } else {
      console.log("Agent not found for id:", agentId)
    }
  }, [agentId])

  // Obtener avatar del usuario
  useEffect(() => {
    const fetchUserAvatar = async () => {
      if (!user) return;
      
      try {
        const supabase = createClient();
        
        // Primero intentamos obtener el perfil del usuario desde la base de datos usando email
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('email', user.email)
          .single();
          
        if (!error && profile && profile.avatar_url) {
          setUserAvatarUrl(profile.avatar_url);
          return;
        }
        
        // Si no hay avatar en el perfil, intentamos con user_metadata
        if (user.user_metadata?.avatar_url) {
          setUserAvatarUrl(user.user_metadata.avatar_url);
          return;
        }
        
        // Intentar con identities si está disponible
        if (user.identities?.[0]?.identity_data?.avatar_url) {
          setUserAvatarUrl(user.identities[0].identity_data.avatar_url);
          return;
        }
        
        // Si no hay avatar en ninguna parte, usar inicial con color generado del email
        setUserAvatarUrl(null);
      } catch (error) {
        console.error("Error fetching user avatar:", error);
        // Default a null para usar las iniciales
        setUserAvatarUrl(null);
      }
    };
    
    fetchUserAvatar();
  }, [user]);

  // Scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!message.trim() || isLoading || !currentSite?.id || !user?.id) return
    
    // Obtener el nombre y avatar del usuario
    const userName = user.user_metadata?.name || (user.email ? user.email.split('@')[0] : 'Team Member');
    const userAvatar = userAvatarUrl || "/avatars/user-default.png";
    
    // Create a message for immediate display with the correct role
    // Siempre usamos "team_member" para nuestros mensajes - el equipo habla con el agente
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "team_member", // Siempre team_member, incluso en conversaciones directas
      text: message,
      timestamp: new Date(),
      sender_id: user.id,
      sender_name: userName,
      sender_avatar: userAvatar
    };
    
    // Add message to conversation immediately
    setChatMessages(prev => [...prev, userMessage]);
    
    // Clear input
    setMessage("")
    
    // Set loading state while we send the API request
    setIsLoading(true);
    
    // Activar la animación de espera para la respuesta del agente
    // Esto aplica a todos los casos, no solo a conversaciones directas
    setIsAgentResponding(true);
    console.log(`[${new Date().toISOString()}] 🟢🟢🟢 ACTIVANDO ANIMACIÓN DE ESPERA 🟢🟢🟢`);
    
    try {
      // For new conversations, create a real conversation first
      let actualConversationId = conversationId;
      
      if (conversationId.startsWith("new-")) {
        // Create a new conversation
        const newConversation = await createConversation(
          currentSite.id,
          user.id,
          agentId,
          `Chat with ${agentName}`,
          {
            lead_id: leadData?.id
          }
        );
        
        if (newConversation) {
          actualConversationId = newConversation.id;
          
          // Update the URL with the real conversation ID
          router.replace(`/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${actualConversationId}`);
        } else {
          throw new Error("Failed to create conversation");
        }
      }
      
      // Custom data for local display
      const customData = {
        user_name: userName,
        avatar_url: userAvatar
      };
      
      console.log(`Sending message for conversation: ${actualConversationId}, agent: ${agentId}, isAgentOnly: ${isAgentOnlyConversation}`);
      console.log(`Message type: ${isAgentOnlyConversation ? 'DIRECT AGENT MESSAGE' : 'TEAM INTERVENTION'}`);
      
      try {
        if (isAgentOnlyConversation) {
          // Use direct agent message API for agent-only conversations
          console.log("★★★ SENDING DIRECT AGENT MESSAGE ★★★");
          console.log("Message text:", userMessage.text);
          
          try {
            // Llamar a la API de mensajes directos al agente
            console.log(`[${new Date().toISOString()}] 📞 Calling sendAgentMessage...`);
            const result = await sendAgentMessage(
              actualConversationId,
              userMessage.text,
              agentId,
              {
                site_id: currentSite.id,
                lead_id: leadData?.id,
                visitor_id: undefined, // No visitor for direct agent conversations
                team_member_id: user.id
              }
            );
            console.log(`[${new Date().toISOString()}] ✅ RESPUESTA directa recibida:`, result?.success);
            
            // Procesamos la respuesta si tenemos la estructura completa esperada
            if (result?.success && result?.data?.messages?.assistant) {
              console.log(`[${new Date().toISOString()}] 📝 Respuesta completa recibida con estructura correcta`);
              
              const agentResponse: ChatMessage = {
                id: result.data.messages.assistant.message_id || `agent-${Date.now()}`,
                role: "assistant",
                text: result.data.messages.assistant.content,
                timestamp: new Date(),
              };
              
              // Añadir la respuesta del agente a la conversación
              console.log(`[${new Date().toISOString()}] 📝 Agregando respuesta del agente al chat`);
              setChatMessages(prev => [...prev, agentResponse]);
            } else {
              console.log(`[${new Date().toISOString()}] ⚠️ Respuesta incompleta:`, result);
            }
          } catch (apiCallError) {
            console.error(`[${new Date().toISOString()}] ❌ Error en la API de mensajes directos:`, apiCallError);
            
            throw apiCallError;
          }
        } else {
          // Use the intervention API for conversations with leads or visitors
          console.log(`[${new Date().toISOString()}] 📞 Enviando team intervention`);
          
          await sendTeamMemberIntervention(
            actualConversationId,
            userMessage.text,
            user.id,
            agentId,
            {
              site_id: currentSite?.id,
              lead_id: leadData?.id || undefined,
              visitor_id: undefined
            }
          );
          console.log(`[${new Date().toISOString()}] ✅ Team intervention enviada correctamente`);
        }
      } catch (apiError) {
        console.error(`[${new Date().toISOString()}] ❌ Error al enviar mensaje:`, apiError);
        // Si hay un error, mostrar el mensaje pero permitir que continúe 
        // para guardar al menos localmente el mensaje
        logApiError(apiError, isAgentOnlyConversation ? 'DirectAgentMessage' : 'TeamIntervention');
        
        // Show a toast notification with the error
        toast.error(apiError instanceof Error 
          ? `Error: ${apiError.message}` 
          : "Failed to send message to the server. Message saved locally."
        );
        
        // SOLO en caso de error guardamos el mensaje localmente para que no se pierda
        try {
          // Guardar el mensaje localmente solo si falló el envío a la API
          await addMessage(
            actualConversationId,
            isAgentOnlyConversation ? "user" : "team_member",
            user.id,
            userMessage.text,
            customData
          );
        } catch (localSaveError) {
          console.error("Error saving message locally:", localSaveError);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error)
      
      // Add error message to chat
      setChatMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: "system",
        text: error instanceof Error 
          ? `Error: ${error.message}` 
          : "There was an error sending your message. Please try again.",
        timestamp: new Date()
      }]);
    } finally {
      // Always clear loading states
      setIsLoading(false);
      setIsAgentResponding(false);
      console.log(`[${new Date().toISOString()}] 🔴🔴🔴 DESACTIVANDO ANIMACIÓN (finally) 🔴🔴🔴`);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enviar mensaje con Enter (sin Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (message.trim() && !isLoading) {
        handleSendMessage(e as unknown as React.FormEvent);
      }
    }
    
    // Special case for multiline text: allow Shift+Enter
    if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey) {
      // Don't prevent default to allow line break
    }
  };
  
  // Render the agent icon component dynamically
  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'ShoppingCart':
        return ShoppingCart;
      case 'HelpCircle':
        return HelpCircle;
      case 'BarChart':
        return BarChart;
      case 'Tag':
        return Tag;
      case 'Settings':
        return Settings;
      case 'Users':
        return Users;
      case 'Check':
        return Check;
      case 'User':
        return User;
      case 'PieChart':
        return PieChart;
      case 'MessageSquare':
        return MessageSquare;
      default:
        return User; // Icono por defecto
    }
  };
  
  const IconComponent = currentAgent?.icon ? 
    getIconComponent(currentAgent.icon) : 
    null;

  // Get the agent type with proper capitalization
  const agentType = currentAgent?.type 
    ? currentAgent.type.charAt(0).toUpperCase() + currentAgent.type.slice(1) 
    : "Agent";

  const userInitial = user?.email ? user.email[0].toUpperCase() : "U";
  
  // Función para obtener un color de fondo basado en el email
  const getUserAvatarBgColor = () => {
    if (!user?.email) return "#6366f1"; // Color por defecto (indigo)
    
    let hash = 0;
    const email = user.email.toLowerCase();
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generar un matiz de color entre 0 y 360
    const hue = hash % 360;
    // Usar HSL para crear un color vibrante pero no demasiado brillante
    return `hsl(${hue}, 70%, 60%)`;
  };

  // Función para alternar la visibilidad de la lista de chats
  const toggleChatList = () => {
    setIsChatListCollapsed(!isChatListCollapsed);
  };

  // Función para iniciar una nueva conversación
  const startNewConversation = async () => {
    console.log("==== Starting: startNewConversation ====");
    
    // Debug essential values
    console.log("currentSite:", currentSite);
    console.log("user:", user);
    console.log("agentId from URL:", agentId);
    console.log("agentName from URL:", agentName);
    
    if (!agentId) {
      console.error("ERROR: agentId from URL is empty");
      return;
    }
    
    if (!currentSite?.id) {
      console.error("ERROR: currentSite or currentSite.id is null or undefined");
      return;
    }
    
    if (!user?.id) {
      console.error("ERROR: user or user.id is null or undefined");
      return;
    }
    
    try {
      // Debug parameters being passed to createConversation
      console.log("Creating conversation with parameters:");
      console.log("- siteId:", currentSite.id);
      console.log("- userId:", user.id);
      console.log("- agentId:", agentId);
      console.log("- title:", `Chat with ${agentName}`);
      console.log("- options: {}"); // No additional options
      
      // Create a generic conversation
      const conversation = await createConversation(
        currentSite.id,
        user.id,
        agentId,
        `Chat with ${agentName}`
        // No additional options
      );
      
      if (conversation) {
        console.log("New conversation created successfully:", conversation);
        router.push(`/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${conversation.id}`);
      } else {
        console.error("Failed to create conversation - returned null");
        // Fallback to temporary ID if creation fails
        const newConversationId = `new-${Date.now()}`;
        router.push(`/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${newConversationId}`);
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
      console.error("Error details:", error instanceof Error ? error.message : String(error));
      // Fallback to temporary ID on error
      const newConversationId = `new-${Date.now()}`;
      router.push(`/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${newConversationId}`);
    } finally {
      console.log("==== Ending: startNewConversation ====");
    }
  };

  // Función para seleccionar una conversación
  const handleSelectConversation = (selectedConversationId: string, selectedAgentName: string, selectedAgentId: string) => {
    // Use the native history API to update the URL without triggering a hard reload
    const newUrl = `/chat?conversationId=${selectedConversationId}&agentId=${selectedAgentId}&agentName=${encodeURIComponent(selectedAgentName)}`;
    window.history.pushState(null, '', newUrl);
    
    // Manually update the conversationId, agentName and agentId to trigger UI updates
    if (conversationId !== selectedConversationId) {
      console.log("Changing conversation without reload:", selectedConversationId);
      
      // Clear any existing messages while we load the new conversation
      setChatMessages([]);
      setIsLoadingMessages(true);
      
      // Load the new conversation's messages directly
      getConversationMessages(selectedConversationId).then((messages) => {
        setChatMessages(messages);
        setIsLoadingMessages(false);
      });
      
      // También cargamos los datos del lead si es necesario
      loadLeadData(selectedConversationId, currentSite?.id);
    }
  };
  
  // Helper function to load lead data for a conversation
  const loadLeadData = async (convId: string, siteId?: string) => {
    if (!convId || convId.startsWith("new-") || !siteId) return;
    
    setIsLoadingLead(true);
    
    try {
      const supabase = createClient();
      
      // Obtener el lead_id y visitor_id de la conversación
      const { data: conversation, error: conversationError } = await supabase
        .from("conversations")
        .select("lead_id, visitor_id")
        .eq("id", convId)
        .single();
        
      if (conversationError) {
        console.error("Error fetching conversation data:", conversationError);
        setIsLoadingLead(false);
        return;
      }
      
      // Verificar si es una conversación solo con el agente
      if (!conversation.lead_id && conversation.visitor_id === null) {
        console.log("This is an agent-only conversation");
        setIsAgentOnlyConversation(true);
        setIsLoadingLead(false);
        return;
      } else {
        setIsAgentOnlyConversation(false);
      }
      
      if (!conversation || !conversation.lead_id) {
        console.log("No lead associated with this conversation");
        setIsLoadingLead(false);
        return;
      }
      
      // Luego obtener los datos del lead
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("*")
        .eq("id", conversation.lead_id)
        .single();
        
      if (leadError) {
        console.error("Error fetching lead data:", leadError);
        setIsLoadingLead(false);
        return;
      }
      
      // Establecer los datos del lead
      setLeadData({
        id: lead.id,
        name: lead.name || "Unknown",
        type: "Lead",
        status: "Online",
        avatarUrl: "/avatars/visitor-default.png" // Fallback image
      });
      
    } catch (error) {
      console.error("Error loading lead data:", error);
    } finally {
      setIsLoadingLead(false);
    }
  };

  // Custom handlers for different conversation types
  const handleNewLeadConversation = async () => {
    console.log("==== Starting: handleNewLeadConversation ====");
    
    // Debug essential values
    console.log("currentSite:", currentSite);
    console.log("user:", user);
    console.log("agentId from URL:", agentId);
    console.log("agentName from URL:", agentName);
    console.log("leadData:", leadData);
    
    if (!agentId) {
      console.error("ERROR: agentId from URL is empty");
      return;
    }
    
    if (!currentSite?.id) {
      console.error("ERROR: currentSite or currentSite.id is null or undefined");
      return;
    }
    
    if (!user?.id) {
      console.error("ERROR: user or user.id is null or undefined");
      return;
    }
    
    if (!leadData?.id) {
      console.error("ERROR: leadData or leadData.id is null or undefined");
      return;
    }
    
    try {
      // Debug parameters being passed to createConversation
      console.log("Creating lead conversation with parameters:");
      console.log("- siteId:", currentSite.id);
      console.log("- userId:", user.id);
      console.log("- agentId:", agentId);
      console.log("- title:", `Chat with ${leadData.name}`);
      console.log("- options:", { lead_id: leadData.id });
      
      // Create a conversation with lead_id
      const conversation = await createConversation(
        currentSite.id,
        user.id,
        agentId,
        `Chat with ${leadData.name}`,
        { lead_id: leadData.id }
      );
      
      console.log("createConversation result:", conversation);
      
      if (conversation) {
        console.log("New lead conversation created successfully:", conversation);
        console.log("Redirecting to:", `/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${conversation.id}`);
        router.push(`/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${conversation.id}`);
      } else {
        console.error("Failed to create lead conversation - returned null");
      }
    } catch (error) {
      console.error("Error creating lead conversation:", error);
      console.error("Error details:", error instanceof Error ? error.message : String(error));
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace available");
    } finally {
      console.log("==== Ending: handleNewLeadConversation ====");
    }
  };
  
  const handleNewAgentConversation = async () => {
    console.log("==== Starting: handleNewAgentConversation ====");
    
    // Debug essential values
    console.log("currentSite:", currentSite);
    console.log("user:", user);
    console.log("agentId from URL:", agentId);
    console.log("agentName from URL:", agentName);
    
    // Use the agent ID and name from URL parameters instead of currentAgent
    if (!agentId) {
      console.error("ERROR: agentId from URL is empty");
      // The button should be disabled in this case, but just to be safe
      // we'll show an error message and return early
      toast?.error?.("Cannot create agent conversation: No agent selected");
      return;
    }
    
    if (!currentSite?.id) {
      console.error("ERROR: currentSite or currentSite.id is null or undefined");
      toast?.error?.("Cannot create conversation: No site selected");
      return;
    }
    
    if (!user?.id) {
      console.error("ERROR: user or user.id is null or undefined");
      toast?.error?.("Cannot create conversation: Not logged in");
      return;
    }
    
    try {
      // Debug parameters being passed to createConversation
      console.log("Creating AGENT-ONLY conversation with parameters:");
      console.log("- siteId:", currentSite.id);
      console.log("- userId:", user.id);
      console.log("- agentId:", agentId);
      console.log("- title:", `Direct chat with ${agentName}`);
      console.log("- options: { is_agent_conversation: true }");
      
      // Create a regular conversation with just the agent - explicitly specify this is an agent conversation
      const conversation = await createConversation(
        currentSite.id,
        user.id,
        agentId,
        `Direct chat with ${agentName}`,
        { is_agent_conversation: true } // This flag will tell the service not to create a visitor_id
      );
      
      console.log("Agent-only conversation creation result:", conversation);
      
      if (conversation) {
        console.log("★★★ NEW AGENT-ONLY CONVERSATION CREATED ★★★");
        console.log("Conversation ID:", conversation.id);
        
        // Set agent-only flag immediately
        setIsAgentOnlyConversation(true);
        
        // Create URL with mode parameter for agent-only conversation
        const newUrl = `/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${conversation.id}&mode=agentOnly`;
        console.log("Redirecting to new agent conversation URL:", newUrl);
        router.push(newUrl); // Use router.push instead of window.history for proper routing
        
        // Manually load initial data for the new conversation
        setChatMessages([{
          id: "welcome",
          role: "assistant",
          text: `Hello! I'm ${agentName}. How can I help you today?`,
          timestamp: new Date(),
        }]);
      } else {
        console.error("Failed to create agent conversation - returned null");
        toast?.error?.("Failed to create conversation. Please try again.");
      }
    } catch (error) {
      console.error("Error creating agent conversation:", error);
      console.error("Error details:", error instanceof Error ? error.message : String(error));
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace available");
      toast?.error?.("Error creating conversation: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      console.log("==== Ending: handleNewAgentConversation ====");
    }
  };
  
  const handlePrivateDiscussion = async () => {
    console.log("==== Starting: handlePrivateDiscussion ====");
    
    // Debug essential values
    console.log("currentSite:", currentSite);
    console.log("user:", user);
    console.log("agentId from URL:", agentId);
    console.log("agentName from URL:", agentName);
    
    if (!agentId) {
      console.error("ERROR: agentId from URL is empty");
      return;
    }
    
    if (!currentSite?.id) {
      console.error("ERROR: currentSite or currentSite.id is null or undefined");
      return;
    }
    
    if (!user?.id) {
      console.error("ERROR: user or user.id is null or undefined");
      return;
    }
    
    try {
      // Debug parameters being passed to createConversation
      console.log("Creating private conversation with parameters:");
      console.log("- siteId:", currentSite.id);
      console.log("- userId:", user.id);
      console.log("- agentId:", agentId);
      console.log("- title:", `Private discussion with ${agentName}`);
      console.log("- options:", { is_private: true });
      
      // Create a private conversation
      const conversation = await createConversation(
        currentSite.id,
        user.id,
        agentId,
        `Private discussion with ${agentName}`,
        { 
          is_private: true
        }
      );
      
      console.log("createConversation result:", conversation);
      
      if (conversation) {
        console.log("New private conversation created successfully:", conversation);
        console.log("Redirecting to:", `/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${conversation.id}&mode=private`);
        router.push(`/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${conversation.id}&mode=private`);
      } else {
        console.error("Failed to create private conversation - returned null");
      }
    } catch (error) {
      console.error("Error creating private conversation:", error);
      console.error("Error details:", error instanceof Error ? error.message : String(error));
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace available");
    } finally {
      console.log("==== Ending: handlePrivateDiscussion ====");
    }
  };

  // Let's also log the messages when they're displayed
  useEffect(() => {
    console.log("Current chat messages state:", chatMessages);
    
    // Log the roles for debugging
    if (chatMessages.length > 0) {
      console.log("Message roles:", chatMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        isAgentOnly: isAgentOnlyConversation
      })));
    }
  }, [chatMessages, isAgentOnlyConversation]);

  // Fetch agent details when conversationId changes
  useEffect(() => {
    async function fetchConversationAgent() {
      if (!conversationId || conversationId.startsWith("new-")) return;
      
      try {
        // Get the conversation to find its agent ID
        const { data: conversation, error } = await createClient()
          .from("conversations")
          .select("agent_id")
          .eq("id", conversationId)
          .single();
          
        if (error || !conversation) {
          console.error("Error fetching conversation agent:", error);
          return;
        }
        
        const conversationAgentId = conversation.agent_id;
        
        // Only update if we have a valid agent ID and it's different from current agentId
        if (conversationAgentId && conversationAgentId !== agentId) {
          // Get agent details
          const agent = await getAgentForConversation(conversationAgentId);
          if (agent) {
            // Update the URL with the agent details
            router.replace(`/chat?conversationId=${conversationId}&agentId=${agent.id}&agentName=${encodeURIComponent(agent.name)}`);
          }
        }
      } catch (error) {
        console.error("Error fetching agent details:", error);
      }
    }
    
    fetchConversationAgent();
  }, [conversationId, router, agentId]);

  // Verificar la disponibilidad del API server al cargar la página
  useEffect(() => {
    const checkApiServer = async () => {
      try {
        const isAvailable = await checkApiServerAvailability();
        setIsApiServerAvailable(isAvailable);
        console.log("API server availability:", isAvailable ? "Available" : "Not available");
      } catch (error) {
        console.error("Error checking API server:", error);
        setIsApiServerAvailable(false);
      }
    };
    
    checkApiServer();
  }, []);

  // Test direct conversation creation
  useEffect(() => {
    // Only run this test once when component is mounted and we have valid data
    if (currentSite?.id && user?.id && agentId) {
      const testConversationCreation = async () => {
        console.log("Testing direct conversation creation...");
        try {
          // Ya no necesitamos generar un UUID para pruebas
          
          // Try creating a test conversation directly
          const testConversation = await createConversation(
            currentSite.id,
            user.id,
            agentId,
            "Test Conversation",
            {} // Sin visitor_id, el backend lo manejará
          );
          
          console.log("Test conversation creation result:", testConversation);
          
          if (testConversation) {
            console.log("SUCCESS: Test conversation created with ID:", testConversation.id);
          } else {
            console.error("FAILURE: Test conversation creation returned null");
          }
        } catch (error) {
          console.error("ERROR in test conversation creation:", error);
        }
      };
      
      // Uncomment this line to actually run the test
      // testConversationCreation();
    }
  }, [currentSite, user, agentId]);

  // Verificar si la conversación es solo con el agente al cargar la página
  useEffect(() => {
    console.log("=== CHECKING AGENT-ONLY CONVERSATION STATUS ===");
    console.log("Current conversationId:", conversationId);
    console.log("Current agentId:", agentId);
    
    // Check the mode parameter from the URL
    const url = new URL(window.location.href);
    const mode = url.searchParams.get("mode") || searchParams.get("mode");
    
    console.log("Conversation mode from URL:", mode);
    
    if (mode === "agentOnly" || mode === "private") {
      console.log("✓ CONFIRMED: This is an agent-only conversation based on URL mode parameter");
      setIsAgentOnlyConversation(true);
      
      // Verificar que la función sendAgentMessage está disponible
      console.log("Checking if sendAgentMessage function is available:", typeof sendAgentMessage === 'function');
      console.log("sendAgentMessage source info:", "@/app/services/chat-service");
    } else {
      // If no specific mode is set, check if this is a conversation without a lead or visitor
      const checkConversationType = async () => {
        if (conversationId && !conversationId.startsWith("new-")) {
          try {
            console.log("Checking conversation type in database for:", conversationId);
            const supabase = createClient();
            const { data, error } = await supabase
              .from("conversations")
              .select("lead_id, visitor_id, title")
              .eq("id", conversationId)
              .single();
              
            console.log("Database conversation check result:", data);
            
            if (!error && data) {
              // If both lead_id and visitor_id are null, it's an agent-only conversation
              if (data.lead_id === null && data.visitor_id === null) {
                console.log("✓ CONFIRMED: This is an agent-only conversation based on database check");
                console.log("Conversation data:", data);
                setIsAgentOnlyConversation(true);
              } else {
                console.log("✗ NOT an agent-only conversation based on database check:");
                console.log(`- lead_id: ${data.lead_id ? "exists" : "null"}`);
                console.log(`- visitor_id: ${data.visitor_id ? "exists" : "null"}`);
                console.log(`- title: ${data.title}`);
                setIsAgentOnlyConversation(false);
              }
            } else {
              console.error("Error checking conversation type:", error);
            }
          } catch (error) {
            console.error("Error checking conversation type:", error);
          }
        } else {
          console.log("New conversation - need to determine type based on creation parameters");
        }
      };
      
      checkConversationType();
    }
  }, [searchParams, conversationId]);

  // Add a listener for popstate events (browser back/forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const url = new URL(window.location.href);
      const convId = url.searchParams.get('conversationId');
      const agId = url.searchParams.get('agentId');
      const agName = url.searchParams.get('agentName');
      const mode = url.searchParams.get('mode');
      
      if (convId && agId && agName && convId !== conversationId) {
        console.log("popstate detected - loading conversation:", convId);
        
        // Clear any existing messages while we load the new conversation
        setChatMessages([]);
        setIsLoadingMessages(true);
        
        // Load the new conversation's messages
        getConversationMessages(convId).then((messages) => {
          setChatMessages(messages);
          setIsLoadingMessages(false);
        });
        
        // Load lead data for the conversation
        loadLeadData(convId, currentSite?.id);
        
        // Check for agent-only mode
        if (mode === 'agentOnly' || mode === 'private') {
          console.log("popstate detected - setting agent-only mode from URL");
          setIsAgentOnlyConversation(true);
        } else {
          // We'll need to check the conversation details
          const checkConversationType = async () => {
            try {
              const supabase = createClient();
              const { data, error } = await supabase
                .from("conversations")
                .select("lead_id, visitor_id")
                .eq("id", convId)
                .single();
                
              if (!error && data) {
                // If both lead_id and visitor_id are null, it's an agent-only conversation
                if (data.lead_id === null && data.visitor_id === null) {
                  console.log("popstate detected - setting agent-only mode from database check");
                  setIsAgentOnlyConversation(true);
                } else {
                  setIsAgentOnlyConversation(false);
                }
              }
            } catch (error) {
              console.error("Error checking conversation type during popstate:", error);
            }
          };
          
          checkConversationType();
        }
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [conversationId, currentSite?.id]);

  // Agregar un efecto para desactivar la animación cuando detectemos mensajes del asistente
  useEffect(() => {
    // Si tenemos mensajes y el último es del asistente, desactivar la animación
    if (chatMessages.length > 0) {
      const lastMessage = chatMessages[chatMessages.length - 1];
      if (lastMessage.role === 'assistant') {
        console.log(`[${new Date().toISOString()}] 🔴🔴🔴 DESACTIVANDO ANIMACIÓN (mensaje del asistente detectado en useEffect) 🔴🔴🔴`);
        setIsAgentResponding(false);
      }
    }
  }, [chatMessages]);

  return (
    <div className="flex h-full relative overflow-hidden">
      {/* Lista de chats */}
      <div className={cn(
        "h-full transition-all duration-300 ease-in-out",
        isChatListCollapsed ? "w-0 opacity-0" : "w-[319px]"
      )} style={{ overflow: 'hidden' }}>
        <ChatList 
          siteId={currentSite?.id || ""}
          selectedConversationId={conversationId}
          onSelectConversation={handleSelectConversation}
          className="border-r"
        />
      </div>
      
      {/* Contenido principal del chat */}
      <div className={cn(
        "flex flex-col h-full transition-all duration-300 ease-in-out flex-1",
        isChatListCollapsed ? "ml-0" : "ml-0"
      )}>
        {/* Agent info card - con altura exacta de 71px */}
        <div className="border-b flex-none h-[71px] flex items-center fixed w-[-webkit-fill-available] z-[999] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80" 
          style={{ backdropFilter: 'blur(10px)' }}>
          {/* Botones para mostrar/ocultar la lista de chats y nueva conversación */}
          <ChatToggle 
            isCollapsed={isChatListCollapsed} 
            onToggle={toggleChatList}
            onNewConversation={startNewConversation}
            onNewLeadConversation={handleNewLeadConversation}
            onNewAgentConversation={handleNewAgentConversation}
            onPrivateDiscussion={handlePrivateDiscussion}
            showNewConversationButton={true}
            isLead={isLead}
            agentName={agentName}
            agentId={agentId}
            leadName={isLead ? leadData?.name || "Lead" : "Visitor"}
            leadId={isLead ? leadData?.id || "" : ""}
          />
          
          <div className={cn(
            "max-w-[80rem] mx-auto w-full flex items-center justify-between transition-all duration-300 ease-in-out"
          )}>
            {/* Agent info */}
            <div className="flex items-center gap-3 transition-opacity duration-300 ease-in-out">
              <Avatar className="h-12 w-12 border-2 border-primary/10 transition-transform duration-300 ease-in-out">
                <AvatarImage src={`/avatars/agent-${agentId}.png`} alt={agentName} />
                <AvatarFallback className="bg-primary/10">
                  {IconComponent ? (
                    <IconComponent className="h-6 w-6 transition-transform duration-200" aria-hidden={true} />
                  ) : (
                    agentName.charAt(0)
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="transition-transform duration-300 ease-in-out">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium text-lg">{agentName}</h2>
                  <Badge variant="outline" className="text-xs px-2 py-0 h-5 transition-colors duration-300">
                    {agentType}
                  </Badge>
                  {isAgentOnlyConversation && (
                    <Badge variant="secondary" className="text-xs px-2 py-0 h-5 transition-colors duration-300 bg-blue-500/10 text-blue-600 border-blue-500/20">
                      Direct
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground transition-colors duration-300">
                    {currentAgent?.status === 'active' ? 
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 transition-colors duration-300"></span> Online
                      </span> : 
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 transition-colors duration-300"></span> {currentAgent?.status}
                      </span>
                    }
                  </span>
                </div>
              </div>
            </div>
            
            {/* Visitor/Lead info - solo se muestra cuando no está cargando y tenemos datos o es un visitante */}
            {!isLoadingLead && !isAgentOnlyConversation && (
              <div className="flex items-center gap-3 mr-4 transition-opacity duration-300 ease-in-out">
                <div className="transition-transform duration-300 ease-in-out text-right">
                  <div className="flex items-center gap-2 justify-end">
                    {isLead ? (
                      <Link 
                        href={`/leads/${leadData.id}`} 
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                      >
                        <h2 className="font-medium text-lg">{leadData.name}</h2>
                        <Badge variant="outline" className="text-xs px-2 py-0 h-5 transition-colors duration-300 bg-amber-500/10 text-amber-600 border-amber-500/20">
                          {leadData.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground transition-colors duration-300">
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 transition-colors duration-300"></span> {leadData.status}
                          </span>
                        </span>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h2 className="font-medium text-lg">Visitor</h2>
                        <Badge variant="outline" className="text-xs px-2 py-0 h-5 transition-colors duration-300">
                          Visitor
                        </Badge>
                        <span className="text-xs text-muted-foreground transition-colors duration-300">
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 transition-colors duration-300"></span> Online
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {isLead ? (
                  <Link href={`/leads/${leadData.id}`} className="hover:opacity-80 transition-opacity">
                    <Avatar className="h-12 w-12 border-2 border-amber-500/20 transition-transform duration-300 ease-in-out">
                      <AvatarImage src={leadData.avatarUrl} alt={leadData.name} />
                      <AvatarFallback className="bg-amber-500/10 text-amber-600">
                        {leadData.name.split(' ').map((name: string) => name[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                ) : (
                  <Avatar className="h-12 w-12 border-2 border-primary/10 transition-transform duration-300 ease-in-out">
                    <AvatarImage src="/avatars/visitor-default.png" alt="Visitor" />
                    <AvatarFallback className="bg-primary/10">
                      V
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Chat messages - área con scroll */}
        <div className="flex-1 overflow-auto py-6 bg-muted/30 transition-colors duration-300 ease-in-out pt-[91px] pb-[200px]">
          <div className="max-w-[80rem] mx-auto">
            {isLoadingMessages ? (
              <div className="space-y-6 w-full">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"} animate-pulse`}>
                    {i % 2 === 0 ? (
                      <div className="flex items-start justify-end gap-3 max-w-[80%]">
                        <div className="space-y-2 w-[350px]">
                          <div className="bg-muted/40 rounded-lg p-4" style={{ 
                            backgroundColor: 'var(--muted)', 
                            border: 'none', 
                            boxShadow: 'none', 
                            outline: 'none',
                            filter: 'none'
                          }}>
                            <div className="h-4 bg-muted-foreground/20 rounded w-[90%]"></div>
                            <div className="h-4 bg-muted-foreground/20 rounded w-[70%] mt-2"></div>
                            <div className="h-4 bg-muted-foreground/20 rounded w-[80%] mt-2"></div>
                            <div className="h-3 bg-muted-foreground/15 rounded w-14 mt-2 ml-auto"></div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 max-w-[80%]">
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-8 h-8 rounded-full bg-primary/20"></div>
                        </div>
                        <div className="space-y-2 w-[350px]">
                          <div className="h-4 bg-primary/10 rounded w-24"></div>
                          <div className="rounded-lg p-4 bg-background" style={{ 
                            boxShadow: 'var(--shadow-sm)',
                            border: '1px solid var(--border)'
                          }}>
                            <div className="h-4 bg-muted-foreground/10 rounded w-[90%]"></div>
                            <div className="h-4 bg-muted-foreground/10 rounded w-[75%] mt-2"></div>
                            <div className="h-4 bg-muted-foreground/10 rounded w-[85%] mt-2"></div>
                            <div className="h-3 bg-muted-foreground/10 rounded w-14 mt-2"></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {chatMessages.map((msg, index) => {
                  // Check if we need to show a date separator
                  const showDateSeparator = index > 0 && 
                    !isSameDay(
                      new Date(chatMessages[index-1].timestamp), 
                      new Date(msg.timestamp)
                    );
                  
                  return (
                    <React.Fragment key={msg.id || index}>
                      {showDateSeparator && (
                        <div className="flex justify-center my-8">
                          <Badge variant="outline" className="px-3 py-1 text-xs bg-background/80 backdrop-blur">
                            {formatDate(new Date(msg.timestamp))}
                          </Badge>
                        </div>
                      )}
                      <div
                        className={`flex ${
                          msg.role === "team_member" 
                          ? (isAgentOnlyConversation ? "justify-end" : "justify-start")
                          : (msg.role === "user" || msg.role === "visitor") ? "justify-end" : "justify-start"
                        } animate-fade-in`}
                      >
                        {msg.role === "team_member" && !isAgentOnlyConversation ? (
                          <div className="flex flex-col max-w-[80rem]">
                            <div className="flex items-center mb-1 gap-2">
                              <Avatar className="h-7 w-7 border border-primary/10">
                                <AvatarImage src={msg.sender_avatar || `/avatars/user-default.png`} alt={msg.sender_name || "Team Member"} style={{ objectFit: 'cover' }} />
                                <AvatarFallback className="text-xs bg-primary/10" style={{
                                  backgroundColor: msg.sender_id 
                                    ? `hsl(${parseInt(msg.sender_id.replace(/[^a-f0-9]/gi, '').substring(0, 6), 16) % 360}, 70%, 65%)`
                                    : undefined
                                }}>
                                  {msg.sender_name ? msg.sender_name.charAt(0).toUpperCase() : (msg.sender_id ? msg.sender_id.charAt(0).toUpperCase() : "T")}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{msg.sender_name || `Team Member (${msg.sender_id ? msg.sender_id.substring(0, 6) + '...' : 'Unknown'})`}</span>
                            </div>
                            <div className="rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground ml-9"
                              style={{ 
                                backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
                                border: 'none', 
                                boxShadow: 'none', 
                                outline: 'none',
                                filter: 'none' 
                              }}
                            >
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                              <p className="text-xs opacity-70 mt-1.5">
                                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        ) : msg.role === "team_member" && isAgentOnlyConversation ? (
                          <div className="flex flex-col max-w-[80rem] items-end">
                            <div className="flex items-center mb-1 gap-2 flex-row-reverse">
                              <Avatar className="h-7 w-7 border border-primary/10">
                                <AvatarImage src={msg.sender_avatar || `/avatars/user-default.png`} alt={msg.sender_name || "Team Member"} style={{ objectFit: 'cover' }} />
                                <AvatarFallback className="text-xs bg-primary/10" style={{
                                  backgroundColor: msg.sender_id 
                                    ? `hsl(${parseInt(msg.sender_id.replace(/[^a-f0-9]/gi, '').substring(0, 6), 16) % 360}, 70%, 65%)`
                                    : undefined
                                }}>
                                  {msg.sender_name ? msg.sender_name.charAt(0).toUpperCase() : (msg.sender_id ? msg.sender_id.charAt(0).toUpperCase() : "T")}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{msg.sender_name || `Team Member (${msg.sender_id ? msg.sender_id.substring(0, 6) + '...' : 'Unknown'})`}</span>
                            </div>
                            <div className="rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground mr-9"
                              style={{ 
                                backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
                                border: 'none', 
                                boxShadow: 'none', 
                                outline: 'none',
                                filter: 'none' 
                              }}
                            >
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                              <p className="text-xs opacity-70 mt-1.5 text-right">
                                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        ) : (msg.role === "agent" || msg.role === "assistant") ? (
                          <div className="max-w-[80rem]">
                            <div className="flex items-center mb-1 gap-2">
                              <Avatar className="h-7 w-7 border border-primary/10">
                                <AvatarImage src={`/avatars/agent-${agentId}.png`} alt={agentName} />
                                <AvatarFallback className="bg-primary/10">
                                  {agentName.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium text-primary">{agentName}</span>
                            </div>
                            <div className="ml-9">
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                            </div>
                          </div>
                        ) : (msg.role === "user" || msg.role === "visitor") ? (
                          <div className="flex flex-col max-w-[80rem] items-end">
                            <div className="flex items-center mb-1 gap-2 flex-row-reverse">
                              <Avatar className="h-7 w-7 border border-amber-500/20">
                                <AvatarImage src={leadData?.avatarUrl || "/avatars/visitor-default.png"} alt={leadData?.name || "Visitor"} />
                                <AvatarFallback className="bg-amber-500/10 text-amber-600">
                                  {leadData?.name ? leadData.name.split(' ').map((n: string) => n[0]).join('') : "V"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium text-amber-600 dark:text-amber-500">{leadData?.name || "Visitor"}</span>
                            </div>
                            <div className="rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground mr-9"
                              style={{ 
                                backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
                                border: 'none', 
                                boxShadow: 'none', 
                                outline: 'none',
                                filter: 'none' 
                              }}
                            >
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                              <p className="text-xs opacity-70 mt-1.5 text-right">
                                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="max-w-[80rem] rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground"
                            style={{ 
                              backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
                              border: 'none', 
                              boxShadow: 'none', 
                              outline: 'none',
                              filter: 'none' 
                            }}
                          >
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                            <p className="text-xs opacity-70 mt-1.5">
                              {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
                
                {/* Animación de espera mientras el agente responde */}
                {isAgentResponding && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="max-w-[80rem] flex items-center space-x-2 p-4">
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
        
        {/* Message input - estilo minimalista */}
        <div className={cn(
          "py-4 flex-none chat-input-container transition-all duration-300 ease-in-out fixed w-[-webkit-fill-available] bottom-0 bg-background/95",
          !isDarkMode && "border-t border-border/40"
        )}>
          <div className="max-w-[80rem] mx-auto">
            <form onSubmit={handleSendMessage} className="relative">
              <div className="relative">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message..."
                  className="resize-none h-[135px] w-full py-5 pl-[60px] pr-[60px] rounded-2xl border border-input bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 text-base box-border transition-all duration-300 ease-in-out"
                  disabled={isLoading}
                  style={{
                    lineHeight: '1.5',
                    overflowY: 'auto',
                    wordWrap: 'break-word',
                    paddingBottom: '50px', // Espacio adicional en la parte inferior
                    backdropFilter: 'blur(10px)'
                  }}
                />
                {/* Botones de acciones a la izquierda */}
                <div className="absolute bottom-[15px] left-[15px] flex space-x-1">
                  <Button 
                    type="button" 
                    size="icon"
                    variant="ghost"
                    className="rounded-xl h-[39px] w-[39px] text-muted-foreground hover:text-foreground transition-colors hover:bg-muted"
                    title="Adjuntar archivo"
                  >
                    <Icons.Link className="h-5 w-5" />
                    <span className="sr-only">Attach file</span>
                  </Button>
                  <Button 
                    type="button" 
                    size="icon"
                    variant="ghost"
                    className="rounded-xl h-[39px] w-[39px] text-muted-foreground hover:text-foreground transition-colors hover:bg-muted"
                    title="Buscar en internet"
                  >
                    <Icons.Search className="h-5 w-5" />
                    <span className="sr-only">Web search</span>
                  </Button>
                </div>
                
                {/* Botón de enviar a la derecha */}
                <div className="absolute bottom-[15px] right-[15px]">
                  <Button 
                    type="submit" 
                    size="icon"
                    variant="ghost"
                    disabled={isLoading || !message.trim()}
                    className={`rounded-xl h-[39px] w-[39px] text-primary hover:text-primary/90 transition-colors hover:bg-muted ${!message.trim() ? 'opacity-50' : 'opacity-100'}`}
                  >
                    {isLoading ? (
                      <Icons.Loader className="h-5 w-5 animate-spin" />
                    ) : (
                      <Icons.ChevronRight className="h-5 w-5" />
                    )}
                    <span className="sr-only">Send</span>
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// Breadcrumb estático inicial (se actualizará con el useEffect)
ChatPage.breadcrumb = (
  <div className="flex justify-between items-center w-full pr-8">
    <Breadcrumb
      items={[
        {
          href: "/",
          label: "Home",
          icon: <Icons.Home className="h-3.5 w-3.5" />
        },
        {
          href: "/agents",
          label: "Agents",
          icon: <Icons.Users className="h-3.5 w-3.5" />
        },
        {
          href: "#",
          label: "Chat",
          icon: <Icons.MessageSquare className="h-3.5 w-3.5" />
        }
      ]}
    />
  </div>
); 