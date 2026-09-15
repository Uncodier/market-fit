import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChatMessage } from "@/app/types/chat"
import { createClient } from "@/lib/supabase/client"
import { markUINavigation } from "@/lib/navigation/navigation-helpers"
import { getConversationMessages } from "../../services/getConversationMessages.client"

export function useChatMessageActions({
  chatMessages,
  conversationId,
  leadData,
  onMessagesUpdate,
}: {
  chatMessages: ChatMessage[]
  conversationId?: string
  leadData: any
  onMessagesUpdate?: (messages: ChatMessage[]) => void
}) {
  const router = useRouter()
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null)
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
  const [acceptingMessageId, setAcceptingMessageId] = useState<string | null>(null)
  const [acceptedActionsMessageIds, setAcceptedActionsMessageIds] = useState<Set<string>>(
    new Set(),
  )

  const handleEditMessage = (message: ChatMessage) => {
    setEditingMessage(message)
    setEditModalOpen(true)
  }

  const handleSaveEditedMessage = async (messageId: string, newText: string) => {
    if (!messageId || !newText.trim()) {
      toast.error("Message content cannot be empty")
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("messages")
        .update({ content: newText.trim(), updated_at: new Date().toISOString() })
        .eq("id", messageId)

      if (error) {
        console.error("Error updating message:", error)
        toast.error("Failed to update message")
        return
      }

      console.log("Successfully updated message:", messageId)
      const updatedMessages = chatMessages.map((message) =>
        message.id === messageId ? { ...message, text: newText.trim() } : message,
      )
      onMessagesUpdate?.(updatedMessages)

      if (conversationId && !conversationId.startsWith("new-")) {
        try {
          const refreshedMessages = await getConversationMessages(conversationId)
          if (refreshedMessages.length > 0) {
            onMessagesUpdate?.(refreshedMessages)
          }
        } catch (refreshError) {
          console.error("Error refreshing messages:", refreshError)
        }
      }

      toast.success("Message updated successfully")
      setEditModalOpen(false)
      setEditingMessage(null)
    } catch (error) {
      console.error("Unexpected error updating message:", error)
      toast.error("An unexpected error occurred")
    }
  }

  const handleDeleteMessage = async (message: ChatMessage) => {
    if (!message.id) {
      toast.error("Cannot delete message: missing ID")
      return
    }

    setDeletingMessageId(message.id)

    try {
      const supabase = createClient()
      const { data: allMessages, error: fetchError } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId || "")

      if (fetchError) {
        console.error("Error fetching messages:", fetchError)
        toast.error("Failed to check conversation messages")
        return
      }

      const isOnlyMessage = allMessages && allMessages.length === 1
      const { error: deleteError } = await supabase
        .from("messages")
        .delete()
        .eq("id", message.id)

      if (deleteError) {
        console.error("Error deleting message:", deleteError)
        toast.error("Failed to delete message")
        return
      }

      if (isOnlyMessage && conversationId && !conversationId.startsWith("new-")) {
        const { data: conversation } = await supabase
          .from("conversations")
          .select("lead_id, site_id")
          .eq("id", conversationId)
          .single()

        const leadId = conversation?.lead_id ?? leadData?.id ?? leadData?.lead_id
        const siteId = conversation?.site_id

        await supabase.from("messages").delete().eq("conversation_id", conversationId)
        const { error: conversationError } = await supabase
          .from("conversations")
          .delete()
          .eq("id", conversationId)

        if (conversationError) {
          console.error("Error deleting conversation:", conversationError)
        } else {
          window.dispatchEvent(
            new CustomEvent("conversation:deleted", { detail: { conversationId } }),
          )
        }

        if (leadId && siteId) {
          const { count: conversationCount } = await supabase
            .from("conversations")
            .select("id", { count: "exact", head: true })
            .eq("lead_id", leadId)
            .eq("site_id", siteId)
          const { count: taskCount } = await supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("lead_id", leadId)

          if ((conversationCount ?? 0) === 0 && (taskCount ?? 0) === 0) {
            const { updateLead } = await import("@/app/leads/actions")
            await updateLead({ id: leadId, site_id: siteId, status: "new" })
          }
        }

        markUINavigation()
        router.push("/chat")
        toast.success("Message and conversation deleted")
      } else {
        onMessagesUpdate?.(
          chatMessages.filter((currentMessage) => currentMessage.id !== message.id),
        )
        toast.success("Message deleted")
      }
    } catch (error) {
      console.error("Unexpected error deleting message:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setDeletingMessageId(null)
    }
  }

  const handleAcceptMessage = async (message: ChatMessage) => {
    if (!message.id) {
      toast.error("Cannot accept message: missing ID")
      return
    }

    setAcceptingMessageId(message.id)
    try {
      const response = await fetch("/api/conversations/accept-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: message.id }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to accept message")
      }

      const { updatedCustomData } = await response.json()
      setAcceptedActionsMessageIds((current) => new Set(current).add(message.id!))
      onMessagesUpdate?.(
        chatMessages.map((currentMessage) =>
          currentMessage.id === message.id
            ? {
                ...currentMessage,
                metadata: updatedCustomData as ChatMessage["metadata"],
              }
            : currentMessage,
        ),
      )

      if (conversationId) {
        window.dispatchEvent(
          new CustomEvent("conversation:message-accepted", {
            detail: { conversationId },
          }),
        )
      }
      toast.success("Message accepted")
    } catch (error) {
      console.error("Unexpected error accepting message:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setAcceptingMessageId(null)
    }
  }

  const handleUndoAcceptMessage = async (message: ChatMessage) => {
    if (!message.id) return

    try {
      const supabase = createClient()
      const { data: currentMessage, error: fetchError } = await supabase
        .from("messages")
        .select("custom_data")
        .eq("id", message.id)
        .single()

      if (fetchError) {
        console.error("Error fetching message:", fetchError)
        toast.error("Failed to update message status")
        return
      }

      const updatedCustomData = {
        ...((currentMessage?.custom_data as Record<string, any>) || {}),
        status: "pending",
      }
      const { error: updateError } = await supabase
        .from("messages")
        .update({ custom_data: updatedCustomData, updated_at: new Date().toISOString() })
        .eq("id", message.id)

      if (updateError) {
        console.error("Error updating message status:", updateError)
        toast.error("Failed to return message to pending")
        return
      }

      setAcceptedActionsMessageIds((current) => {
        const next = new Set(current)
        next.delete(message.id!)
        return next
      })
      onMessagesUpdate?.(
        chatMessages.map((current) =>
          current.id === message.id
            ? { ...current, metadata: updatedCustomData as ChatMessage["metadata"] }
            : current,
        ),
      )
      toast.success("Message returned to pending")
    } catch (error) {
      console.error("Unexpected error undoing accept:", error)
      toast.error("An unexpected error occurred")
    }
  }

  return {
    editModalOpen,
    setEditModalOpen,
    editingMessage,
    deletingMessageId,
    acceptingMessageId,
    acceptedActionsMessageIds,
    handleEditMessage,
    handleSaveEditedMessage,
    handleDeleteMessage,
    handleAcceptMessage,
    handleUndoAcceptMessage,
  }
}
