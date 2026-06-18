import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { ChatMessage } from '@/app/types/chat'
import { getConversationMessages } from '@/app/services/getConversationMessages.client'
import { createClient } from '@/lib/supabase/client'
import { useApiRequestTracker } from './useApiRequestTracker'
import { coerceDate } from '@/app/utils/coerce-date'

function normalizeChatMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    timestamp: coerceDate(message.timestamp),
  }
}

function normalizeChatMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(normalizeChatMessage)
}

export function useChatMessages(
  conversationId: string,
  agentId: string,
  agentName: string,
  isAgentOnlyConversation: boolean
) {
  const [isAgentResponding, setIsAgentResponding] = useState(false)
  const { hasActiveChatRequest } = useApiRequestTracker()
  const messageSubscriptionRef = useRef<any>(null)
  const messageSubscriptionStatusRef = useRef<string>('INIT')
  const isResubscribingRef = useRef(false)
  const lastConversationIdRef = useRef<string>('')

  useEffect(() => {
    const hasActiveRequest = hasActiveChatRequest(conversationId)
    setIsAgentResponding(hasActiveRequest)
  }, [hasActiveChatRequest, conversationId])

  const swrKey = conversationId && !conversationId.startsWith('new-')
    ? ['chat-messages', conversationId]
    : null

  const { data: chatMessagesData, isLoading: isSwrLoading, mutate } = useSWR(
    swrKey,
    async ([_, convId]) => {
      const rawMessages = await getConversationMessages(convId)
      const seen = new Set<string>()
      return normalizeChatMessages(
        rawMessages.filter((m) => {
          if (!m.id || seen.has(m.id)) return false
          seen.add(m.id)
          return true
        })
      )
    },
    { keepPreviousData: false }
  )

  const chatMessages = useMemo(() => {
    if (conversationId?.startsWith('new-')) return []
    return normalizeChatMessages(chatMessagesData || [])
  }, [chatMessagesData, conversationId])
  const isLoadingMessages = isSwrLoading && chatMessagesData === undefined && !conversationId.startsWith('new-')
  const isTransitioningConversation = isLoadingMessages

  const setChatMessages = useCallback((updater: any) => {
    mutate((current = []) => {
      const next = typeof updater === 'function' ? updater(current) : updater
      return normalizeChatMessages(next)
    }, false)
  }, [mutate])

  const syncMessages = useCallback(async () => {
    if (!conversationId || conversationId.startsWith('new-')) return
    await mutate()
  }, [conversationId, mutate])

  const clearMessagesForTransition = useCallback(() => {
    // SWR cache handles transitions; keep API for callers without forcing skeleton when cached.
  }, [])

  const teardownRealtimeSubscription = useCallback(() => {
    if (messageSubscriptionRef.current) {
      try {
        messageSubscriptionStatusRef.current = 'UNSUBSCRIBING'
        messageSubscriptionRef.current.unsubscribe()
      } catch (err) {
        console.error('Error unsubscribing from messages:', err)
      }
      messageSubscriptionRef.current = null
      messageSubscriptionStatusRef.current = 'CLOSED'
    }
  }, [])

  const loadMessages = useCallback(async () => {
    teardownRealtimeSubscription()

    if (!conversationId) {
      return
    }

    try {
      if (conversationId.startsWith('new-')) {
        setIsAgentResponding(false)
      } else {
        await mutate()

        if (typeof window !== 'undefined') {
          const supabase = createClient()

          messageSubscriptionStatusRef.current = 'SUBSCRIBING'
          messageSubscriptionRef.current = supabase
            .channel(`messages-${conversationId}`)
            .on('postgres_changes', {
              event: '*',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${conversationId}`,
            }, async () => {
              await mutate()
            })
            .subscribe((status: string) => {
              messageSubscriptionStatusRef.current = status
            })
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error)
      setIsAgentResponding(false)
    }
  }, [conversationId, mutate, teardownRealtimeSubscription])

  useEffect(() => {
    const checkConnection = () => {
      if (!conversationId || conversationId.startsWith('new-')) return

      const supabase = createClient()
      const isConnected = supabase.channel('any').connectionState() === 'OPEN'

      if (
        messageSubscriptionRef.current &&
        messageSubscriptionStatusRef.current !== 'SUBSCRIBED' &&
        messageSubscriptionStatusRef.current !== 'SUBSCRIBING' &&
        isConnected &&
        !isResubscribingRef.current
      ) {
        isResubscribingRef.current = true
        setTimeout(() => {
          loadMessages().finally(() => {
            isResubscribingRef.current = false
          })
        }, 1000)
      }
    }

    const intervalId = setInterval(checkConnection, 10000)
    return () => clearInterval(intervalId)
  }, [conversationId, loadMessages])

  useEffect(() => {
    const handleFocus = () => {
      if (conversationId && !conversationId.startsWith('new-')) {
        syncMessages()

        if (messageSubscriptionStatusRef.current !== 'SUBSCRIBED') {
          loadMessages()
        }
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [conversationId, syncMessages, loadMessages])

  useEffect(() => {
    if (lastConversationIdRef.current !== conversationId) {
      lastConversationIdRef.current = conversationId
      loadMessages()
    }
  }, [conversationId, loadMessages])

  useEffect(() => {
    return () => {
      teardownRealtimeSubscription()
    }
  }, [teardownRealtimeSubscription])

  return {
    chatMessages,
    setChatMessages,
    isLoadingMessages,
    isAgentResponding,
    setIsAgentResponding,
    isTransitioningConversation,
    syncMessages,
    reloadMessages: loadMessages,
    clearMessagesForTransition,
  }
}
