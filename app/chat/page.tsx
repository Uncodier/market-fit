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
import { agents } from "@/app/agents/page"
import { Breadcrumb } from "@/app/components/navigation/Breadcrumb"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { useTheme } from "@/app/context/ThemeContext"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { ChatList } from "@/app/components/chat/chat-list"
import { ChatToggle } from "@/app/components/chat/chat-toggle"
import { useCommandK } from "@/app/hooks/use-command-k"

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
  const { user } = useAuthContext()
  
  // Estado para controlar la visibilidad de la lista de chats
  const [isChatListCollapsed, setIsChatListCollapsed] = useState(false)
  
  // Usar el tema completo para depuración
  const { theme, isDarkMode } = useTheme()
  
  // Inicializar el hook useCommandK
  useCommandK()
  
  // Log para depuración
  useEffect(() => {
    console.log("Tema actual:", theme);
    console.log("¿Modo oscuro?:", isDarkMode);
  }, [theme, isDarkMode]);

  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)
  const [conversation, setConversation] = useState<{ sender: string; text: string; timestamp: Date }[]>([
    {
      sender: "agent",
      text: `Hello! I'm ${agentName}. How can I help you today?`,
      timestamp: new Date(),
    },
  ])

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
        // Generamos un color basado en el email para usarlo como fondo
        const stringToColor = (str: string) => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
          }
          let color = '#';
          for (let i = 0; i < 3; i++) {
            const value = (hash >> (i * 8)) & 0xFF;
            color += ('00' + value.toString(16)).substr(-2);
          }
          return color;
        };
        
        // No usamos imagen, sólo setearemos a null para mostrar la inicial
        setUserAvatarUrl(null);
      }
    };
    
    fetchUserAvatar();
  }, [user]);

  // Set breadcrumb for the layout
  useEffect(() => {
    // Eliminamos toda la funcionalidad de breadcrumb
    // No es necesario actualizar nada
  }, [currentAgent, agentName]);

  // Scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversation])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!message.trim() || isLoading) return
    
    // Add user message to conversation
    setConversation([
      ...conversation,
      {
        sender: "user",
        text: message,
        timestamp: new Date(),
      },
    ])
    
    // Clear input
    setMessage("")
    
    // Show loading state
    setIsLoading(true)
    
    // Simulate agent response after a short delay
    setTimeout(() => {
      setConversation(prev => [
        ...prev,
        {
          sender: "agent",
          text: `This is a simulated response for the message: "${message}"`,
          timestamp: new Date(),
        },
      ])
      setIsLoading(false)
    }, 1500)
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

  return (
    <div className="flex h-full relative overflow-hidden">
      {/* Lista de chats */}
      <div className={cn(
        "h-full transition-all duration-300 ease-in-out",
        isChatListCollapsed ? "w-0" : "w-80"
      )}>
        <ChatList 
          isCollapsed={isChatListCollapsed} 
          currentConversationId={conversationId}
          className="border-r"
        />
      </div>
      
      {/* Contenido principal del chat */}
      <div className={cn(
        "flex flex-col h-full transition-all duration-300 ease-in-out flex-1",
        isChatListCollapsed ? "ml-0" : "ml-0"
      )}>
        {/* Agent info card - con altura exacta de 71px */}
        <div className="border-b bg-card flex-none h-[71px] flex items-center relative">
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
        <div className="flex-1 overflow-auto py-6 px-4 md:px-8 bg-muted/30 transition-colors duration-300 ease-in-out">
          <div className="max-w-3xl mx-auto space-y-6">
            {conversation.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
              >
                {msg.sender === "agent" ? (
                  <div 
                    className={cn(
                      "w-full rounded-lg p-4 transition-all duration-300 ease-in-out"
                    )}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    <p className="text-xs opacity-70 mt-1.5 text-left">
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ) : (
                  <div 
                    className={cn(
                      "max-w-[85%] rounded-lg p-4 shadow-sm transition-all duration-300 ease-in-out", 
                      "bg-primary text-primary-foreground rounded-tr-none"
                    )}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    <p className="text-xs opacity-70 mt-1.5 text-right">
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start w-full animate-fade-in">
                <div className="w-full rounded-lg p-4">
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
        <div className="px-4 md:px-8 py-4 flex-none chat-input-container transition-all duration-300 ease-in-out">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSendMessage} className="relative">
              <div className="relative">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message..."
                  className="resize-none h-[135px] w-full py-5 pl-[60px] pr-[60px] rounded-2xl border border-input bg-background shadow-sm focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 text-base box-border transition-all duration-300 ease-in-out"
                  disabled={isLoading}
                  style={{
                    lineHeight: '1.5',
                    overflowY: 'auto',
                    wordWrap: 'break-word',
                    paddingBottom: '50px', // Espacio adicional en la parte inferior
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