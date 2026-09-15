import { useEffect, useMemo, useState } from "react"
import { ChatMessage } from "@/app/types/chat"
import { getUserData } from "@/app/services/user-service"
import { ProcessedChatMessage } from "./chat-message-types"
import { SenderProfile } from "./resolveTeamMemberSender"

export function useProcessedMessages({
  chatMessages,
  currentUserId,
  currentUserName,
  isAgentOnlyConversation,
  hasLead,
}: {
  chatMessages: ChatMessage[]
  currentUserId?: string
  currentUserName?: string
  isAgentOnlyConversation: boolean
  hasLead: boolean
}) {
  return useMemo<ProcessedChatMessage[]>(() => {
    if (!chatMessages.length) return []

    console.log(`🔍 [ChatMessages] Rendering ${chatMessages.length} messages:`)
    console.log(
      "📝 Message order:",
      chatMessages
        .map(
          (message, index) =>
            `${index + 1}. ${message.role} at ${new Date(message.timestamp).toISOString()}`,
        )
        .slice(0, 5),
    )

    return chatMessages.map((message) => {
      let correctedRole = message.role

      if (
        message.role === "user" &&
        message.sender_id &&
        message.sender_id !== currentUserId
      ) {
        correctedRole = "user"
      } else if (message.role === "team_member") {
        correctedRole = "team_member"
      } else if (message.role === "visitor") {
        correctedRole = "visitor"
      } else if (
        message.role === "user" &&
        message.sender_id === "541396e1-a904-4a81-8cbf-0ca4e3b8b2b4"
      ) {
        correctedRole = "visitor"
      }

      const isTeamMemberRight =
        correctedRole === "team_member" && (!hasLead || isAgentOnlyConversation)
      const isRightAligned =
        correctedRole === "user" ||
        correctedRole === "visitor" ||
        isTeamMemberRight
      const isCurrentUserMessage = message.sender_id === currentUserId

      if (message.role === "user" || message.role === "team_member") {
        console.log(`🔍 [User Identification] Message ${message.id}:`, {
          originalRole: message.role,
          correctedRole,
          sender_id: message.sender_id,
          currentUserId,
          sender_name: message.sender_name,
          currentUserName,
          isCurrentUserMessage,
        })
      }

      return {
        ...message,
        role: correctedRole,
        isCurrentUserMessage,
        isRightAligned,
      }
    })
  }, [
    chatMessages,
    currentUserId,
    currentUserName,
    isAgentOnlyConversation,
    hasLead,
  ])
}

export function useMessageSenderData(
  chatMessages: ChatMessage[],
  currentUserId?: string,
) {
  const [userDataCache, setUserDataCache] = useState<Record<string, SenderProfile>>({})
  const [agentDataCache, setAgentDataCache] = useState<
    Record<string, { name: string; avatar_url?: string | null }>
  >({})

  useEffect(() => {
    const fetchUserData = async () => {
      const userIdsToFetch = chatMessages
        .filter(
          (message) =>
            message.sender_id &&
            !userDataCache[message.sender_id] &&
            (message.role === "user" || message.role === "team_member") &&
            (!message.sender_name || !message.sender_avatar),
        )
        .map((message) => message.sender_id as string)

      for (const userId of [...new Set(userIdsToFetch)]) {
        try {
          const userData = await getUserData(userId)
          if (userData) {
            setUserDataCache((current) => ({ ...current, [userId]: userData }))
          }
        } catch (error) {
          console.error(`Error fetching user data for ${userId}:`, error)
        }
      }
    }

    if (chatMessages.length > 0) {
      void fetchUserData()
    }
  }, [chatMessages, currentUserId, userDataCache])

  useEffect(() => {
    const fetchAgentData = async () => {
      const agentIdsToFetch = chatMessages
        .filter(
          (message) =>
            message.agent_id &&
            !agentDataCache[message.agent_id] &&
            (message.role === "assistant" || message.role === "agent"),
        )
        .map((message) => message.agent_id as string)

      for (const agentId of agentIdsToFetch) {
        try {
          const { getAgentForConversation } = await import(
            "@/app/services/chat-service.client"
          )
          const agentData = await getAgentForConversation(agentId)
          if (agentData) {
            setAgentDataCache((current) => ({
              ...current,
              [agentId]: { name: agentData.name, avatar_url: null },
            }))
          }
        } catch (error) {
          console.error(`Error fetching agent data for ${agentId}:`, error)
        }
      }
    }

    if (chatMessages.length > 0) {
      void fetchAgentData()
    }
  }, [chatMessages, agentDataCache])

  return { userDataCache, agentDataCache }
}
