"use client"

import { useRef, useState } from 'react'
import { useChatConversationActions } from './useChatConversationActions'
import { reconcileInterventionMessage } from './reconcile-intervention-message'
import { withMappedCommandStatus } from '@/app/services/map-chat-command-status'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { useSite } from '@/app/context/SiteContext'
import { ChatMessage } from '@/app/types/chat'
import { toast } from 'react-hot-toast'
import { 
    createConversation,
    sendTeamMemberIntervention,
    sendAgentMessage
} from '@/app/services/chat-service'
import {
  markInterventionMessageFailed,
  interventionErrorMessageId,
  interventionSavedMessageId,
} from '@/app/services/mark-intervention-message-failed'

// Helper function to log detailed API errors
const logApiError = (error: unknown, context: string) => {
  if (error instanceof Error) {
    console.error(`API Error (${context}):`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  } else if (error && typeof error === 'object') {
    console.error(`API Error (${context}):`, JSON.stringify(error));
  } else {
    console.error(`API Error (${context}):`, error);
  }
};

interface UseChatOperationsProps {
  agentId: string
  agentName: string
  conversationId: string
  isAgentOnlyConversation: boolean
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  setIsAgentResponding: React.Dispatch<React.SetStateAction<boolean>>
  leadData: { id?: string; name?: string | null } | null
}

export function useChatOperations({
  agentId,
  agentName,
  conversationId,
  isAgentOnlyConversation,
  setChatMessages,
  setIsAgentResponding,
  leadData
}: UseChatOperationsProps) {
  const router = useRouter()
  const { user } = useAuthContext()
  const { currentSite } = useSite()
  const [isLoading, setIsLoading] = useState(false)
  const sendInFlightRef = useRef(false)
  const sendSequenceRef = useRef(0)
  const conversationActions = useChatConversationActions({
    agentId, agentName, setChatMessages, setIsAgentResponding, leadData,
  })
  
  // True consumes the draft: the API accepted it or its saved failure is visible.
  // Rejected, skipped, and unconfirmed sends must leave the composer untouched.
  const handleSendMessage = async (message: string): Promise<boolean> => {
    if (!message.trim() || sendInFlightRef.current || !currentSite?.id || !user?.id) return false

    const userName = user.user_metadata?.name || (user.email ? user.email.split('@')[0] : 'Team Member')
    const userAvatar = user.user_metadata?.avatar_url || null
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}-${++sendSequenceRef.current}`,
      role: "team_member",
      text: message,
      timestamp: new Date(),
      sender_id: user.id,
      sender_name: userName,
      sender_avatar: userAvatar || undefined,
    }

    sendInFlightRef.current = true
    setIsLoading(true)
    setChatMessages(previous => [...previous, tempUserMessage])
    let actualConversationId = conversationId

    try {
      if (conversationId.startsWith("new-")) {
        const newConversation = await createConversation(
          currentSite.id,
          user.id,
          agentId,
          `Chat with ${agentName}`,
          { lead_id: leadData?.id },
        )
        if (!newConversation) throw new Error("Failed to create conversation")
        actualConversationId = newConversation.id
        router.replace(`/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${actualConversationId}`)
      }

      if (isAgentOnlyConversation) {
        const result = await sendAgentMessage(actualConversationId, message, agentId, {
          site_id: currentSite.id,
          lead_id: leadData?.id,
          team_member_id: user.id,
        })
        if (result?.success !== true) throw new Error("Message acceptance could not be confirmed.")

        const assistant = result.data?.messages?.assistant
        if (assistant?.message_id) {
          setChatMessages(previous => previous.some(row => row.id === assistant.message_id)
            ? previous
            : [...previous, {
                id: assistant.message_id,
                role: "assistant",
                text: assistant.content,
                timestamp: new Date(),
              }])
        }
      } else {
        const result = await sendTeamMemberIntervention(actualConversationId, message, user.id, agentId, {
          site_id: currentSite.id,
          lead_id: leadData?.id || undefined,
        })
        if (result?.success !== true) throw new Error("Message acceptance could not be confirmed.")

        const savedMessage = result.data?.message
        if (savedMessage?.message_id) {
          setChatMessages(previous => reconcileInterventionMessage(previous, tempUserMessage, savedMessage))
        }
      }
      return true
    } catch (error) {
      logApiError(error, isAgentOnlyConversation ? 'DirectAgentMessage' : 'TeamIntervention')
      toast.error(error instanceof Error ? `Error: ${error.message}` : "Failed to send message to the server.")
      setChatMessages(previous => previous.filter(row => row.id !== tempUserMessage.id))

      const unconfirmedMessageId = !isAgentOnlyConversation && interventionSavedMessageId(error)
      if (unconfirmedMessageId) {
        setChatMessages(previous => reconcileInterventionMessage(previous, tempUserMessage, {
          message_id: unconfirmedMessageId,
          custom_data: {
            voice_mode: 'agent_call',
            status: 'placement_unknown',
            call_status: 'placement_unknown',
            command_status: 'pending',
          },
        }))
        return false
      }

      // Only a deterministic API failure with an existing row can consume a draft.
      // Never persist a substitute message or replay an ambiguous network request.
      const savedMessageId = !isAgentOnlyConversation && interventionErrorMessageId(error)
      if (!savedMessageId) return false

      try {
        const errorMessage = error instanceof Error ? error.message : "API communication error"
        const savedMessage = await markInterventionMessageFailed({
          conversationId: actualConversationId,
          userId: user.id,
          content: message,
          errorMessage,
          userName,
          avatarUrl: userAvatar,
          messageId: savedMessageId,
        })
        if (!savedMessage) return false

        setChatMessages(previous => reconcileInterventionMessage(previous, tempUserMessage, {
          message_id: savedMessage.id,
          created_at: savedMessage.created_at,
          custom_data: savedMessage.custom_data,
        }))
        if (savedMessage.custom_data.status === 'placement_unknown' || savedMessage.custom_data.call_status === 'placement_unknown') {
          return false
        }
        return true
      } catch (statusError) {
        logApiError(statusError, 'InterventionFailureStatus')
        return false
      }
    } finally {
      sendInFlightRef.current = false
      setIsLoading(false)
    }
  }

  // Retry a failed message using the same row
  const handleRetryMessage = async (failedMessage: ChatMessage) => {
    if (!failedMessage.text || !failedMessage.id || sendInFlightRef.current || !currentSite?.id || !user?.id) return
    if (failedMessage.id.startsWith("temp-") || failedMessage.id.startsWith("error-")) return

    console.log(`[${new Date().toISOString()}] 🔄 Retrying failed message:`, failedMessage.id)

    const userName = user.user_metadata?.name || (user.email ? user.email.split('@')[0] : 'Team Member')
    const userAvatar = user.user_metadata?.avatar_url || null
    const pendingMetadata = {
      ...failedMessage.metadata,
      command_status: 'pending' as const,
      error_message: undefined,
    }

    sendInFlightRef.current = true
    setIsLoading(true)
    setChatMessages(prev => prev.map(msg =>
      msg.id === failedMessage.id
        ? { ...msg, metadata: pendingMetadata }
        : msg
    ))

    try {
      await sendTeamMemberIntervention(
        conversationId,
        failedMessage.text,
        user.id,
        agentId,
        {
          site_id: currentSite.id,
          lead_id: leadData?.id || undefined,
          visitor_id: undefined,
          message_id: failedMessage.id,
        }
      )

      // Realtime may already have advanced this row while the request was pending.
      console.log(`[${new Date().toISOString()}] ✅ Retry queued for message`, failedMessage.id)
    } catch (apiError) {
      logApiError(apiError, "TeamInterventionRetry")
      toast.error(apiError instanceof Error
        ? `Error: ${apiError.message}`
        : "Failed to send message to the server."
      )

      const apiSavedId = interventionErrorMessageId(apiError)
      if (!apiSavedId) {
        return
      }

      const errorMessage = apiError instanceof Error ? apiError.message : "API communication error"
      const savedMessage = await markInterventionMessageFailed({
        conversationId,
        userId: user.id,
        content: failedMessage.text,
        errorMessage,
        userName,
        avatarUrl: userAvatar,
        messageId: apiSavedId,
      })

      if (savedMessage) {
        setChatMessages(prev => prev.map(msg =>
          msg.id === savedMessage.id && msg.metadata === pendingMetadata
            ? {
                ...msg,
                metadata: withMappedCommandStatus(savedMessage.custom_data),
              }
            : msg
        ))
      }
    } finally {
      sendInFlightRef.current = false
      setIsLoading(false)
    }
  }

  return {
    isLoading,
    handleSendMessage,
    handleRetryMessage,
    ...conversationActions
  }
} 