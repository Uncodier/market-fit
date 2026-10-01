"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { MessageSquare, Check, X } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { SearchInput } from "@/app/components/ui/search-input"
import { useTheme } from "@/app/context/ThemeContext"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { ConversationListItem } from "@/app/types/chat"
import { Skeleton } from "@/app/components/ui/skeleton"
import { createClient } from "@/lib/supabase/client"
import { RenameConversationModal } from "./RenameConversationModal"
import { DeleteConfirmationModal } from "./DeleteConfirmationModal"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { ConversationItem } from "./ConversationItem"
import { ChannelFilter } from "./ChannelFilter"
import { useConversationsList } from "@/app/hooks/useConversationsList"
import { useConversationRealtime } from "@/app/hooks/useConversationRealtime"
import { useConversationListActions } from "@/app/hooks/useConversationListActions"
import { useAutoSelectTopConversation } from "@/app/hooks/useAutoSelectTopConversation"

// Componente para renderizar esqueletos de carga
function ConversationSkeleton() {
  return (
    <div className="w-full text-left py-3 px-4 rounded-none border-b dark:border-white/5 border-black/5" style={{ boxSizing: 'border-box' }}>
      <div className="flex items-center justify-between mb-1 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Skeleton className="h-4 w-[60%]" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
      </div>
      <div className="mt-1">
        <Skeleton className="h-3 w-[85%]" />
      </div>
      <div className="flex justify-between items-center mt-2">
        <div className="flex items-center gap-1">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-1" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  )
}

interface ChatListProps {
  siteId: string
  selectedConversationId?: string
  onSelectConversation: (conversationId: string, agentName: string, agentId: string, conversationTitle?: string) => void
  className?: string
  onLoadConversations?: (loadFunction: () => Promise<void>) => void
  onDeleteConversation?: (conversationId: string) => Promise<void>
  isCollapsed?: boolean
  hasSelectedConversation?: boolean
}

export function ChatList({
  siteId,
  selectedConversationId,
  onSelectConversation,
  className,
  onLoadConversations,
  onDeleteConversation,
}: ChatListProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [combinedFilter, setCombinedFilter] = useState<'all' | 'outbound' | 'inbound' | 'replied' | 'tasks' | 'assigned' | 'qualified'>('all')
  const { isDarkMode } = useTheme()
  const { user } = useAuthContext()
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)
  
  // Load user avatar
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
        
        // If no avatar anywhere, use null (will show initials)
        setUserAvatarUrl(null)
      } catch (error) {
        console.error("Error fetching user avatar:", error)
        setUserAvatarUrl(null)
      }
    }
    
    fetchUserAvatar()
  }, [user])

  // Debounce search query to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300) // 300ms delay

    return () => clearTimeout(timer)
  }, [searchQuery])
  
  const {
    conversations,
    isLoading,
    isLoadingMore,
    hasMore,
    hasEmptyResult,
    isInitialLoad,
    updateConversations,
    refreshConversations,
    loadMore,
  } = useConversationsList({
    siteId,
    userId: user?.id,
    combinedFilter,
    debouncedSearchQuery,
  })

  useAutoSelectTopConversation({
    conversations,
    isLoading,
    isInitialLoad,
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

  const handleLoadMore = async () => {
    await loadMore()
  }

  useConversationRealtime({ siteId, selectedConversationId, updateConversations, refreshConversations, onLoadConversations })

  // Listen for custom conversation deleted event
  useEffect(() => {
    const handleConversationDeleted = (event: CustomEvent) => {
      const { conversationId: deletedId } = event.detail
      console.log('🔍 Custom conversation:deleted event received:', deletedId)
      
      // Remove the conversation from the list immediately
      updateConversations(prevConversations => 
        prevConversations.filter(conv => conv.id !== deletedId)
      )
      
      // If the deleted conversation was selected, redirect to chat list
      if (selectedConversationId === deletedId) {
        router.push('/chat')
      }
    }

    window.addEventListener('conversation:deleted', handleConversationDeleted as EventListener)
    
    return () => {
      window.removeEventListener('conversation:deleted', handleConversationDeleted as EventListener)
    }
  }, [selectedConversationId, router, updateConversations])

  // Listen for message accepted event to update conversation icon
  useEffect(() => {
    const handleMessageAccepted = (event: CustomEvent) => {
      const { conversationId: acceptedConvId } = event.detail
      console.log('🔍 Custom conversation:message-accepted event received:', acceptedConvId)
      
      // Update the conversation to mark it has an accepted message
      updateConversations(prevConversations => 
        prevConversations.map(conv => 
          conv.id === acceptedConvId 
            ? { ...conv, hasAcceptedMessage: true }
            : conv
        )
      )
    }

    window.addEventListener('conversation:message-accepted', handleMessageAccepted as EventListener)
    
    return () => {
      window.removeEventListener('conversation:message-accepted', handleMessageAccepted as EventListener)
    }
  }, [updateConversations])

  // Listen for lead status update event to refresh conversation list
  useEffect(() => {
    const handleLeadStatusUpdate = (event: CustomEvent) => {
      const { leadId, newStatus, conversationId: updatedConvId } = event.detail
      console.log('🔍 Custom lead:status-updated event received:', { leadId, newStatus, conversationId: updatedConvId })
      
      // Update the conversation's leadStatus in the list
      updateConversations(prevConversations => 
        prevConversations.map(conv => 
          conv.id === updatedConvId && conv.leadName
            ? { ...conv, leadStatus: newStatus }
            : conv
        )
      )
    }

    window.addEventListener('lead:status-updated', handleLeadStatusUpdate as EventListener)
    
    return () => {
      window.removeEventListener('lead:status-updated', handleLeadStatusUpdate as EventListener)
    }
  }, [updateConversations])


  // No need for client-side filtering since search is done at database level
  const filteredConversations = conversations

  // Separar conversaciones pendientes del resto
  const pendingConversations = filteredConversations.filter(conv => conv.status === 'pending')
  const otherConversations = filteredConversations.filter(conv => conv.status !== 'pending')

  // Determinar si mostrar el estado vacío después de la búsqueda
  const showEmptyState = !isLoading && (
    (isInitialLoad === false && hasEmptyResult) || 
    (!isInitialLoad && filteredConversations.length === 0)
  );

  const handleSelectConversation = (conversation: ConversationListItem) => {
    // No hacer nada si ya está seleccionada la conversación
    if (selectedConversationId === conversation.id) {
      return;
    }
    
    // Solo notificar al componente padre, sin recargar la lista
    onSelectConversation(conversation.id, conversation.agentName, conversation.agentId, conversation.title);
  }
  

  return (
    <div className={cn("flex flex-col h-full w-full bg-transparent", className)} style={{ overflow: 'hidden' }}>
      {/* Top bar with search input - adaptable to dark mode */}
      <div className={cn(
        "flex items-center justify-center h-[71px] max-h-[71px] min-h-[71px] border-b transition-colors duration-300 flex-shrink-0 overflow-hidden",
        "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        "w-full z-[40]"
      )} style={{ WebkitBackdropFilter: 'blur(10px)' }}>
        <div className="relative w-full px-4 flex items-center justify-center min-w-0 transition-all duration-300">
          <SearchInput
            placeholder="Search conversations..."
            value={searchQuery}
            onSearch={setSearchQuery}
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
            {/* Combined Filter - always visible */}
            <ChannelFilter
              selectedFilter={combinedFilter}
              onFilterChange={setCombinedFilter}
              userAvatarUrl={userAvatarUrl}
              userName={user?.user_metadata?.name || user?.email}
            />
            
            {isLoading ? (
              <div className="pb-[200px]">
                {Array(5).fill(0).map((_, index) => (
                  <ConversationSkeleton key={index} />
                ))}
              </div>
            ) : showEmptyState ? (
              <div className="flex-1 flex flex-col items-center justify-center w-full h-full p-6 md:p-8">
                <div className="w-full max-w-[280px] mx-auto flex items-center justify-center">
                  <EmptyCard
                    icon={<MessageSquare className="h-10 w-10 text-muted-foreground" />}
                    title="No conversations"
                    description="Start a new conversation with an agent to see it here."
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
                    "px-4 py-2 text-xs font-medium uppercase tracking-wide sticky top-[56px] z-10",
                    "bg-background/80 text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/80"
                  )} style={{ WebkitBackdropFilter: 'blur(10px)' }}>
                    Pending ({pendingConversations.length})
                  </div>
                  {/* Bulk Actions Toolbar */}
                  <div className="flex items-center gap-2 px-4 py-2 border-b dark:border-white/5 border-black/5 bg-muted/30 h-12 max-h-12 min-h-12 flex-shrink-0 overflow-hidden">
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
                  </div>
                  {pendingConversations.map(conversation => (
                    <ConversationItem
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
                      "px-4 py-2 text-xs font-medium uppercase tracking-wide sticky top-[56px] z-10",
                      "bg-background/80 text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/80"
                    )} style={{ WebkitBackdropFilter: 'blur(10px)' }}>
                      Active Conversations
                    </div>
                  )}
                  {otherConversations.map(conversation => (
                    <ConversationItem
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
              
              {/* Load More Button - similar to commands-table.tsx */}
              {hasMore && (
                <div className="flex justify-center py-4 px-4">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="w-full max-w-[280px]"
                  >
                    {isLoadingMore ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                        <span>Loading</span>
                      </div>
                    ) : "Load More"}
                  </Button>
                </div>
              )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Modal para renombrar conversación */}
      {currentConversation && (
        <RenameConversationModal
          open={renameModalOpen}
          onOpenChange={setRenameModalOpen}
          conversationId={currentConversation.id}
          currentTitle={currentConversation.title}
          onRename={refreshConversations}
          onDirectUpdate={handleDirectTitleUpdate}
        />
      )}
      
      {/* Modal de confirmación para eliminar conversación */}
      {conversationToDelete && (
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