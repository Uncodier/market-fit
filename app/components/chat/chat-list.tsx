"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Search, PlusCircle } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { Input } from "@/app/components/ui/input"
import { useTheme } from "@/app/context/ThemeContext"

interface Conversation {
  id: string
  title: string
  agentId: string
  agentName: string
  lastMessage?: string
  timestamp: Date
}

interface ChatListProps {
  isCollapsed: boolean
  conversations?: Conversation[]
  currentConversationId?: string
  onNewConversation?: () => void
  className?: string
}

export function ChatList({
  isCollapsed,
  conversations = [],
  currentConversationId,
  onNewConversation,
  className
}: ChatListProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [isVisible, setIsVisible] = useState(!isCollapsed)
  const { isDarkMode } = useTheme()

  // Manejar la animación de ocultar/mostrar
  useEffect(() => {
    if (isCollapsed) {
      // Primero hacemos la animación y luego ocultamos el contenido
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 300) // Mismo tiempo que la duración de la transición
      return () => clearTimeout(timer)
    } else {
      // Al mostrar, primero hacemos visible el contenido
      setIsVisible(true)
    }
  }, [isCollapsed])

  // This would typically come from a database or API
  const dummyConversations: Conversation[] = conversations.length > 0 ? conversations : [
    {
      id: "1",
      title: "Marketing Strategy",
      agentId: "marketing",
      agentName: "Marketing Assistant",
      lastMessage: "Let's discuss your target audience",
      timestamp: new Date(Date.now() - 1000 * 60 * 30)
    },
    {
      id: "2",
      title: "Product Analysis",
      agentId: "product",
      agentName: "Product Analyst",
      lastMessage: "I've analyzed your product features",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2)
    }
  ]

  const handleSelectConversation = (conversation: Conversation) => {
    router.push(`/chat?conversationId=${conversation.id}&agentId=${conversation.agentId}&agentName=${conversation.agentName}`)
  }

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  // Filter conversations based on search query
  const filteredConversations = dummyConversations.filter(conversation => 
    conversation.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!isVisible) {
    return null
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Top bar with search input - adaptable to dark mode */}
      <div className={cn(
        "flex items-center justify-center h-[71px] border-b transition-colors duration-300",
        isDarkMode ? "bg-background" : "bg-white"
      )}>
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
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {filteredConversations.map((conversation) => (
            <Button
              key={conversation.id}
              variant={conversation.id === currentConversationId ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start text-left h-auto py-3 px-4",
                conversation.id === currentConversationId ? "bg-secondary" : ""
              )}
              onClick={() => handleSelectConversation(conversation)}
            >
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-start">
                  <p className="font-medium truncate">{conversation.title}</p>
                  <span className="text-xs text-muted-foreground ml-2">
                    {formatTimestamp(conversation.timestamp)}
                  </span>
                </div>
                {conversation.lastMessage && (
                  <p className="text-sm text-muted-foreground truncate">
                    {conversation.lastMessage}
                  </p>
                )}
              </div>
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
} 