
"use client"

import React, { useEffect, useRef, useState, Suspense, useCallback, useMemo } from "react"
import "@/app/styles/chat-optimizations.css"
import { useSearchParams, useRouter } from "next/navigation"
import { agents } from "@/app/data/mock-agents"
import { Breadcrumb } from "@/app/components/navigation/Breadcrumb"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { markUINavigation } from "@/app/hooks/use-navigation-history"
import { useTheme } from "@/app/context/ThemeContext"
import { useSite } from "@/app/context/SiteContext"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { ChatList } from "@/app/components/chat/chat-list"
import { ChatToggle } from "@/app/components/chat/chat-toggle"
import { useCommandK } from "@/app/hooks/use-command-k"
// Chat service functions are imported dynamically where used to avoid client bundling issues
import * as Icons from "@/app/components/ui/icons"
import { Agent } from "@/app/types/agents"

// New imports for refactored components
import { ChatHeader } from "@/app/components/chat/ChatHeader"
import { ChatMessages } from "@/app/components/chat/ChatMessages"
import { ChatInput } from "@/app/components/chat/ChatInput"
import { InvalidatedLeadModal } from "@/app/components/chat/InvalidatedLeadModal"
import { useLeadData } from "@/app/hooks/useLeadData"
import { useChatMessages } from "@/app/hooks/useChatMessages"
import { useChatOperations } from "@/app/hooks/useChatOperations"
import { useApiRequestTracker } from "@/app/hooks/useApiRequestTracker"
import { useOptimizedMessageState } from "@/app/hooks/useOptimizedMessageState"
// import { useSimpleMessageState } from "@/app/hooks/useSimpleMessageState" // For testing
import { useOptimizedKeyboardHandler } from "@/app/hooks/useOptimizedKeyboardHandler"

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
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null)
  
  // Optimized message state management - debounced re-renders
  const { message, setMessage, messageRef, clearMessage, handleMessageChange, textareaRef } = useOptimizedMessageState()
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
  
  // Track API requests to /agents/chat/message (per conversationId)
  const { hasActiveChatRequest } = useApiRequestTracker()
  
  // Use our new hooks for better organization
  const {
    leadData,
    isLoadingLead,
    isAgentOnlyConversation,
    setIsAgentOnlyConversation,
    isLead,
    isLeadInvalidated,
    refreshLeadData
  } = useLeadData(conversationId, currentSite?.id)
  
  // State for invalidated lead modal
  const [showInvalidatedModal, setShowInvalidatedModal] = useState(false)
  const [isDeletingConversation, setIsDeletingConversation] = useState(false)
  
  const {
    chatMessages,
    setChatMessages,
    isLoadingMessages,
    isAgentResponding,
    setIsAgentResponding,
    isTransitioningConversation,
    clearMessagesForTransition
  } = useChatMessages(conversationId, agentId, agentName, isAgentOnlyConversation)
  
  const {
    isLoading,
    handleSendMessage,
    handleRetryMessage,
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
      // Add a small delay to allow the fade-in animation to start before scrolling
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 50)
    }
  }, [chatMessages, isAgentResponding])

  // Uncontrolled message submission using ref
  const handleSendMessageSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const currentMessage = messageRef.current.trim()
    
    if (currentMessage) {
      await handleSendMessage(currentMessage)
      clearMessage()
      
      // Scroll to bottom after sending message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 150)
    }
  }, [handleSendMessage, clearMessage, messageRef])

  // Use optimized keyboard handler
  const { handleKeyDown } = useOptimizedKeyboardHandler({
    messageRef,
    isLoading,
    onSendMessage: handleSendMessageSubmit
  })

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
          const { getAgentForConversation } = await import("@/app/services/chat-service.client")
          const dbAgent: Agent | null = await getAgentForConversation(agentId)
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
  const handleSelectConversation = useCallback((selectedConversationId: string, selectedAgentName: string, selectedAgentId: string, conversationTitle?: string) => {
    // First clear messages and set transition state to show skeleton
    if (conversationId !== selectedConversationId) {
      clearMessagesForTransition();
    }
    
    // Use the native history API to update the URL without triggering a hard reload
    // Include conversation title if available
    const titleParam = conversationTitle ? `&title=${encodeURIComponent(conversationTitle)}` : ''
    const newUrl = `/chat?conversationId=${selectedConversationId}&agentId=${selectedAgentId}&agentName=${encodeURIComponent(selectedAgentName)}${titleParam}`
    window.history.pushState(null, '', newUrl)
    
    // We need to replace the window.location.search to ensure the component picks up the new parameters
    markUINavigation();
    router.replace(newUrl);
  }, [conversationId, clearMessagesForTransition, router])

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
          const { getAgentForConversation } = await import("@/app/services/chat-service.client")
          const agent: Agent | null = await getAgentForConversation(conversationAgentId)
          if (agent) {
            // Update the URL with the agent details
            markUINavigation();
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
        const { checkApiServerAvailability } = await import("@/app/services/chat-service.client")
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
          clearMessagesForTransition();
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
            import("@/app/services/chat-service.client").then(async (mod) => {
              const dbAgent: Agent | null = await mod.getAgentForConversation(agId)
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
            }).catch((error: unknown) => {
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
  }, [conversationId, agentId, clearMessagesForTransition, setIsAgentOnlyConversation])

  // Memoize conversation validation to avoid unnecessary calculations
  const hasSelectedConversation = useMemo(() => {
    return conversationId && conversationId !== "" && !conversationId.startsWith("new-")
  }, [conversationId])

  // Sobrescribe el estado de isAgentResponding desde el tracker de API
  useEffect(() => {
    // Sincronizar estado de animación de carga según peticiones activas para esta conversación específica
    const hasActiveRequest = hasActiveChatRequest(conversationId)
    setIsAgentResponding(hasActiveRequest)
    
    if (hasActiveRequest) {
      console.log(`[ChatPage] Animación activada por petición activa a /agents/chat/message para conversationId: ${conversationId}`)
    }
  }, [hasActiveChatRequest, conversationId, setIsAgentResponding])

  // Show modal when lead is invalidated (only for valid conversations)
  useEffect(() => {
    const hasValidConversation = conversationId && conversationId !== "" && !conversationId.startsWith("new-")
    
    if (isLeadInvalidated && hasValidConversation && !showInvalidatedModal) {
      setShowInvalidatedModal(true)
    }
    
    // Reset modal state when conversation changes
    if (!hasValidConversation && showInvalidatedModal) {
      setShowInvalidatedModal(false)
    }
  }, [isLeadInvalidated, showInvalidatedModal, conversationId])

  // Function to delete conversation and messages
  const handleDeleteConversation = useCallback(async () => {
    if (!conversationId || conversationId.startsWith("new-")) {
      console.warn("Invalid conversation ID, skipping deletion")
      return
    }
    
    console.log("Starting deletion of conversation:", conversationId)
    setIsDeletingConversation(true)
    
    try {
      const supabase = createClient()
      
      // Delete messages first (due to foreign key constraints)
      console.log("Deleting messages for conversation:", conversationId)
      const { data: deletedMessages, error: messagesError } = await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", conversationId)
        .select()
      
      if (messagesError) {
        console.error("Error deleting messages:", messagesError)
        throw messagesError
      }
      
      console.log("Messages deleted:", deletedMessages?.length || 0)
      
      // Delete the conversation
      console.log("Deleting conversation:", conversationId)
      const { data: deletedConversation, error: conversationError } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId)
        .select()
      
      if (conversationError) {
        console.error("Error deleting conversation:", conversationError)
        throw conversationError
      }
      
      console.log("Conversation deleted successfully:", deletedConversation)
      
      // Emit event to reload conversations list
      window.dispatchEvent(new CustomEvent('conversation:deleted', { 
        detail: { conversationId } 
      }))
      
      // Close modal first
      setShowInvalidatedModal(false)
      setIsDeletingConversation(false)
      
      // Redirect to chat page (without conversation ID)
      markUINavigation();
      router.push("/chat")
    } catch (error) {
      console.error("Error deleting conversation:", error)
      alert("Failed to delete conversation. Please try again.")
      setIsDeletingConversation(false)
    }
  }, [conversationId, router])

  const handleCancelDelete = useCallback(() => {
    setShowInvalidatedModal(false)
    // Redirect to chat list
    markUINavigation();
    router.push("/chat")
  }, [router])

  return (
    <>
      {/* Invalidated Lead Modal */}
      <InvalidatedLeadModal
        isOpen={showInvalidatedModal}
        onConfirm={handleDeleteConversation}
        onCancel={handleCancelDelete}
        isDeleting={isDeletingConversation}
      />
      
      <div className="flex h-full relative overflow-visible">
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
            onLeadStatusUpdate={refreshLeadData}
          />
        </div>
        
        {/* Chat messages area */}
        <ChatMessages 
          chatMessages={chatMessages}
          isLoadingMessages={isLoadingMessages}
          isAgentResponding={isAgentResponding}
          isTransitioningConversation={isTransitioningConversation}
          messagesEndRef={messagesEndRef}
          agentId={agentId}
          agentName={agentName}
          isAgentOnlyConversation={isAgentOnlyConversation}
          isLead={Boolean(leadData && (leadData.id || (leadData as any)?.lead_id))}
          leadData={leadData}
          conversationId={conversationId}
          onRetryMessage={handleRetryMessage}
          onMessagesUpdate={setChatMessages}
        />
        
        {/* Message input area */}
        {hasSelectedConversation && (
          <ChatInput 
            setMessage={setMessage}
            handleMessageChange={handleMessageChange}
            textareaRef={textareaRef}
            isLoading={isLoading}
            handleSendMessage={handleSendMessageSubmit}
            handleKeyDown={handleKeyDown}
            conversationId={conversationId}
            isChatListCollapsed={isChatListCollapsed}
            leadData={leadData}
            isAgentOnlyConversation={isAgentOnlyConversation}
          />
        )}
      </div>
    </div>
    </>
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