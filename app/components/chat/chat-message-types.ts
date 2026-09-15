import { ChatMessage } from "@/app/types/chat"
import { SenderProfile } from "./resolveTeamMemberSender"

export type ProcessedChatMessage = ChatMessage & {
  isCurrentUserMessage: boolean
  isRightAligned: boolean
}

export interface ChatMessagesProps {
  chatMessages: ChatMessage[]
  isLoadingMessages: boolean
  isAgentResponding: boolean
  isTransitioningConversation?: boolean
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  containerRef?: React.RefObject<HTMLDivElement | null>
  agentId: string
  agentName: string
  isAgentOnlyConversation: boolean
  isLead: boolean
  leadData: any
  conversationId?: string
  onRetryMessage?: (failedMessage: ChatMessage) => Promise<void>
  onMessagesUpdate?: (messages: ChatMessage[]) => void
  isChatListCollapsed?: boolean
}

export interface MessageRowActions {
  onEdit: (message: ChatMessage) => void
  onDelete: (message: ChatMessage) => Promise<void>
  onAccept: (message: ChatMessage) => Promise<void>
  onUndoAccept: (message: ChatMessage) => Promise<void>
  onRetry?: (message: ChatMessage) => Promise<void>
  deletingMessageId: string | null
  acceptingMessageId: string | null
  acceptedActionsMessageIds: Set<string>
}

export interface MessageIdentityContext {
  currentUserId?: string
  currentUserName?: string
  currentUserAvatar?: string
  userDataCache: Record<string, SenderProfile>
  agentDataCache: Record<string, { name: string; avatar_url?: string | null }>
}
