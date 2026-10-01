
"use client"

import React, { useEffect, useState, Suspense, useCallback, useMemo } from "react"
import "@/app/styles/chat-optimizations.css"
import { useSearchParams, useRouter } from "next/navigation"
import { Breadcrumb } from "@/app/components/navigation/Breadcrumb"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { markUINavigation } from "@/lib/navigation/navigation-helpers"
import { useSite } from "@/app/context/SiteContext"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { ChatList } from "@/app/components/chat/chat-list"
import { useCommandK } from "@/app/hooks/use-command-k"
// Chat service functions are imported dynamically where used to avoid client bundling issues
import * as Icons from "@/app/components/ui/icons"

// New imports for refactored components
import { ChatHeader } from "@/app/components/chat/ChatHeader"
import { ChatMessages } from "@/app/components/chat/ChatMessages"
import { ChatInput } from "@/app/components/chat/ChatInput"
import { InvalidatedLeadModal } from "@/app/components/chat/InvalidatedLeadModal"
import { useLeadData } from "@/app/hooks/useLeadData"
import { useChatMessages } from "@/app/hooks/useChatMessages"
import { useChatScroll } from "./useChatScroll"
import { useChatDraftSubmit } from "./useChatDraftSubmit"
import { useChatPageAgent } from "./useChatPageAgent"
import { useChatOperations } from "@/app/hooks/useChatOperations"
import { useApiRequestTracker } from "@/app/hooks/useApiRequestTracker"
import { useOptimizedMessageState } from "@/app/hooks/useOptimizedMessageState"
// import { useSimpleMessageState } from "@/app/hooks/useSimpleMessageState" // For testing
import { useOptimizedKeyboardHandler } from "@/app/hooks/useOptimizedKeyboardHandler"
import { useLayout } from "@/app/context/LayoutContext"
import { useAutoCollapseSidebar } from "@/app/hooks/use-auto-collapse-sidebar"

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
  const agentId = searchParams.get("agentId") || ""
  const agentName = searchParams.get("agentName") || "Agent"
  const conversationId = searchParams.get("conversationId") || ""
  
  // Optimized message state management - debounced re-renders
  const chatCacheKey = conversationId && !conversationId.startsWith("new-") ? `chat-${conversationId}` : 'chat-new'
  const { setMessage, messageRef, clearMessage, handleMessageChange, textareaRef } = useOptimizedMessageState("", chatCacheKey)
  const { user } = useAuthContext()
  const { currentSite } = useSite()
  const [, setUserAvatarUrl] = useState<string | null>(null)
  
  const [isChatListCollapsed, setIsChatListCollapsed] = useAutoCollapseSidebar()
  
  // Track API server availability.
  const [, setIsApiServerAvailable] = useState<boolean | null>(null)
  
  const { isLayoutCollapsed } = useLayout()
  
  // Initialize the useCommandK hook
  useCommandK()
  
  // Track API requests to /agents/chat/message (per conversationId)
  const { hasActiveChatRequest } = useApiRequestTracker()
  
  // Use our new hooks for better organization
  const {
    leadData,
    participantIdentity,
    isLoadingLead,
    isAgentOnlyConversation,
    isConversationReady,
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
    isConversationReady,
    setChatMessages,
    setIsAgentResponding,
    leadData
  })

  const currentAgent = useChatPageAgent({
    agentId, agentName, conversationId, clearMessagesForTransition,
  })

  const { messagesEndRef, messagesContainerRef, userJustSentRef } = useChatScroll(
    conversationId, chatMessages, isAgentResponding,
  )

  const handleSendMessageSubmit = useChatDraftSubmit({
    conversationId, messageRef, clearMessage, handleSendMessage, userJustSentRef,
  })

  // Use optimized keyboard handler
  const { handleKeyDown } = useOptimizedKeyboardHandler({
    messageRef,
    isLoading,
    onSendMessage: handleSendMessageSubmit
  })

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

  // Function to toggle chat list visibility - memoized for performance
  const toggleChatList = useCallback(() => {
    setIsChatListCollapsed(!isChatListCollapsed)
  }, [isChatListCollapsed, setIsChatListCollapsed])

  // Handle back to mobile list
  const handleBackToMobileList = useCallback(() => {
    markUINavigation();
    router.push('/chat');
  }, [router]);

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

  // Memoize conversation validation to avoid unnecessary calculations
  const hasSelectedConversation = useMemo(() => {
    return Boolean(conversationId && conversationId !== "" && !conversationId.startsWith("new-"))
  }, [conversationId])

  // Sobrescribe el estado de isAgentResponding desde el tracker de API
  useEffect(() => {
    // Synchronize the loading animation with requests for this conversation.
    const hasActiveRequest = hasActiveChatRequest(conversationId)
    setIsAgentResponding(hasActiveRequest)
    
    if (hasActiveRequest) {
      console.log(`[ChatPage] Loading animation enabled for active chat request: ${conversationId}`)
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
      
            <div className="flex h-full relative overflow-hidden w-full bg-background flex-row min-w-0">
        {/* Chat list */}
      <div className={cn(
        "h-full transition-all duration-300 ease-in-out z-[55] bg-background flex-shrink-0 border-r dark:border-white/5 border-black/5 absolute md:relative left-0",
        hasSelectedConversation ? "hidden md:block" : "w-full",
        !hasSelectedConversation && "md:w-[319px] md:min-w-[319px]",
        isChatListCollapsed
          ? "w-full md:w-0 md:min-w-0 md:opacity-0 md:border-none"
          : "w-full md:w-[319px] md:min-w-[319px] translate-x-0",
        !isChatListCollapsed && !hasSelectedConversation && "w-full md:w-[319px] md:min-w-[319px]"
      )} style={{ overflow: 'hidden' }}>
        <ChatList 
          siteId={currentSite?.id || ""}
          selectedConversationId={conversationId}
          onSelectConversation={handleSelectConversation}
          className="w-full h-full relative"
          isCollapsed={isChatListCollapsed}
          hasSelectedConversation={hasSelectedConversation}
        />
      </div>
      
      {/* Main chat content */}
      <div className={cn(
        "flex flex-col h-full transition-all duration-300 ease-in-out min-w-0 min-h-0 fixed right-0 top-[var(--topbar-height,64px)] bottom-0",
        !hasSelectedConversation ? "hidden md:flex" : "flex"
      )}
      style={{
        width: typeof window !== 'undefined' && window.innerWidth >= 768 
          ? `calc(100% - ${isLayoutCollapsed ? 64 : 256}px - ${isChatListCollapsed ? 0 : 319}px)` 
          : '100%',
        left: typeof window !== 'undefined' && window.innerWidth >= 768 
          ? `${(isLayoutCollapsed ? 64 : 256) + (isChatListCollapsed ? 0 : 319)}px` 
          : '0px'
      }}
      >
              {/* Chat header with agent and lead info */}
              <div className="w-full z-[50]">
                {/* Header with agent and lead info */}
                <ChatHeader 
            agentId={agentId}
            agentName={agentName}
            currentAgent={currentAgent}
            isAgentOnlyConversation={isAgentOnlyConversation}
            isLoadingLead={isLoadingLead}
            leadData={leadData}
            participantIdentity={participantIdentity}
            isLead={isLead}
            isChatListCollapsed={isChatListCollapsed}
            toggleChatList={toggleChatList}
            startNewConversation={startNewConversation}
            handleNewLeadConversation={handleNewLeadConversation}
            handleNewAgentConversation={handleNewAgentConversation}
            handlePrivateDiscussion={handlePrivateDiscussion}
            conversationId={conversationId}
            onLeadStatusUpdate={refreshLeadData}
            onBack={handleBackToMobileList}
          />
        </div>

        {/* Chat messages area */}
        <div className="flex-1 overflow-y-auto min-w-0 w-full relative pt-[71px] flex flex-col" ref={messagesContainerRef}>
          <div className="transition-all duration-300 ease-in-out flex-1 flex flex-col min-h-full">
            <ChatMessages 
              chatMessages={chatMessages}
              isLoadingMessages={isLoadingMessages}
              isAgentResponding={isAgentResponding}
              isTransitioningConversation={isTransitioningConversation}
              messagesEndRef={messagesEndRef}
              containerRef={messagesContainerRef}
              agentId={agentId}
              agentName={agentName}
              isAgentOnlyConversation={isAgentOnlyConversation}
              isLead={Boolean(leadData?.id)}
              leadData={leadData}
              participantIdentity={participantIdentity}
              conversationId={conversationId}
              onRetryMessage={handleRetryMessage}
              onMessagesUpdate={setChatMessages}
              isChatListCollapsed={isChatListCollapsed}
            />
          </div>
        </div>
        
        {/* Message input area */}
        {hasSelectedConversation && (
          <div className="transition-all duration-300 ease-in-out">
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
              isConversationReady={isConversationReady}
            />
          </div>
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