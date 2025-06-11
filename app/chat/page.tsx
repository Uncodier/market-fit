"use client"

import React, { useEffect, useRef, useState, Suspense, useCallback, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
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
import { checkApiServerAvailability, getAgentForConversation } from "@/app/services/chat-service"
import * as Icons from "@/app/components/ui/icons"
import { Agent } from "@/app/types/agents"

// New imports for refactored components
import { ChatHeader } from "@/app/components/chat/ChatHeader"
import { ChatMessages } from "@/app/components/chat/ChatMessages"
import { ChatInput } from "@/app/components/chat/ChatInput"
import { useLeadData } from "@/app/hooks/useLeadData"
import { useChatMessages } from "@/app/hooks/useChatMessages"
import { useChatOperations } from "@/app/hooks/useChatOperations"
import { useApiRequestTracker } from "@/app/hooks/useApiRequestTracker"

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading chat...</div>}>
      <ChatPageContent />
    </Suspense>
  )
}

function ChatPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const agentId = searchParams.get("agentId") || ""
  const agentName = searchParams.get("agentName") || "Agent"
  const conversationId = searchParams.get("conversationId") || ""
  const [message, setMessage] = useState("")
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null)
  const { user } = useAuthContext()
  const { currentSite } = useSite()
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)
  
  // Estado para controlar la visibilidad de la lista de chats
  const [isChatListCollapsed, setIsChatListCollapsed] = useState(false)
  
  // Estado para verificar la disponibilidad del API server
  const [isApiServerAvailable, setIsApiServerAvailable] = useState<boolean | null>(null)
  
  // Initialize the theme context
  const { theme, isDarkMode } = useTheme()
  
  // Initialize the useCommandK hook
  useCommandK()
  
  // Track API requests to /agents/chat/message
  const { hasActiveChatRequest } = useApiRequestTracker()
  
  // Use our new hooks for better organization
  const {
    leadData,
    isLoadingLead,
    isAgentOnlyConversation,
    setIsAgentOnlyConversation,
    isLead
  } = useLeadData(conversationId, currentSite?.id)
  
  const {
    chatMessages,
    setChatMessages,
    isLoadingMessages,
    isAgentResponding,
    setIsAgentResponding
  } = useChatMessages(conversationId, agentId, agentName, isAgentOnlyConversation)
  
  const {
    isLoading,
    handleSendMessage,
    startNewConversation,
    handleNewLeadConversation,
    handleNewAgentConversation,
    handlePrivateDiscussion
  } = useChatOperations({
    agentId,
    agentName,
    conversationId,
    isAgentOnlyConversation,
    setChatMessages,
    setIsAgentResponding,
    leadData
  })

  // Scroll to bottom when new messages are added or when loading state changes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [chatMessages, isAgentResponding])

  // Wrapper function for the form submission - optimized with useCallback
  const handleSendMessageSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim()) {
      await handleSendMessage(message)
      setMessage("")
      
      // Forzar scroll al final inmediatamente después de enviar un mensaje
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)
    }
  }, [message, handleSendMessage, setMessage])

  // Handle keyboard shortcuts for sending messages - optimized with useCallback
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Send with Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (message.trim() && !isLoading) {
        handleSendMessageSubmit(e as unknown as React.FormEvent)
      }
    }
    
    // Special case for multiline text: allow Shift+Enter
    if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey) {
      // Don't prevent default to allow line break
    }
  }, [message, isLoading, handleSendMessageSubmit])

  // Load agent data when agentId changes
  useEffect(() => {
    const loadAgent = async () => {
      // First try to find the agent in our mock list
      const mockAgent = agents.find((a: Agent) => a.id === agentId)
      
      if (mockAgent) {
        setCurrentAgent(mockAgent)
      } else {
        // Try to load from database
        try {
          const dbAgent = await getAgentForConversation(agentId)
          if (dbAgent) {
            setCurrentAgent(dbAgent)
          } else {
            // Si no se pudo cargar el agente y tenemos un nombre, creamos uno temporal
            if (agentName) {
              setCurrentAgent({
                id: agentId,
                name: agentName,
                description: "",
                type: "support",
                status: "active",
                conversations: 0,
                successRate: 0,
                lastActive: new Date().toISOString(),
                icon: "User"
              });
            }
          }
        } catch (error) {
          console.error("Error fetching agent from database:", error)
          // Si hubo error pero tenemos el nombre, al menos mostramos un agente temporal
          if (agentName) {
            setCurrentAgent({
              id: agentId,
              name: agentName,
              description: "",
              type: "support",
              status: "active", 
              conversations: 0,
              successRate: 0,
              lastActive: new Date().toISOString(),
              icon: "User"
            });
          }
        }
      }
    }
    
    if (agentId) {
      console.log(`Loading agent data for agentId: ${agentId}, name: ${agentName}`);
      loadAgent()
    }
  }, [agentId, agentName])

  // Fetch user avatar
  useEffect(() => {
    const fetchUserAvatar = async () => {
      if (!user) return
      
      try {
        const supabase = createClient()
        
        // First try to get the user's profile from the database using email
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('email', user.email)
          .single()
          
        if (!error && profile && profile.avatar_url) {
          setUserAvatarUrl(profile.avatar_url)
          return
        }
        
        // If no avatar in profile, try with user_metadata
        if (user.user_metadata?.avatar_url) {
          setUserAvatarUrl(user.user_metadata.avatar_url)
          return
        }
        
        // Try with identities if available
        if (user.identities?.[0]?.identity_data?.avatar_url) {
          setUserAvatarUrl(user.identities[0].identity_data.avatar_url)
          return
        }
        
        // If no avatar anywhere, use initial with color generated from email
        setUserAvatarUrl(null)
      } catch (error) {
        console.error("Error fetching user avatar:", error)
        // Default to null to use initials
        setUserAvatarUrl(null)
      }
    }
    
    fetchUserAvatar()
  }, [user])

  // Update breadcrumb when page is loaded
  useEffect(() => {
    // Determinar el nombre a mostrar - preferir currentAgent.name sobre agentName
    const displayName = currentAgent?.name || agentName;
    
    // Update page title
    document.title = `Chat with ${displayName} | Market Fit`
    
    // Emit an event to update the breadcrumb
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        agentId,
        agentName: displayName
      }
    })
    
    window.dispatchEvent(event)
    
    // Clean up when unmounting
    return () => {
      document.title = 'Market Fit'
    }
  }, [agentId, agentName, currentAgent])

  // Function to toggle chat list visibility - memoized for performance
  const toggleChatList = useCallback(() => {
    setIsChatListCollapsed(!isChatListCollapsed)
  }, [isChatListCollapsed])

  // Function to select a conversation - memoized for performance
  const handleSelectConversation = useCallback((selectedConversationId: string, selectedAgentName: string, selectedAgentId: string) => {
    // First clear messages to avoid showing previous conversation data
    if (conversationId !== selectedConversationId) {
      setChatMessages([]);
    }
    
    // Use the native history API to update the URL without triggering a hard reload
    const newUrl = `/chat?conversationId=${selectedConversationId}&agentId=${selectedAgentId}&agentName=${encodeURIComponent(selectedAgentName)}`
    window.history.pushState(null, '', newUrl)
    
    // We need to replace the window.location.search to ensure the component picks up the new parameters
    router.replace(newUrl);
  }, [conversationId, setChatMessages, router])

  // Fetch agent details when conversationId changes
  useEffect(() => {
    async function fetchConversationAgent() {
      if (!conversationId || conversationId.startsWith("new-")) return
      
      try {
        // Get the conversation to find its agent ID
        const { data: conversation, error } = await createClient()
          .from("conversations")
          .select("agent_id")
          .eq("id", conversationId)
          .single()
          
        if (error || !conversation) {
          console.error("Error fetching conversation agent:", error)
          return
        }
        
        const conversationAgentId = conversation.agent_id
        
        // Only update if we have a valid agent ID and it's different from current agentId
        if (conversationAgentId && conversationAgentId !== agentId) {
          // Get agent details
          const agent = await getAgentForConversation(conversationAgentId)
          if (agent) {
            // Update the URL with the agent details
            router.replace(`/chat?conversationId=${conversationId}&agentId=${agent.id}&agentName=${encodeURIComponent(agent.name)}`)
          }
        }
      } catch (error) {
        console.error("Error fetching agent details:", error)
      }
    }
    
    fetchConversationAgent()
  }, [conversationId, router, agentId])

  // Check API server availability when the page loads
  useEffect(() => {
    const checkApiServer = async () => {
      try {
        const isAvailable = await checkApiServerAvailability()
        setIsApiServerAvailable(isAvailable)
      } catch (error) {
        console.error("Error checking API server:", error)
        setIsApiServerAvailable(false)
      }
    }
    
    checkApiServer()
  }, [])

  // Add a listener for popstate events (browser back/forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const url = new URL(window.location.href)
      const convId = url.searchParams.get('conversationId')
      const agId = url.searchParams.get('agentId')
      const agName = url.searchParams.get('agentName')
      const mode = url.searchParams.get('mode')
      
      // Actualizar conversationId, agentId y agentName si han cambiado
      if (convId && agId && agName) {
        // Forzar recarga de mensajes si cambió la conversación
        if (convId !== conversationId) {
          setChatMessages([]);
        }
        
        // Mode-specific handling
        if (mode === 'agentOnly' || mode === 'private') {
          setIsAgentOnlyConversation(true)
        } else {
          setIsAgentOnlyConversation(false)
        }
        
        // Forzar la carga del agente si cambió el agentId
        if (agId !== agentId) {
          // Primero intentar cargar desde la lista mock
          const mockAgent = agents.find((a: Agent) => a.id === agId)
          if (mockAgent) {
            setCurrentAgent(mockAgent)
          } else {
            // Intenta cargar desde la base de datos
            getAgentForConversation(agId).then(dbAgent => {
              if (dbAgent) {
                setCurrentAgent(dbAgent)
              } else if (agName) {
                // Fallback a un agente temporal con el nombre de la URL
                setCurrentAgent({
                  id: agId,
                  name: agName,
                  description: "",
                  type: "support",
                  status: "active",
                  conversations: 0,
                  successRate: 0,
                  lastActive: new Date().toISOString(),
                  icon: "User"
                });
              }
            }).catch(error => {
              console.error("Error fetching agent during popstate:", error)
              // Fallback a un agente temporal con el nombre de la URL
              if (agName) {
                setCurrentAgent({
                  id: agId,
                  name: agName,
                  description: "",
                  type: "support",
                  status: "active",
                  conversations: 0,
                  successRate: 0,
                  lastActive: new Date().toISOString(),
                  icon: "User"
                });
              }
            });
          }
        }
      }
    }
    
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [conversationId, agentId, setChatMessages, setIsAgentOnlyConversation])

  // Memoize conversation validation to avoid unnecessary calculations
  const hasSelectedConversation = useMemo(() => {
    return conversationId && conversationId !== "" && !conversationId.startsWith("new-")
  }, [conversationId])

  // Sobrescribe el estado de isAgentResponding desde el tracker de API
  useEffect(() => {
    // Sincronizar estado de animación de carga según peticiones activas
    setIsAgentResponding(hasActiveChatRequest)
    
    if (hasActiveChatRequest) {
      console.log("[ChatPage] Animación activada por petición activa a /agents/chat/message")
    }
  }, [hasActiveChatRequest, setIsAgentResponding])

  return (
    <div className="flex h-full relative overflow-hidden">
      {/* Chat list */}
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
      
      {/* Main chat content */}
      <div className={cn(
        "flex flex-col h-full transition-all duration-300 ease-in-out flex-1",
        isChatListCollapsed ? "ml-0" : "ml-0"
      )}>
        {/* Chat header with agent and lead info */}
        <div className="relative">
          {/* Header with agent and lead info */}
          <ChatHeader 
            agentId={agentId}
            agentName={agentName}
            currentAgent={currentAgent}
            isAgentOnlyConversation={isAgentOnlyConversation}
            isLoadingLead={isLoadingLead}
            leadData={leadData}
            isLead={isLead}
            isChatListCollapsed={isChatListCollapsed}
            toggleChatList={toggleChatList}
            startNewConversation={startNewConversation}
            handleNewLeadConversation={handleNewLeadConversation}
            handleNewAgentConversation={handleNewAgentConversation}
            handlePrivateDiscussion={handlePrivateDiscussion}
            conversationId={conversationId}
          />
        </div>
        
        {/* Chat messages area */}
        <ChatMessages 
          chatMessages={chatMessages}
          isLoadingMessages={isLoadingMessages}
          isAgentResponding={isAgentResponding}
          messagesEndRef={messagesEndRef}
          agentId={agentId}
          agentName={agentName}
          isAgentOnlyConversation={isAgentOnlyConversation}
          leadData={leadData}
          conversationId={conversationId}
        />
        
        {/* Message input area */}
        {hasSelectedConversation && (
          <ChatInput 
            message={message}
            setMessage={setMessage}
            isLoading={isLoading}
            handleSendMessage={handleSendMessageSubmit}
            handleKeyDown={handleKeyDown}
            conversationId={conversationId}
          />
        )}
      </div>
    </div>
  )
}

// Static initial breadcrumb (will be updated with useEffect)
ChatPageContent.breadcrumb = (
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