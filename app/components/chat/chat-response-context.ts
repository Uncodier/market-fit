import { ChatMessage } from "@/app/types/chat"

const HUMAN_ROLES = new Set<ChatMessage["role"]>(["user", "visitor", "team_member"])

export function findPromptForChatResponse(messages: ChatMessage[], responseIndex: number): string | undefined {
  const responseTime = new Date(messages[responseIndex]?.timestamp).getTime()
  const indexed = messages
    .map((message, index) => ({ message, index }))
    .filter(({ message, index }) => {
      if (!HUMAN_ROLES.has(message.role)) return false
      const messageTime = new Date(message.timestamp).getTime()
      if (!Number.isFinite(responseTime) || !Number.isFinite(messageTime)) return index < responseIndex
      return messageTime < responseTime || (messageTime === responseTime && index < responseIndex)
    })
    .sort((left, right) => {
      const timeDifference =
        new Date(right.message.timestamp).getTime() - new Date(left.message.timestamp).getTime()
      return timeDifference || right.index - left.index
    })

  return indexed.find(({ message }) => message.text.trim())?.message.text.trim()
}
