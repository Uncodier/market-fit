import {
  MessageIdentityContext,
  MessageRowActions,
  ProcessedChatMessage,
} from "./chat-message-types"
import { ChatParticipantMessageRow } from "./ChatParticipantMessageRow"
import { ChatAgentMessageRow } from "./ChatAgentMessageRow"
import { ChatFallbackMessageRow } from "./ChatFallbackMessageRow"

export function ChatMessageRow({
  message,
  index,
  agentId,
  agentName,
  siteId,
  conversationId,
  responsePrompt,
  hasLead,
  hasAssignee,
  leadData,
  isDarkMode,
  identity,
  actions,
}: {
  message: ProcessedChatMessage
  index: number
  agentId: string
  agentName: string
  siteId?: string
  conversationId?: string
  responsePrompt?: string
  hasLead: boolean
  hasAssignee: boolean
  leadData: any
  isDarkMode: boolean
  identity: MessageIdentityContext
  actions: MessageRowActions
}) {
  if (message.role === "team_member" && hasLead) {
    return (
      <ChatParticipantMessageRow
        message={message}
        variant="team-left"
        leadData={leadData}
        isDarkMode={isDarkMode}
        identity={identity}
        actions={actions}
      />
    )
  }

  if (
    message.role === "team_member" &&
    !hasLead &&
    !message.isCurrentUserMessage
  ) {
    return (
      <ChatParticipantMessageRow
        message={message}
        variant="team-other"
        leadData={leadData}
        isDarkMode={isDarkMode}
        identity={identity}
        actions={actions}
      />
    )
  }

  if (message.role === "user") {
    return (
      <ChatParticipantMessageRow
        message={message}
        variant="lead"
        leadData={leadData}
        isDarkMode={isDarkMode}
        identity={identity}
        actions={actions}
      />
    )
  }

  if (message.role === "agent" || message.role === "assistant") {
    return (
      <ChatAgentMessageRow
        message={message}
        index={index}
        agentId={agentId}
        agentName={agentName}
        siteId={siteId}
        conversationId={conversationId}
        responsePrompt={responsePrompt}
        hasAssignee={hasAssignee}
        leadData={leadData}
        isDarkMode={isDarkMode}
        identity={identity}
        actions={actions}
      />
    )
  }

  if (
    message.role === "team_member" &&
    !hasLead &&
    message.isCurrentUserMessage
  ) {
    return (
      <ChatParticipantMessageRow
        message={message}
        variant="team-current"
        leadData={leadData}
        isDarkMode={isDarkMode}
        identity={identity}
        actions={actions}
      />
    )
  }

  if (message.role === "visitor") {
    return (
      <ChatParticipantMessageRow
        message={message}
        variant="visitor"
        leadData={leadData}
        isDarkMode={isDarkMode}
        identity={identity}
        actions={actions}
      />
    )
  }

  return (
    <ChatFallbackMessageRow
      message={message}
      index={index}
      agentId={agentId}
      siteId={siteId}
      conversationId={conversationId}
      responsePrompt={responsePrompt}
      isDarkMode={isDarkMode}
      actions={actions}
    />
  )
}
