"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { MessageSquare, Check, X } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { SearchInput } from "@/app/components/ui/search-input"
import { conversationSearchContentClassName, conversationSearchHeaderClassName } from "./conversation-list-layout"
import { useTheme } from "@/app/context/ThemeContext"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { ConversationListItem } from "@/app/types/chat"
import { ConversationListSkeleton } from "./conversation-list-skeleton"
import { RenameConversationModal } from "./RenameConversationModal"
import { DeleteConfirmationModal } from "./DeleteConfirmationModal"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { ConversationItem } from "./ConversationItem"
import { ChannelFilter } from "./ChannelFilter"
import { usePrivateReviews } from "./private-reviews"
import { useConversationsList } from "@/app/hooks/useConversationsList"
import { useConversationRealtime } from "@/app/hooks/useConversationRealtime"
import { useConversationListActions } from "@/app/hooks/useConversationListActions"
import { useAutoSelectTopConversation } from "@/app/hooks/useAutoSelectTopConversation"
import { useLocalization } from "@/app/context/LocalizationContext"
import { isDemoSiteId } from "@/lib/demo-utils"
import type { ConversationFilter } from "@/app/services/getConversations.client"
import { useConversationListEvents } from "@/app/hooks/useConversationListEvents"

interface ChatListProps {
  siteId: string
  selectedConversationId?: string
  onSelectConversation: (conversationId: string, agentName: string, agentId: string, conversationTitle?: string) => void
  className?: string
  onLoadConversations?: (loadFunction: () => Promise<void>) => void
  onDeleteConversation?: (conversationId: string) => Promise<void>
  isCollapsed?: boolean
  hasSelectedConversation?: boolean
  /** Only the independently authorized page-one read is available until workspace setup finishes. */
  previewOnly?: boolean
}

export function ChatList({
  siteId,
  selectedConversationId,
  onSelectConversation,
  className,
  onLoadConversations,
  onDeleteConversation,
  previewOnly = false,
}: ChatListProps) {
  const { t } = useLocalization()
  const [searchQuery, setSearchQuery] = useState("")
  const { byConversation } = usePrivateReviews()
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const searchPending = searchQuery.trim() !== debouncedSearchQuery
  const [combinedFilter, setCombinedFilter] = useState<ConversationFilter>('all')
  const { isDarkMode } = useTheme()
  const auth = useAuthContext()
  const user = auth.isLoading ? null : auth.user
  const userAvatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || user?.identities?.[0]?.identity_data?.avatar_url

  // Debounce search query to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim())
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])
  
  const {
    conversations,
    isLoading,
    isLoadingMore,
    hasMore,
    hasEmptyResult,
    isInitialLoad,
    hasConfirmedFirstPage,
    isValidating, readError, pageError, terminalError,
    updateConversations,
    refreshConversations,
    loadMore,
  } = useConversationsList({
    // Hide the preceding search immediately, without issuing a keystroke request.
    siteId: searchPending ? '' : siteId,
    userId: user?.id,
    combinedFilter,
    debouncedSearchQuery,
    previewOnly,
  })
  const readOnly = previewOnly || !siteId || (!user?.id && !isDemoSiteId(siteId)) || !!readError || isInitialLoad

  // An approval can arrive before the conversation INSERT reaches realtime.
  // Revalidate the real list, never manufacture a row from private inbox data.
  const seenRequests = React.useRef(new Set<string>())
  useEffect(() => {
    if (readOnly || combinedFilter !== 'all' || debouncedSearchQuery) return
    const listed = new Set(conversations.map(row => row.id))
    const needsRefresh = [...byConversation].some(([id, requests]) =>
      !listed.has(id) && requests.some(request => !seenRequests.current.has(request.id)))
    seenRequests.current = new Set([...byConversation.values()].flatMap(requests => requests.map(request => request.id)))
    if (needsRefresh) void refreshConversations()
  }, [byConversation, conversations, refreshConversations, readOnly, combinedFilter, debouncedSearchQuery])

  useAutoSelectTopConversation({
    enabled: !readOnly && hasConfirmedFirstPage,
    conversations,
    selectedConversationId,
    onSelectConversation,
  })

  const {
    renameModalOpen, setRenameModalOpen, currentConversation,
    deleteModalOpen, setDeleteModalOpen, conversationToDelete,
    isAcceptingAll, isRejectingAll, deleteConversation, archiveConversation,
    openRenameModal, handleDirectTitleUpdate, openDeleteModal,
    handleAcceptAllPending, handleRejectAllPending,
  } = useConversationListActions({ siteId, selectedConversationId, onDeleteConversation, updateConversations, refreshConversations })

  useConversationRealtime({ siteId: readOnly ? '' : siteId, selectedConversationId, updateConversations, refreshConversations,
    filtered: combinedFilter !== 'all' || !!debouncedSearchQuery, onLoadConversations: readOnly ? undefined : onLoadConversations })
  useConversationListEvents(!readOnly, selectedConversationId, updateConversations)

  const pendingConversations = conversations.filter(conv => conv.status === 'pending')
  const otherConversations = conversations.filter(conv => conv.status !== 'pending')

  const handleSelectConversation = (conversation: ConversationListItem) => {
    if (!readOnly && selectedConversationId !== conversation.id) {
      onSelectConversation(conversation.id, conversation.agentName, conversation.agentId, conversation.title)
    }
  }
  

  return (
    <div className={cn("flex flex-col h-full w-full bg-transparent", className)} style={{ overflow: 'hidden' }}>
      {/* Top bar with search input - adaptable to dark mode */}
      <div className={cn(
        conversationSearchHeaderClassName,
        "transition-colors duration-300",
        "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        "z-[40]"
      )} style={{ WebkitBackdropFilter: 'blur(10px)' }}>
        <div className={cn(conversationSearchContentClassName, "transition-all duration-300")}>
          <SearchInput
            placeholder={t('chat.list.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full h-10 text-sm rounded-lg",
              isDarkMode ? "bg-background border-input" : "bg-white"
            )}
            containerClassName="w-full"
            alwaysExpanded={true}
            shortcut="K"
          />
        </div>
      </div>
      
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-auto flex flex-col pt-0">
          <div className="w-full min-w-0 flex flex-col flex-1">
            <ChannelFilter
              selectedFilter={combinedFilter}
              onFilterChange={setCombinedFilter}
              userAvatarUrl={userAvatarUrl}
              userName={user?.user_metadata?.name || user?.email}
            />
            
            {readError && (
              <div role="alert" className="grid gap-2 px-4 py-4 text-sm text-muted-foreground">
                <p>{terminalError
                  ? t('chat.list.unavailable')
                  : conversations.length ? t('chat.list.stale') : t('chat.list.loadFailed')}</p>
                {!terminalError && <Button size="sm" variant="outline" disabled={isValidating} onClick={refreshConversations}>
                  {isValidating ? t('chat.list.retrying') : t('common.retry')}
                </Button>}
              </div>
            )}
            {isLoading ? (
              <ConversationListSkeleton label={t('chat.list.loading')} />
            ) : hasEmptyResult ? (
              <div className="flex-1 flex flex-col items-center justify-center w-full h-full p-6 md:p-8">
                <div className="w-full max-w-[280px] mx-auto flex items-center justify-center">
                  <EmptyCard
                    icon={<MessageSquare className="h-10 w-10 text-muted-foreground" />}
                    title="No conversations"
                    description={debouncedSearchQuery || combinedFilter !== 'all'
                      ? t('chat.list.tryFilter') : 'Start a new conversation with an agent to see it here.'}
                    variant="fancy"
                    showShadow={false}
                    contentClassName="py-8"
                  />
                </div>
              </div>
            ) : (
              <div className="pb-[200px]">
              
              {/* Pending Conversations Section */}
              {pendingConversations.length > 0 && (
                <div className="mb-2">
                  <div className={cn(
                    "px-4 py-2 text-xs font-medium uppercase tracking-wide sticky top-0 z-10 md:top-[56px]",
                    "bg-background/80 text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/80"
                  )} style={{ WebkitBackdropFilter: 'blur(10px)' }}>
                    Pending ({pendingConversations.length})
                  </div>
                  {/* Bulk Actions Toolbar */}
                  {!readOnly && <div className="flex items-center gap-2 px-4 py-2 border-b dark:border-white/5 border-black/5 bg-muted/30 h-12 max-h-12 min-h-12 flex-shrink-0 overflow-hidden">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAcceptAllPending}
                      disabled={isAcceptingAll || isRejectingAll}
                      className="flex-1 h-8 text-xs gap-1.5"
                    >
                      {isAcceptingAll ? (
                        <div className="h-3 w-3 animate-spin rounded-full font-inter border-2 border-current border-t-transparent" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Accept All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRejectAllPending}
                      disabled={isAcceptingAll || isRejectingAll}
                      className="flex-1 h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {isRejectingAll ? (
                        <div className="h-3 w-3 animate-spin rounded-full font-inter border-2 border-current border-t-transparent" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      Reject All
                    </Button>
                  </div>}
                  {pendingConversations.map(conversation => (
                    <ConversationItem
                      readOnly={readOnly}
                      reviewCount={readOnly ? undefined : byConversation.get(conversation.id)?.length}
                      key={conversation.id}
                      conversation={conversation}
                      isSelected={selectedConversationId === conversation.id}
                      onSelect={() => handleSelectConversation(conversation)}
                      onRename={() => openRenameModal(conversation)}
                      onArchive={() => archiveConversation(conversation.id)}
                      onDelete={() => openDeleteModal(conversation)}
                    />
                  ))}
                </div>
              )}
              
              {/* Other Conversations Section */}
              {otherConversations.length > 0 && (
                <div>
                  {pendingConversations.length > 0 && (
                    <div className={cn(
                      "px-4 py-2 text-xs font-medium uppercase tracking-wide sticky top-0 z-10 md:top-[56px]",
                      "bg-background/80 text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/80"
                    )} style={{ WebkitBackdropFilter: 'blur(10px)' }}>
                      Active Conversations
                    </div>
                  )}
                  {otherConversations.map(conversation => (
                    <ConversationItem
                      readOnly={readOnly}
                      reviewCount={readOnly ? undefined : byConversation.get(conversation.id)?.length}
                      key={conversation.id}
                      conversation={conversation}
                      isSelected={selectedConversationId === conversation.id}
                      onSelect={() => handleSelectConversation(conversation)}
                      onRename={() => openRenameModal(conversation)}
                      onArchive={() => archiveConversation(conversation.id)}
                      onDelete={() => openDeleteModal(conversation)}
                    />
                  ))}
                </div>
              )}
              
              {hasMore && (
                <div className="grid justify-items-center gap-2 py-4 px-4">
                  {pageError && <p role="alert" className="text-sm text-muted-foreground">{t('chat.list.pageFailed')}</p>}
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="w-full max-w-[280px]"
                  >
                    {isLoadingMore ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                        <span>Loading</span>
                      </div>
                    ) : pageError ? t('chat.list.retryPage') : 'Load More'}
                  </Button>
                </div>
              )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {!readOnly && currentConversation && conversations.some(row => row.id === currentConversation.id) && (
        <RenameConversationModal
          open={renameModalOpen}
          onOpenChange={setRenameModalOpen}
          conversationId={currentConversation.id}
          currentTitle={currentConversation.title}
          onRename={refreshConversations}
          onDirectUpdate={handleDirectTitleUpdate}
        />
      )}
      
      {!readOnly && conversationToDelete && conversations.some(row => row.id === conversationToDelete.id) && (
        <DeleteConfirmationModal
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          conversationId={conversationToDelete.id}
          conversationTitle={conversationToDelete.title}
          onDelete={deleteConversation}
        />
      )}
    </div>
  )
} 