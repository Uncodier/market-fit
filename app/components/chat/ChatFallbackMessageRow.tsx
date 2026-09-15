import { ChatResponseActions } from "./ChatResponseActions"
import { ChatMessageActionsBar } from "./ChatMessageActionsBar"
import { ChatMessageContent } from "./chat-message-content"
import { MessageStatus, MessageTimestamp } from "./chat-message-status"
import { MessageRowActions, ProcessedChatMessage } from "./chat-message-types"

export function ChatFallbackMessageRow({
  message,
  index,
  agentId,
  siteId,
  conversationId,
  responsePrompt,
  isDarkMode,
  actions,
}: {
  message: ProcessedChatMessage
  index: number
  agentId: string
  siteId?: string
  conversationId?: string
  responsePrompt?: string
  isDarkMode: boolean
  actions: MessageRowActions
}) {
  return (
    <div className="flex flex-col max-w-[85%] md:max-w-[75%] min-w-0 px-4 md:px-0">
      <div
        className={`rounded-lg px-4 pt-4 pb-2 transition-all duration-300 ease-in-out text-foreground group overflow-hidden ${
          message.metadata?.status === "pending" ? "opacity-60" : ""
        }`}
        style={{
          backgroundColor:
            message.metadata?.status === "pending"
              ? isDarkMode
                ? "#2a2a3a"
                : "#f8f8f8"
              : isDarkMode
                ? "#2d2d3d"
                : "#f0f0f5",
          border: "none",
          boxShadow: "none",
          outline: "none",
          filter: "none",
        }}
      >
        <ChatMessageContent message={message} />
        <div className="flex items-center mt-2">
          <div className="flex items-center gap-2 flex-1">
            <MessageStatus message={message} onRetry={actions.onRetry} />
          </div>
          <div className="flex items-center min-w-0">
            {message.command_id && (
              <ChatResponseActions
                messageId={String(message.id || index)}
                commandId={message.command_id}
                agentId={agentId}
                siteId={siteId}
                conversationId={conversationId}
                userPrompt={responsePrompt}
                response={message.text}
              />
            )}
          </div>
          <div className="flex items-center justify-end shrink-0">
            <MessageTimestamp message={message} />
          </div>
        </div>
      </div>
      <ChatMessageActionsBar message={message} actions={actions} />
    </div>
  )
}
