import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { ConversationListItem } from '@/app/types/chat'
import type { UpdateConversations } from './useConversationRealtime'

export function useConversationListActions({
  siteId, selectedConversationId, onDeleteConversation, updateConversations, refreshConversations,
}: {
  siteId: string
  selectedConversationId?: string
  onDeleteConversation?: (id: string) => Promise<void>
  updateConversations: UpdateConversations
  refreshConversations: () => Promise<void>
}) {
  const router = useRouter()
  const selectedConversationIdRef = useRef(selectedConversationId)
  selectedConversationIdRef.current = selectedConversationId
  const loadConversationsRef = useRef(refreshConversations)
  loadConversationsRef.current = refreshConversations
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [currentConversation, setCurrentConversation] = useState<ConversationListItem | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<ConversationListItem | null>(null)
  const [isAcceptingAll, setIsAcceptingAll] = useState(false)
  const [isRejectingAll, setIsRejectingAll] = useState(false)

  const deleteConversation = async (conversationId: string) => {
    try {
      // Keep the list visible during explicit actions.
      
      // Call the Supabase client to delete the conversation
      const supabase = createClient();
      
      // First delete related messages
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);
        
      if (messagesError) {
        console.error("Error deleting messages:", messagesError);
        return;
      }
      
      // Then delete the conversation
      const { error: conversationError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);
        
      if (conversationError) {
        console.error("Error deleting conversation:", conversationError);
        return;
      }
      
      // If the parent component provided a delete handler, call it
      if (onDeleteConversation) {
        await onDeleteConversation(conversationId);
      }
      
      // Remove from local state without reloading.
      updateConversations(prevConversations => 
        prevConversations.filter(conv => conv.id !== conversationId)
      );
      console.log(`🔍 DEBUG: Conversation ${conversationId} removed from state directly`);
      
      // If the deleted conversation was selected, redirect to the chat list
      if (selectedConversationIdRef.current === conversationId) {
        router.push('/chat');
      }
    } catch (error) {
      console.error("Error in deleteConversation:", error);
    } finally {
      // Leave the list loading state unchanged.
    }
  };

  // Archive an existing conversation.
  const archiveConversation = async (conversationId: string) => {
    try {
      // Keep the list visible during explicit actions.
      
      const supabase = createClient();
      
      // Persist the archived flag.
      const { error } = await supabase
        .from('conversations')
        .update({ is_archived: true })
        .eq('id', conversationId);
        
      if (error) {
        console.error("Error archiving conversation:", error);
        return;
      }
      
      // Update local state without reloading.
      updateConversations(prevConversations => 
        prevConversations.filter(conv => conv.id !== conversationId)
      );
      console.log(`🔍 DEBUG: Archived conversation ${conversationId} removed from state directly`);
      
      // If the archived conversation was selected, redirect to the chat list
      if (selectedConversationIdRef.current === conversationId) {
        router.push('/chat');
      }
    } catch (error) {
      console.error("Error in archiveConversation:", error);
    } finally {
      // Leave the list loading state unchanged.
    }
  };

  // Open the rename modal.
  const openRenameModal = (conversation: ConversationListItem) => {
    setCurrentConversation(conversation);
    setRenameModalOpen(true);
  };
  
  // Apply a manually edited title to local state.
  const handleDirectTitleUpdate = (conversationId: string, newTitle: string) => {
    // Keep the list visible.
    
    updateConversations(prevConversations => 
      prevConversations.map(conv => 
        conv.id === conversationId 
          ? { ...conv, title: newTitle } 
          : conv
      )
    );
    console.log(`🔍 DEBUG: Conversation ${conversationId} title updated directly in state to "${newTitle}"`);
  };
  
  // Open the delete confirmation modal.
  const openDeleteModal = (conversation: ConversationListItem) => {
    setConversationToDelete(conversation);
    setDeleteModalOpen(true);
  };

  // Accept all pending messages via a server-side API route.
  // This avoids building a huge .in(...) URL with hundreds of UUIDs on the client.
  const handleAcceptAllPending = async () => {
    if (!siteId) return

    setIsAcceptingAll(true)

    try {
      const response = await fetch("/api/conversations/accept-all-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        console.error("Error accepting all pending:", result.error)
        toast.error(result.error || "Failed to accept all pending messages")
        return
      }

      if (result.updatedCount === 0) {
        toast.info("No pending messages found")
        return
      }

      const conversationIds: string[] = result.conversationIds ?? []

      // Update local state — mark affected conversations as having accepted messages
      updateConversations(prevConversations =>
        prevConversations.map(conv =>
          conversationIds.includes(conv.id)
            ? { ...conv, hasAcceptedMessage: true }
            : conv
        )
      )

      // Notify other parts of the UI
      conversationIds.forEach(convId => {
        window.dispatchEvent(new CustomEvent("conversation:message-accepted", {
          detail: { conversationId: convId },
        }))
      })

      toast.success(`Accepted ${result.updatedCount} pending messages in ${conversationIds.length} conversations`)
    } catch (error) {
      console.error("Error accepting all pending:", error)
      toast.error("Failed to accept all pending messages")
    } finally {
      setIsAcceptingAll(false)
    }
  }

  // Reject all unsent messages (status pending or accepted) via server-side API route.
  // Avoids huge .in(...) URLs and N+1 queries for empty-conversation checks.
  const handleRejectAllPending = async () => {
    if (!siteId) return

    setIsRejectingAll(true)

    try {
      const response = await fetch("/api/conversations/reject-all-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        console.error("Error rejecting all pending:", result.error)
        toast.error(result.error || "Failed to reject pending messages")
        return
      }

      if (result.deletedMessages === 0) {
        toast.info("No pending messages to reject")
        return
      }

      const conversationsToDelete: string[] = result.conversationsToDelete ?? []

      // Remove deleted conversations from local state
      updateConversations((prev) =>
        prev.filter((conv) => !conversationsToDelete.includes(conv.id))
      )

      // If the currently selected conversation was deleted, go back to list
      if (selectedConversationId && conversationsToDelete.includes(selectedConversationId)) {
        router.push("/chat")
      }

      // Notify other parts of the UI
      conversationsToDelete.forEach(convId => {
        window.dispatchEvent(new CustomEvent("conversation:deleted", {
          detail: { conversationId: convId },
        }))
      })

      // Also dispatch a general event so that the current chat can reload its messages if needed
      window.dispatchEvent(new CustomEvent("conversation:messages-rejected"))

      // Reload list to reflect conversations that had messages removed but weren't deleted
      if (loadConversationsRef.current) {
        loadConversationsRef.current()
      }

      toast.success(
        `Rejected ${result.deletedMessages} pending messages. Deleted ${result.deletedConversations} empty conversations.`
      )
    } catch (error) {
      console.error("Error rejecting all pending:", error)
      toast.error("Failed to reject pending messages")
    } finally {
      setIsRejectingAll(false)
    }
  }

  return {
    renameModalOpen, setRenameModalOpen, currentConversation,
    deleteModalOpen, setDeleteModalOpen, conversationToDelete,
    isAcceptingAll, isRejectingAll, deleteConversation, archiveConversation,
    openRenameModal, handleDirectTitleUpdate, openDeleteModal,
    handleAcceptAllPending, handleRejectAllPending,
  }
}
