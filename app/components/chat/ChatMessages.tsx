"use client"

import React from "react"
import { Badge } from "@/app/components/ui/badge"
import { EmptyState } from "@/app/components/ui/empty-state"
import { MessageSquare } from "@/app/components/ui/icons"
import { useTheme } from "@/app/context/ThemeContext"
import { useSite } from "@/app/context/SiteContext"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { useLayout } from "@/app/context/LayoutContext"
import { cn } from "@/lib/utils"
import { EmptyConversation } from "./EmptyConversation"
import { EditMessageModal } from "./EditMessageModal"
import { ChatMessagesLoading } from "./ChatMessagesLoading"
import { ChatMessageRow } from "./ChatMessageRow"
import { findPromptForChatResponse } from "./chat-response-context"
import { formatDate, isSameDay } from "./chat-message-status"
import { ChatMessagesProps, MessageRowActions } from "./chat-message-types"
import {
  useMessageSenderData,
  useProcessedMessages,
} from "./use-chat-message-data"
import { useChatMessageActions } from "./use-chat-message-actions"

export function ChatMessages({
  chatMessages,
  isLoadingMessages,
  isAgentResponding,
  isTransitioningConversation = false,
  messagesEndRef,
  agentId,
  agentName,
  isAgentOnlyConversation,
  isLead,
  leadData,
  conversationId,
  onRetryMessage,
  onMessagesUpdate,
  isChatListCollapsed = false,
}: ChatMessagesProps) {
  const hasLead = isLead || Boolean(leadData && (leadData.id || leadData.lead_id))
  const hasAssignee = Boolean(hasLead && leadData?.assignee)
  const { isDarkMode } = useTheme()
  const { isLayoutCollapsed } = useLayout()
  const { user } = useAuthContext()
  const { currentSite } = useSite()

  const currentUserId = user?.id
  const currentUserName =
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    (user?.email ? user.email.split("@")[0] : undefined)
  const currentUserAvatar =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    (user?.identities?.[0]?.identity_data as any)?.avatar_url

  const processedMessages = useProcessedMessages({
    chatMessages,
    currentUserId,
    currentUserName,
    isAgentOnlyConversation,
    hasLead,
  })
  const { userDataCache, agentDataCache } = useMessageSenderData(
    chatMessages,
    currentUserId,
  )
  const messageActions = useChatMessageActions({
    chatMessages,
    conversationId,
    leadData,
    onMessagesUpdate,
  })

  const rowActions: MessageRowActions = {
    onEdit: messageActions.handleEditMessage,
    onDelete: messageActions.handleDeleteMessage,
    onAccept: messageActions.handleAcceptMessage,
    onUndoAccept: messageActions.handleUndoAcceptMessage,
    onRetry: onRetryMessage,
    deletingMessageId: messageActions.deletingMessageId,
    acceptingMessageId: messageActions.acceptingMessageId,
    acceptedActionsMessageIds: messageActions.acceptedActionsMessageIds,
  }

  const hasSelectedConversation =
    conversationId && conversationId !== "" && !conversationId.startsWith("new-")

  if (!hasSelectedConversation) {
    const sidebarWidth = isLayoutCollapsed ? 64 : 256
    const chatListWidth = isChatListCollapsed ? 0 : 319
    const leftOffset = sidebarWidth + chatListWidth

    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center p-4 sm:p-8 transition-colors duration-300 ease-in-out z-[40]"
        style={{
          paddingLeft:
            typeof window !== "undefined" && window.innerWidth >= 768
              ? `${leftOffset}px`
              : "0",
        }}
      >
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center">
          <EmptyState
            icon={<MessageSquare className="h-12 w-12" />}
            title="No conversation selected"
            description="Select a conversation from the list or start a new one to begin chatting."
            className="min-h-0 w-full"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 py-6 transition-colors duration-300 ease-in-out pb-[180px] min-w-0 w-full transition-all flex flex-col min-h-full">
      <div
        className={cn(
          "min-w-0 px-4 md:px-8 lg:px-12 xl:px-24 w-full relative flex-1 flex flex-col",
          chatMessages.length === 0 &&
            !isLoadingMessages &&
            !isTransitioningConversation
            ? "justify-center"
            : "",
        )}
      >
        {isLoadingMessages || isTransitioningConversation ? (
          <ChatMessagesLoading />
        ) : (
          <div
            className={cn(
              "space-y-6 relative flex flex-col",
              chatMessages.length === 0 ? "flex-1 justify-center" : "",
            )}
          >
            {chatMessages.length === 0 ? (
              <EmptyConversation agentId={agentId} agentName={agentName} />
            ) : (
              processedMessages.map((message, index) => {
                const showDateSeparator =
                  index > 0 &&
                  !isSameDay(
                    new Date(processedMessages[index - 1].timestamp),
                    new Date(message.timestamp),
                  )
                const rowKey = message.id ? `${message.id}-${index}` : `idx-${index}`
                const responsePrompt = findPromptForChatResponse(
                  processedMessages,
                  index,
                )

                return (
                  <React.Fragment key={rowKey}>
                    {showDateSeparator && (
                      <div className="flex justify-center my-8">
                        <Badge
                          variant="outline"
                          className="px-3 py-1 text-xs bg-background/80 backdrop-blur"
                        >
                          {formatDate(new Date(message.timestamp))}
                        </Badge>
                      </div>
                    )}
                    <div
                      className={`flex ${
                        message.isRightAligned ? "justify-end" : "justify-start"
                      } animate-slide-in-fade`}
                    >
                      <ChatMessageRow
                        message={message}
                        index={index}
                        agentId={agentId}
                        agentName={agentName}
                        siteId={currentSite?.id}
                        conversationId={conversationId}
                        responsePrompt={responsePrompt}
                        hasLead={hasLead}
                        hasAssignee={hasAssignee}
                        leadData={leadData}
                        isDarkMode={isDarkMode}
                        identity={{
                          currentUserId,
                          currentUserName,
                          currentUserAvatar,
                          userDataCache,
                          agentDataCache,
                        }}
                        actions={rowActions}
                      />
                    </div>
                  </React.Fragment>
                )
              })
            )}

            {isAgentResponding && (
              <div className="flex justify-start animate-slide-in-fade mt-6 mb-8">
                <div className="inline-flex items-center gap-2 ml-9 w-auto">
                  <div
                    className="w-2.5 h-2.5 rounded-full font-inter font-bold bg-primary animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="w-2.5 h-2.5 rounded-full font-inter font-bold bg-primary animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="w-2.5 h-2.5 rounded-full font-inter font-bold bg-primary animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            )}

            <div className="h-[250px]" />
          </div>
        )}
        <div ref={messagesEndRef} className="h-[20px]" />
      </div>

      <EditMessageModal
        isOpen={messageActions.editModalOpen}
        onOpenChange={messageActions.setEditModalOpen}
        message={messageActions.editingMessage}
        onSave={messageActions.handleSaveEditedMessage}
      />
    </div>
  )
}
