"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Search, PlusCircle, MessageSquare } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { Input } from "@/app/components/ui/input"
import { useTheme } from "@/app/context/ThemeContext"
import { ConversationListItem } from "@/app/types/chat"
import { getConversations } from "../../services/chat-service"
import { formatDistanceToNow, format } from "date-fns"
import { Skeleton } from "@/app/components/ui/skeleton"

// Componente para renderizar esqueletos de carga
function ConversationSkeleton() {
  return (
    <div className="py-3 px-4 border-b border-border/30" style={{ width: '320px', boxSizing: 'border-box' }}>
      <div className="flex items-center justify-between mb-1">
        <Skeleton className="h-4 w-[70%]" />
        <Skeleton className="h-3 w-[15%]" />
      </div>
      <Skeleton className="h-3 w-[90%] mt-2" />
      <Skeleton className="h-3 w-[40%] mt-2" />
    </div>
  )
}

// Componente personalizado para estado vacío 
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center max-w-[260px] text-center">
      <div className="mb-6">
        <MessageSquare className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">No conversations</h3>
      <p className="text-sm text-muted-foreground">
        Start a new conversation with an agent
      </p>
    </div>
  )
}

interface ChatListProps {
  siteId: string
  selectedConversationId?: string
  onSelectConversation: (conversationId: string, agentName: string, agentId: string) => void
  className?: string
}

// Función auxiliar para formatear la fecha
function formatMessageDate(date: Date) {
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && 
                  date.getMonth() === now.getMonth() && 
                  date.getFullYear() === now.getFullYear();
  
  // Si es hoy, mostrar la hora (ej: "14:30")
  if (isToday) {
    return format(date, "HH:mm");
  }
  
  // Si es este año pero no hoy, mostrar el día y mes (ej: "24 Jun")
  if (date.getFullYear() === now.getFullYear()) {
    return format(date, "d MMM");
  }
  
  // Si es de otro año, mostrar día, mes y año (ej: "24 Jun 2022")
  return format(date, "d MMM yyyy");
}

// Función para truncar texto con longitud máxima
function truncateText(text: string, maxLength: number) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

function getDefaultMessage(title: string): string {
  if (title.toLowerCase().includes("could not process")) {
    return "Could not process target due to unexpected error";
  }
  
  if (title.toLowerCase().includes("lamento mucho")) {
    return "Lamento mucho la espera y las molestias causadas";
  }
  
  return "No response generated";
}

export function ChatList({
  siteId,
  selectedConversationId,
  onSelectConversation,
  className
}: ChatListProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [hasEmptyResult, setHasEmptyResult] = useState(false)
  const { isDarkMode } = useTheme()

  useEffect(() => {
    let isMounted = true;
    
    async function loadConversations() {
      if (!siteId) return;
      
      setIsLoading(true)
      try {
        const data = await getConversations(siteId)
        
        if (isMounted) {
          setConversations(data)
          setHasEmptyResult(data.length === 0)
          setIsInitialLoad(false)
          
          // Pequeño retraso antes de ocultar el esqueleto para evitar parpadeos
          setTimeout(() => {
            if (isMounted) {
              setIsLoading(false)
            }
          }, 300)
        }
      } catch (error) {
        console.error("Error loading conversations:", error)
        if (isMounted) {
          setIsInitialLoad(false)
          setIsLoading(false)
        }
      }
    }

    loadConversations()
    
    return () => {
      isMounted = false;
    }
  }, [siteId])

  const filteredConversations = conversations.filter(conv => {
    const searchLower = searchQuery.toLowerCase()
    return (
      (conv.title && conv.title.toLowerCase().includes(searchLower)) ||
      (conv.agentName && conv.agentName.toLowerCase().includes(searchLower)) ||
      (conv.lastMessage && conv.lastMessage.toLowerCase().includes(searchLower))
    )
  })

  // Determinar si mostrar el estado vacío después de la búsqueda
  const showEmptyState = !isLoading && (
    (isInitialLoad === false && hasEmptyResult) || 
    (!isInitialLoad && filteredConversations.length === 0)
  );

  const handleSelectConversation = (conversation: ConversationListItem) => {
    onSelectConversation(conversation.id, conversation.agentName, conversation.agentId);
  }

  return (
    <div className={cn("flex flex-col h-full fixed", className)} style={{ width: '320px', maxWidth: '320px', overflow: 'hidden' }}>
      {/* Top bar with search input - adaptable to dark mode */}
      <div className={cn(
        "flex items-center justify-center h-[71px] border-b transition-colors duration-300 flex-shrink-0",
        isDarkMode ? "bg-background" : "bg-white",
        "fixed w-[319px] z-[999]"
      )} style={{ background: isDarkMode ? 'var(--background)' : '#ffffffed', backdropFilter: 'blur(10px)' }}>
        <div className="relative w-[80%]">
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "pl-9 h-10 w-full rounded-md",
              isDarkMode ? "bg-background border-input" : "bg-white"
            )}
            data-command-k-input="true"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>
      
      <div className="h-[calc(100vh-71px)] overflow-hidden flex-grow">
        {isLoading ? (
          <div className="h-full overflow-auto pt-[71px]">
            <div className="w-[320px]">
              {Array(5).fill(0).map((_, index) => (
                <ConversationSkeleton key={index} />
              ))}
            </div>
          </div>
        ) : showEmptyState ? (
          <div className="flex items-center justify-center h-full pt-[71px]">
            <EmptyState />
          </div>
        ) : (
          <div className="h-full overflow-auto pt-[71px]">
            <div className="w-[320px]">
              {filteredConversations.map(conversation => (
                <button
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation)}
                  className={cn(
                    "w-full text-left py-3 px-4 rounded-none transition-colors border-b border-border/30",
                    "hover:bg-accent/20",
                    selectedConversationId === conversation.id && "bg-accent/20"
                  )}
                  style={{ width: '320px', maxWidth: '320px', boxSizing: 'border-box' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm truncate max-w-[85%]">
                      {truncateText(conversation.title || "Untitled Conversation", 35)}
                    </span>
                    <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap flex-shrink-0">
                      {conversation.timestamp ? formatMessageDate(conversation.timestamp) : ""}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground/80 truncate">
                    {truncateText(conversation.lastMessage || getDefaultMessage(conversation.title || ""), 50)}
                  </div>
                  <div className="text-[11px] text-muted-foreground/70 mt-0.5">
                    with {conversation.agentName}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 