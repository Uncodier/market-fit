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
import { getConversationMessages, addMessage, getAgentForConversation } from "@/app/services/chat-service"

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
  
  // Estado para controlar la visibilidad de la lista de chats
  const [isChatListCollapsed, setIsChatListCollapsed] = useState(false)
  
  // Estado para los mensajes del chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  
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
          // Cargar mensajes existentes de la API
          const messages = await getConversationMessages(conversationId);
          
          // Log the messages to see the structure
          console.log("Loaded chat messages from API:", messages);
          
          if (messages.length > 0) {
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
    }
    
    loadMessages();
  }, [conversationId, agentName]);
  
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
      
      // Intentar obtener el avatar de los metadatos del usuario
      if (user.user_metadata?.avatar_url) {
        setUserAvatarUrl(user.user_metadata.avatar_url);
        return;
      }
      
      if (user.identities?.[0]?.identity_data?.avatar_url) {
        setUserAvatarUrl(user.identities[0].identity_data.avatar_url);
        return;
      }
      
      // Si no hay avatar en los metadatos, usar inicial con color generado del email
      if (user.email) {
        // No usamos imagen, sólo setearemos a null para mostrar la inicial
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
    
    if (!message.trim() || isLoading || !currentSite?.id) return
    
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      text: message,
      timestamp: new Date(),
    }
    
    // Add user message to conversation
    setChatMessages(prev => [...prev, userMessage])
    
    // Clear input
    setMessage("")
    
    // Show loading state
    setIsLoading(true)
    
    try {
      // Si es una conversación nueva, necesitamos crear una conversación primero
      // (Esta lógica se implementaría completa en el servicio)
      
      // Añadir mensaje a la BD
      if (conversationId && !conversationId.startsWith("new-")) {
        await addMessage(
          conversationId,
          "user",
          user?.id || null,
          message
        )
      }
      
      // Simular respuesta del agente
      setTimeout(() => {
        const agentResponse: ChatMessage = {
          id: `temp-response-${Date.now()}`,
          role: "assistant",
          text: `This is a simulated response for your message. In a real implementation, this would come from an AI model or agent.`,
          timestamp: new Date(),
        }
        
        setChatMessages(prev => [...prev, agentResponse])
        setIsLoading(false)
        
        // Guarda respuesta del agente (implementación completa requeriría guardar en BD)
        if (conversationId && !conversationId.startsWith("new-")) {
          addMessage(
            conversationId,
            "assistant",
            agentId,
            agentResponse.text
          )
        }
      }, 1500)
    } catch (error) {
      console.error("Error sending message:", error)
      setIsLoading(false)
      
      // Mostrar mensaje de error
      setChatMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: "assistant",
        text: "Sorry, there was an error sending your message. Please try again.",
        timestamp: new Date(),
      }])
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
  const startNewConversation = () => {
    if (currentAgent) {
      const newConversationId = `new-${Date.now()}`
      router.push(`/chat?agentId=${currentAgent.id}&agentName=${encodeURIComponent(currentAgent.name)}&conversationId=${newConversationId}`)
    }
  };

  // Función para seleccionar una conversación
  const handleSelectConversation = (selectedConversationId: string, selectedAgentName: string, selectedAgentId: string) => {
    router.push(`/chat?conversationId=${selectedConversationId}&agentId=${selectedAgentId}&agentName=${encodeURIComponent(selectedAgentName)}`)
  };

  // Let's also log the messages when they're displayed
  useEffect(() => {
    console.log("Current chat messages state:", chatMessages);
  }, [chatMessages]);

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
        <div className="border-b flex-none h-[71px] flex items-center fixed w-[-webkit-fill-available] z-[999]" 
          style={{ background: isDarkMode ? 'var(--background)' : '#ffffffed', backdropFilter: 'blur(10px)' }}>
          {/* Botones para mostrar/ocultar la lista de chats y nueva conversación */}
          <ChatToggle 
            isCollapsed={isChatListCollapsed} 
            onToggle={toggleChatList}
            onNewConversation={startNewConversation}
            showNewConversationButton={true}
          />
          
          <div className={cn(
            "max-w-screen-xl mx-auto w-full flex items-center transition-all duration-300 ease-in-out",
            isChatListCollapsed ? "pl-16" : "pl-24"
          )}>
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
                <h2 className="font-medium text-lg">{agentName}</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs px-2 py-0 h-5 transition-colors duration-300">
                    {agentType}
                  </Badge>
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
          </div>
        </div>
        
        {/* Chat messages - área con scroll */}
        <div className="flex-1 overflow-auto py-6 px-4 md:px-8 bg-muted/30 transition-colors duration-300 ease-in-out pt-[91px] pb-[200px]">
          <div className="max-w-[80rem] mx-auto space-y-6">
            {isLoadingMessages ? (
              <div className="flex justify-center items-center h-32">
                <div className="flex flex-col items-center">
                  <div className="flex space-x-2 mb-3">
                    <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce"></div>
                    <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    <div className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                  </div>
                  <span className="text-sm text-muted-foreground">Loading messages...</span>
                </div>
              </div>
            ) : (
              chatMessages.map((msg, index) => (
                <div
                  key={msg.id || index}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
                >
                  {(msg.role === "agent" || msg.role === "assistant") ? (
                    <div className="max-w-[80rem] px-1">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      <p className="text-xs opacity-70 mt-1.5 text-left">
                        {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  ) : (
                    <div 
                      className="max-w-[80rem] rounded-lg p-4 bg-primary text-primary-foreground transition-all duration-300 ease-in-out"
                      style={{ 
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
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start w-full animate-fade-in">
                <div className="w-full rounded-lg p-4" style={{ boxShadow: 'none' }}>
                  <div className="flex space-x-2">
                    <div className="h-2 w-2 bg-muted-foreground/30 rounded-full animate-bounce"></div>
                    <div className="h-2 w-2 bg-muted-foreground/30 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    <div className="h-2 w-2 bg-muted-foreground/30 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
        
        {/* Message input - estilo minimalista */}
        <div className="px-4 md:px-8 py-4 flex-none chat-input-container transition-all duration-300 ease-in-out fixed w-[-webkit-fill-available] bottom-0" 
          style={{ background: isDarkMode ? 'var(--background)' : '#ffffffed' }}>
          <div className="max-w-[80rem] mx-auto">
            <form onSubmit={handleSendMessage} className="relative">
              <div className="relative">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message..."
                  className="resize-none h-[135px] w-full py-5 pl-[60px] pr-[60px] rounded-2xl border border-input bg-background focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 text-base box-border transition-all duration-300 ease-in-out"
                  disabled={isLoading}
                  style={{
                    lineHeight: '1.5',
                    overflowY: 'auto',
                    wordWrap: 'break-word',
                    paddingBottom: '50px' // Espacio adicional en la parte inferior
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