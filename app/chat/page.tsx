"use client"

import React, { useEffect, useRef, useState } from "react"
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

export default function ChatPage() {
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

  // Scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  // Wrapper function for the form submission
  const handleSendMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim()) {
      await handleSendMessage(message)
      setMessage("")
    }
  }

  // Handle keyboard shortcuts for sending messages
  const handleKeyDown = (e: React.KeyboardEvent) => {
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
  }

  // Load agent data when agentId changes
  useEffect(() => {
    const loadAgent = async () => {
      // First try to find the agent in our mock list
      const mockAgent = agents.find((a: Agent) => a.id === agentId)
      
      if (mockAgent) {
        setCurrentAgent(mockAgent)
        console.log("Found agent in mock list:", mockAgent.name, "with icon:", mockAgent.icon)
        
        // Verify the icon exists
        const IconComponent = mockAgent.icon ? Icons[mockAgent.icon as keyof typeof Icons] : null
        console.log("IconComponent exists:", !!IconComponent)
      } else {
        console.log("Agent not found in mock list, trying database for id:", agentId)
        
        // Try to load from database
        try {
          const dbAgent = await getAgentForConversation(agentId)
          if (dbAgent) {
            console.log("Found agent in database:", dbAgent.name)
            setCurrentAgent(dbAgent)
          } else {
            console.log("Agent not found in database either for id:", agentId)
          }
        } catch (error) {
          console.error("Error fetching agent from database:", error)
        }
      }
    }
    
    if (agentId) {
      loadAgent()
    }
  }, [agentId])

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
    // Update page title
    document.title = `Chat with ${agentName} | Market Fit`
    
    // Emit an event to update the breadcrumb
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        agentId,
        agentName
      }
    })
    
    window.dispatchEvent(event)
    
    // Clean up when unmounting
    return () => {
      document.title = 'Market Fit'
    }
  }, [agentId, agentName])

  // Function to toggle chat list visibility
  const toggleChatList = () => {
    setIsChatListCollapsed(!isChatListCollapsed)
  }

  // Function to select a conversation
  const handleSelectConversation = (selectedConversationId: string, selectedAgentName: string, selectedAgentId: string) => {
    // Use the native history API to update the URL without triggering a hard reload
    const newUrl = `/chat?conversationId=${selectedConversationId}&agentId=${selectedAgentId}&agentName=${encodeURIComponent(selectedAgentName)}`
    window.history.pushState(null, '', newUrl)
    
    // Manually update the conversationId, agentName and agentId to trigger UI updates
    if (conversationId !== selectedConversationId) {
      console.log("Changing conversation without reload:", selectedConversationId)
      
      // Clear any existing messages while we load the new conversation
      setChatMessages([])
    }
  }

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
        console.log("API server availability:", isAvailable ? "Available" : "Not available")
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
      
      if (convId && agId && agName && convId !== conversationId) {
        console.log("popstate detected - loading conversation:", convId)
        
        // Mode-specific handling
        if (mode === 'agentOnly' || mode === 'private') {
          console.log("popstate detected - setting agent-only mode from URL")
          setIsAgentOnlyConversation(true)
        }
      }
    }
    
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [conversationId, setIsAgentOnlyConversation])

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
        />
        
        {/* Message input area */}
        <ChatInput 
          message={message}
          setMessage={setMessage}
          isLoading={isLoading}
          handleSendMessage={handleSendMessageSubmit}
          handleKeyDown={handleKeyDown}
        />
      </div>
    </div>
  )
}

// Static initial breadcrumb (will be updated with useEffect)
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