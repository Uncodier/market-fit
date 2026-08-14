import { useEffect } from "react"
import {
  getTopConversation,
  hasValidConversationSelection,
} from "@/app/chat/get-top-conversation"
import { ConversationListItem } from "@/app/types/chat"

const DESKTOP_MIN_WIDTH = 768

interface UseAutoSelectTopConversationOptions {
  conversations: ConversationListItem[]
  isLoading: boolean
  isInitialLoad: boolean
  selectedConversationId?: string
  onSelectConversation: (
    conversationId: string,
    agentName: string,
    agentId: string,
    conversationTitle?: string
  ) => void
}

/**
 * On desktop, select the top conversation when the list has items and none is selected.
 * Mobile keeps the list-first flow so users can pick a thread before opening it.
 */
export function useAutoSelectTopConversation({
  conversations,
  isLoading,
  isInitialLoad,
  selectedConversationId,
  onSelectConversation,
}: UseAutoSelectTopConversationOptions) {
  useEffect(() => {
    if (isLoading || isInitialLoad) return
    if (hasValidConversationSelection(selectedConversationId)) return
    if (typeof window !== "undefined" && window.innerWidth < DESKTOP_MIN_WIDTH) return

    const topConversation = getTopConversation(conversations)
    if (!topConversation) return

    onSelectConversation(
      topConversation.id,
      topConversation.agentName,
      topConversation.agentId,
      topConversation.title
    )
  }, [
    conversations,
    isLoading,
    isInitialLoad,
    selectedConversationId,
    onSelectConversation,
  ])
}
