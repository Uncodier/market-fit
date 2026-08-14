import { ConversationListItem } from "@/app/types/chat"

/**
 * Returns the conversation shown at the top of the chat list:
 * pending conversations first, then the remaining ones, preserving list order.
 */
export function getTopConversation(
  conversations: ConversationListItem[]
): ConversationListItem | undefined {
  if (conversations.length === 0) return undefined

  return (
    conversations.find((conversation) => conversation.status === "pending") ??
    conversations.find((conversation) => conversation.status !== "pending") ??
    conversations[0]
  )
}

export function hasValidConversationSelection(selectedConversationId?: string): boolean {
  return Boolean(selectedConversationId && !selectedConversationId.startsWith("new-"))
}
