import { ChatMessage } from "@/app/types/chat"
import { MessageActions } from "./MessageActions"
import { MessageRowActions } from "./chat-message-types"

export function ChatMessageActionsBar({
  message,
  actions,
}: {
  message: ChatMessage
  actions: MessageRowActions
}) {
  return (
    <div className="flex justify-center w-full">
      <MessageActions
        message={message}
        onEdit={actions.onEdit}
        onDelete={actions.onDelete}
        onAccept={actions.onAccept}
        onUndoAccept={actions.onUndoAccept}
        isDeleting={actions.deletingMessageId === message.id}
        isAccepting={actions.acceptingMessageId === message.id}
        isActionsAccepted={actions.acceptedActionsMessageIds.has(message.id || "")}
      />
    </div>
  )
}
