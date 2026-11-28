
"use client"

import React, { useEffect, useRef, useState, Suspense, useCallback, useMemo } from "react"
import "@/app/styles/chat-optimizations.css"
import { SWRConfig } from "swr"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { markUINavigation } from "@/lib/navigation/navigation-helpers"
import { useSite } from "@/app/context/SiteContext"
import { chatChannelBlockReasons } from '@/lib/chat/recipient-eligibility'
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { WorkspaceConversationList } from './WorkspaceConversationList'
import { PrivateReviewScope } from "@/app/components/chat/private-reviews"
import { useCommandK } from "@/app/hooks/use-command-k"
// Chat service functions are imported dynamically where used to avoid client bundling issues
import { useLocalization } from "@/app/context/LocalizationContext"
import { LocalizedChatBreadcrumb } from "./localized-chat-breadcrumb"

// New imports for refactored components
import { ChatHeader } from "@/app/components/chat/ChatHeader"
import { ChatMessages } from "@/app/components/chat/ChatMessages"
import { ChatInput } from "@/app/components/chat/ChatInput"
import { ConversationReplyNotice } from "./ConversationReplyNotice"
import { InvalidatedLeadModal } from "@/app/components/chat/InvalidatedLeadModal"
import { useLeadData } from "@/app/hooks/useLeadData"
import { useCommentReplySelection } from '@/app/hooks/useCommentReplySelection'
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
  const { t } = useLocalization()
  const auth = useAuthContext()
  const site = useSite()
  const reviewSiteId = !auth.user?.is_anonymous && site.requestScope?.actorId === auth.user?.id ? site.requestScope?.siteId : undefined
  const reviewEnabled = !site.isLoading && !!site.currentSite && site.currentSite.id === reviewSiteId
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen">{t("details.chat.loading")}</div>}>
      <PrivateReviewScope actorId={auth.isLoading ? undefined : auth.user?.id} siteId={reviewSiteId}
        enabled={reviewEnabled}>
        {/* Never use the previous thread's routing metadata during navigation. */}
        <SWRConfig value={{ keepPreviousData: false }}>
          <ChatPageContent />
        </SWRConfig>
      </PrivateReviewScope>
    </Suspense>
  )
}

function ChatPageContent() {
  const { t } = useLocalization()
  const translateRef = useRef(t)
  useEffect(() => {
    translateRef.current = t
  }, [t])

  const searchParams = useSearchParams()
  const router = useRouter()
  const agentId = searchParams.get("agentId") || ""
  const agentName = searchParams.get("agentName") || "Agent"
  // Translate the display fallback without changing names used by chat data hooks.
  const displayAgentName = searchParams.get("agentName") || t("details.chat.agent")
  const conversationId = searchParams.get("conversationId") || ""
  
  // Optimized message state management - debounced re-renders
  const chatCacheKey = conversationId && !conversationId.startsWith("new-") ? `chat-${conversationId}` : 'chat-new'
  const { setMessage, messageRef, clearMessage, handleMessageChange, textareaRef } = useOptimizedMessageState("", chatCacheKey)
  const { currentSite, isLoading: isLoadingSite, error: siteError, refreshSites } = useSite()
  
  const [isChatListCollapsed, setIsChatListCollapsed] = useAutoCollapseSidebar()
  
  const { sidebarWidth } = useLayout()
  
  // Initialize the useCommandK hook
  useCommandK()
  
  // Track API requests to /agents/chat/message (per conversationId)
  const { hasActiveChatRequest } = useApiRequestTracker()
  
  // Use our new hooks for better organization
  const {
    leadData,
    participantIdentity,
    visitorPhone,
    isLoadingVisitorPhone,
    conversationCustomData,
    conversationChannel,
    isLoadingLead,
    isAgentOnlyConversation,
    isConversationReady,
    conversationLoadFailed,
    isValidatingConversation,
    isLead,
    isLeadInvalidated,
    refreshLeadData
  } = useLeadData(conversationId, currentSite?.id)
  const onChannelCommitted = useCallback((channel: string) => {
    refreshLeadData(channel)
  }, [refreshLeadData])
  
  const internalReview = conversationChannel === 'internal_review'
  const allowMessageActions = isConversationReady && !internalReview

  // State for invalidated lead modal
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
  const commentReply = useCommentReplySelection(conversationId, currentSite?.id, conversationCustomData, chatMessages)
  const channelBlockReasons = useMemo(() => {
    if (isAgentOnlyConversation || commentReply.isCommentConversation) return undefined
    const reasons = chatChannelBlockReasons(currentSite, { lead: leadData, visitorPhone,
      conversationData: conversationCustomData, conversationChannel, messages: chatMessages })
    if (!isLoadingVisitorPhone) return reasons
    return { ...reasons, whatsapp: reasons.whatsapp || 'chat.input.loadingSettings',
      sms: reasons.sms || 'chat.input.loadingSettings' }
  }, [isAgentOnlyConversation, commentReply.isCommentConversation, currentSite, leadData,
    visitorPhone, isLoadingVisitorPhone, conversationCustomData, conversationChannel, chatMessages])
  
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
    isConversationReady: allowMessageActions,
    channelBlockReasons,
    conversationChannel,
    isCommentConversation: commentReply.isCommentConversation,
    commentReplyTarget: commentReply.target,
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
    conversationId, deliveryAllowed: allowMessageActions, messageRef, clearMessage, handleSendMessage, userJustSentRef,
  })

  // Use optimized keyboard handler
  const { handleKeyDown } = useOptimizedKeyboardHandler({
    messageRef,
    isLoading,
    onSendMessage: handleSendMessageSubmit
  })

  // Function to toggle chat list visibility - memoized for performance
  const toggleChatList = useCallback(() => {
    setIsChatListCollapsed(!isChatListCollapsed)
  }, [isChatListCollapsed, setIsChatListCollapsed])

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

  // Memoize conversation validation to avoid unnecessary calculations
  const hasSelectedConversation = useMemo(() => {
    return Boolean(conversationId && !conversationId.startsWith("new-"))
  }, [conversationId])

  // Override agent response state using the API request tracker.
  useEffect(() => {
    // Synchronize the loading animation with requests for this conversation.
    const hasActiveRequest = hasActiveChatRequest(conversationId)
    setIsAgentResponding(hasActiveRequest)
    
    if (hasActiveRequest) {
      console.log(`[ChatPage] Loading animation enabled for active chat request: ${conversationId}`)
    }
  }, [hasActiveChatRequest, conversationId, setIsAgentResponding])

  const showInvalidatedModal = hasSelectedConversation && isLeadInvalidated

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
      setIsDeletingConversation(false)
      
      // Redirect to chat page (without conversation ID)
      markUINavigation();
      router.push("/chat")
    } catch (error) {
      console.error("Error deleting conversation:", error)
      alert(translateRef.current("details.chat.deleteFailed"))
      setIsDeletingConversation(false)
    }
  }, [conversationId, router])

  const handleCancelDelete = useCallback(() => {
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
        <WorkspaceConversationList
          selectedConversationId={conversationId}
          onSelectConversation={handleSelectConversation}
          className="w-full h-full relative"
          isCollapsed={isChatListCollapsed}
          hasSelectedConversation={hasSelectedConversation}
        />
      </div>
      
      {/* Main chat content */}
      <div className={cn(
        "flex flex-col bg-background transition-all duration-300 ease-in-out min-w-0 min-h-0 fixed left-0 md:left-[var(--chat-panel-offset)] right-0 top-[var(--topbar-height,64px)] bottom-0",
        !hasSelectedConversation ? "hidden md:flex" : "flex"
      )}
      style={{ '--chat-panel-offset': `${sidebarWidth + (isChatListCollapsed ? 0 : 319)}px` } as React.CSSProperties}
      >
        <div className="w-full z-[50]">
          <ChatHeader
            agentId={agentId}
            agentName={displayAgentName}
            currentAgent={currentAgent}
            isAgentOnlyConversation={isAgentOnlyConversation || internalReview}
            internalReview={internalReview}
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
          />
        </div>

        {/* Chat messages area */}
        <div className="flex-1 overflow-y-auto bg-background min-w-0 w-full relative pt-[71px] flex flex-col" ref={messagesContainerRef}>
          <div className="transition-all duration-300 ease-in-out flex-1 flex flex-col min-h-full">
            <ChatMessages 
              chatMessages={chatMessages}
              isLoadingMessages={isLoadingMessages}
              isAgentResponding={isAgentResponding}
              isTransitioningConversation={isTransitioningConversation}
              messagesEndRef={messagesEndRef}
              containerRef={messagesContainerRef}
              agentId={agentId}
              agentName={displayAgentName}
              isAgentOnlyConversation={isAgentOnlyConversation || internalReview}
              isLead={Boolean(leadData?.id)}
              leadData={leadData}
              participantIdentity={participantIdentity}
              conversationId={conversationId}
              conversationCustomData={conversationCustomData}
              internalReview={internalReview}
              readOnly={!allowMessageActions}
              onRetryMessage={handleRetryMessage}
              conversationChannel={conversationChannel}
              channelBlockReasons={channelBlockReasons}
              onMessagesUpdate={setChatMessages}
              isChatListCollapsed={isChatListCollapsed}
            />
          </div>
        </div>
        
        {/* Message input area */}
        {hasSelectedConversation && !internalReview && (allowMessageActions ? (
          <div className="transition-all duration-300 ease-in-out">
            <ChatInput 
              setMessage={setMessage}
              handleMessageChange={handleMessageChange}
              textareaRef={textareaRef}
              isLoading={isLoading}
              handleSendMessage={handleSendMessageSubmit}
              onChannelCommitted={onChannelCommitted}
              channelBlockReasons={channelBlockReasons}
              handleKeyDown={handleKeyDown}
              conversationId={conversationId}
              isChatListCollapsed={isChatListCollapsed}
              leadData={leadData}
              isAgentOnlyConversation={isAgentOnlyConversation}
              isConversationReady={isConversationReady}
              commentReplySelection={commentReply.isCommentConversation ? commentReply : undefined}
            />
          </div>
        ) : <ConversationReplyNotice
          failed={conversationLoadFailed || (!currentSite && Boolean(siteError))}
          retrying={isValidatingConversation || (!currentSite && isLoadingSite)}
          onRetry={() => currentSite ? void refreshLeadData() : void refreshSites({ recoverMissingList: true })}
        />)}
      </div>
    </div>
    </>
  )
}

// The component reads the active locale even when rendered from static metadata.
ChatPageContent.breadcrumb = <LocalizedChatBreadcrumb />