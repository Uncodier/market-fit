import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { ChatMessage } from '@/app/types/chat'
import { getConversationMessages } from '@/app/services/getConversationMessages.client'
import { createClient } from '@/lib/supabase/client'
import { useApiRequestTracker } from './useApiRequestTracker'
import { coerceDate } from '@/app/utils/coerce-date'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { createRealtimeInvalidation } from '@/app/orders/hooks/realtime-invalidation'
import { createChatMessageRead } from './chat-message-read'

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
  const { user } = useAuthContext()
  const { hasActiveChatRequest } = useApiRequestTracker()
  const identity = `${user?.id || 'anonymous'}:${conversationId}`
  const identityRef = useRef(identity)
  identityRef.current = identity
  const invalidationRef = useRef<ReturnType<typeof createRealtimeInvalidation> | null>(null)
  const reader = useMemo(() => createChatMessageRead(async signal => {
    const rawMessages = await getConversationMessages(conversationId, { signal })
    const seen = new Set<string>()
    return normalizeChatMessages(rawMessages.filter(message => {
      if (!message.id || seen.has(message.id)) return false
      seen.add(message.id)
      return true
    }))
  }), [identity, conversationId])

  useEffect(() => {
    const hasActiveRequest = hasActiveChatRequest(conversationId)
    setIsAgentResponding(hasActiveRequest)
  }, [hasActiveChatRequest, conversationId])

  const swrKey = conversationId && !conversationId.startsWith('new-')
    ? ['chat-messages', user?.id || 'anonymous', conversationId]
    : null

  const { data: chatMessagesData, error: messageReadError, isLoading: isSwrLoading, mutate } = useSWR(
    swrKey,
    () => reader.read(),
    {
      keepPreviousData: false, revalidateOnFocus: false, revalidateOnReconnect: false,
      shouldRetryOnError: error => error?.code !== '42501', errorRetryCount: 3, errorRetryInterval: 5000,
    }
  )

  const chatMessages = useMemo(() => {
    if (conversationId?.startsWith('new-')) return []
    return normalizeChatMessages(chatMessagesData || [])
  }, [chatMessagesData, conversationId])
  const isLoadingMessages = isSwrLoading && chatMessagesData === undefined && !conversationId.startsWith('new-')
  const isTransitioningConversation = isLoadingMessages

  const setChatMessages = useCallback((updater: any) => {
    if (identityRef.current !== identity) return
    mutate((current = []) => {
      const next = typeof updater === 'function' ? updater(current) : updater
      return normalizeChatMessages(next)
    }, false)
  }, [identity, mutate])

  const syncMessages = useCallback(async () => {
    if (identityRef.current !== identity || !conversationId || conversationId.startsWith('new-')) return
    await mutate()
  }, [identity, conversationId, mutate])

  const clearMessagesForTransition = useCallback(() => {
    // SWR cache handles transitions; keep API for callers without forcing skeleton when cached.
  }, [])

  useEffect(() => {
    if (!conversationId || conversationId.startsWith('new-')) {
      setIsAgentResponding(false)
      return () => reader.abort()
    }
    let active = true
    let channel: any = null
    let status = 'INIT'
    const owns = () => active && identityRef.current === identity
    const invalidation = createRealtimeInvalidation(() => owns() ? mutate() : undefined)
    invalidationRef.current = invalidation
    const supabase = createClient()
    const disconnect = () => {
      const previous = channel
      channel = null
      try { void previous?.unsubscribe() } catch { /* Already closed. */ }
    }
    const connect = () => {
      if (!owns()) return
      disconnect()
      status = 'SUBSCRIBING'
      channel = supabase.channel(`messages-${conversationId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}`,
        }, (payload: any) => {
          if (owns()) invalidation.request(payload.eventType === 'INSERT' ? 300 : 500)
        }).subscribe((nextStatus: string) => { if (owns()) status = nextStatus })
    }
    // SWR owns the initial read; subscribing must not issue another startup read.
    connect()
    const recover = () => {
      if (!owns() || status === 'SUBSCRIBED' || status === 'SUBSCRIBING') return
      if (supabase.realtime?.isConnected?.() === true) connect()
    }
    const focus = () => {
      if (!owns()) return
      invalidation.request(0)
      recover()
    }
    const interval = setInterval(recover, 10_000)
    window.addEventListener('focus', focus)
    window.addEventListener('online', focus)
    return () => {
      active = false
      clearInterval(interval)
      window.removeEventListener('focus', focus)
      window.removeEventListener('online', focus)
      invalidation.dispose()
      if (invalidationRef.current === invalidation) invalidationRef.current = null
      disconnect()
      reader.abort()
    }
  }, [identity, conversationId, mutate, reader])

  const loadMessages = useCallback(async () => {
    if (identityRef.current === identity) invalidationRef.current?.request(0)
  }, [identity])

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
    messageReadError,
  }
}
