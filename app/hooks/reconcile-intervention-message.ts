import type { ChatMessage } from '@/app/types/chat'
import type { InterventionAcceptedResponse } from '@/app/services/intervention-request'
import { withMappedCommandStatus } from '@/app/services/map-chat-command-status'

type AcceptedMessage = NonNullable<NonNullable<InterventionAcceptedResponse['data']>['message']>

export function reconcileInterventionMessage(
  messages: ChatMessage[],
  optimisticMessage: ChatMessage,
  savedMessage: AcceptedMessage,
): ChatMessage[] {
  const messageId = savedMessage.message_id
  if (!messageId) return messages

  // Realtime can arrive before the HTTP response with a newer delivery status.
  if (messages.some(message => message.id === messageId)) {
    return messages.filter(message => message.id !== optimisticMessage.id)
  }

  const reconciledMessage: ChatMessage = {
    ...optimisticMessage,
    id: messageId,
    text: savedMessage.content ?? optimisticMessage.text,
    timestamp: savedMessage.created_at ? new Date(savedMessage.created_at) : optimisticMessage.timestamp,
    metadata: withMappedCommandStatus(savedMessage.custom_data) ?? optimisticMessage.metadata,
  }

  if (messages.some(message => message.id === optimisticMessage.id)) {
    return messages.map(message => message.id === optimisticMessage.id ? reconciledMessage : message)
  }
  return [...messages, reconciledMessage]
}