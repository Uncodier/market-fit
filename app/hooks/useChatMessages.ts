"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatMessage } from '@/app/types/chat'
import { getConversationMessages } from '@/app/services/getConversationMessages.client'
import { getAgentForConversation } from '@/app/services/chat-service'
import { createClient } from '@/lib/supabase/client'
import { useApiRequestTracker } from './useApiRequestTracker'

export function useChatMessages(
  conversationId: string,
  agentId: string,
  agentName: string,
  isAgentOnlyConversation: boolean
) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isAgentResponding, setIsAgentResponding] = useState(false)
  const [isTransitioningConversation, setIsTransitioningConversation] = useState(false)
  const { hasActiveChatRequest } = useApiRequestTracker()
  const messageSubscriptionRef = useRef<any>(null)
  const messageSubscriptionStatusRef = useRef<string>('INIT')
  const isResubscribingRef = useRef(false)
  const lastConversationIdRef = useRef<string>('')
  
  // Efecto para controlar la animación de carga basado en peticiones API activas para esta conversación específica
  useEffect(() => {
    const hasActiveRequest = hasActiveChatRequest(conversationId)
    setIsAgentResponding(hasActiveRequest)
  }, [hasActiveChatRequest, conversationId])
  
  // Function to clear messages and set transition state
  const clearMessagesForTransition = useCallback(() => {
    setIsTransitioningConversation(true)
    setChatMessages([])
  }, [])

  const teardownRealtimeSubscription = useCallback(() => {
    if (messageSubscriptionRef.current) {
      try {
        messageSubscriptionRef.current.unsubscribe()
      } catch (e) {
        console.warn('[useChatMessages] Failed to unsubscribe from realtime channel:', e)
      } finally {
        messageSubscriptionRef.current = null
        messageSubscriptionStatusRef.current = 'CLOSED'
      }
    }
  }, [])
  
  const syncMessages = useCallback(async () => {
    if (!conversationId || conversationId.startsWith("new-")) return
    
    try {
      const rawMessages = await getConversationMessages(conversationId)
      const seen = new Set<string>()
      const messages = rawMessages.filter((m) => {
        if (!m.id || seen.has(m.id)) return false
        seen.add(m.id)
        return true
      })
      setChatMessages(messages)
    } catch (error) {
      console.error("Error syncing messages:", error)
    }
  }, [conversationId])

  // Optimized message loader
  const loadMessages = useCallback(async () => {
    // Clean up any previous subscription
    teardownRealtimeSubscription()
  
    if (!conversationId) {
      setIsTransitioningConversation(false)
      return
    }
    
    setIsLoadingMessages(true)
    
    try {
      if (conversationId.startsWith("new-")) {
        setChatMessages([])
        setIsAgentResponding(false)
        setIsTransitioningConversation(false)
      } else {
        // Load existing messages from the API
        const rawMessages = await getConversationMessages(conversationId)
        // Deduplicate by id so React never sees duplicate keys (e.g. from realtime + optimistic updates).
        const seen = new Set<string>()
        const messages = rawMessages.filter((m) => {
          if (!m.id || seen.has(m.id)) return false
          seen.add(m.id)
          return true
        })

        if (messages.length > 0) {
          setChatMessages(messages)
          setIsAgentResponding(false)
        } else {
          setChatMessages([])
          setIsAgentResponding(false)
        }
        
        // End transition state after messages are loaded
        setIsTransitioningConversation(false)
        
        // Subscribe to new messages in real time
        if (!conversationId.startsWith("new-")) {
          const supabase = createClient()
          
          messageSubscriptionRef.current = supabase
            .channel(`conversation-${conversationId}`)
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${conversationId}`
            }, async () => {
              // Get all updated messages to fully synchronize; deduplicate by id.
              const raw = await getConversationMessages(conversationId)
              const seen = new Set<string>()
              const updatedMessages = raw.filter((m) => {
                if (!m.id || seen.has(m.id)) return false
                seen.add(m.id)
                return true
              })
              setChatMessages(updatedMessages)
            })
            .subscribe((status: string) => {
              messageSubscriptionStatusRef.current = status
            })
        }
      }
    } catch (error) {
      console.error("Error loading messages:", error)
      setChatMessages([{
        id: "error",
        role: "assistant",
        text: "Sorry, there was an error loading the conversation. Please try again.",
        timestamp: new Date(),
        command_id: undefined,
        metadata: {
          command_status: "failed",
          error_message: "Failed to load conversation messages"
        }
      }])
      setIsTransitioningConversation(false)
    } finally {
      setIsLoadingMessages(false)
    }
  }, [conversationId, teardownRealtimeSubscription])

  const ensureRealtimeSubscriptionHealthy = useCallback(async () => {
    if (!conversationId || conversationId.startsWith("new-")) return

    const status = messageSubscriptionStatusRef.current
    const hasChannel = Boolean(messageSubscriptionRef.current)

    // Only resubscribe on known bad states or missing channel.
    const shouldResubscribe =
      !hasChannel ||
      status === 'CHANNEL_ERROR' ||
      status === 'TIMED_OUT' ||
      status === 'CLOSED'

    if (!shouldResubscribe) return
    if (isResubscribingRef.current) return

    isResubscribingRef.current = true
    try {
      teardownRealtimeSubscription()
      await loadMessages()
    } finally {
      isResubscribingRef.current = false
    }
  }, [conversationId, loadMessages, teardownRealtimeSubscription])
  
  // Load messages when the conversation changes - optimized to prevent unnecessary reloads
  useEffect(() => {
    // Only load if conversation ID actually changed
    if (lastConversationIdRef.current !== conversationId) {
      lastConversationIdRef.current = conversationId
      loadMessages()
    }
    
    // Clean up subscription when the component unmounts
    return () => {
      teardownRealtimeSubscription()
    }
  }, [conversationId, loadMessages, teardownRealtimeSubscription])

  // Sync messages when user re-enters the tab/window.
  // We rely on Supabase's automatic socket reconnection instead of forcing reconnects.
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          syncMessages()
        }, 1000)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    
    // Add event listener for when messages are globally rejected
    const handleMessagesRejected = () => {
      // Reload messages to pick up deletions
      syncMessages()
    }
    window.addEventListener('conversation:messages-rejected', handleMessagesRejected)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('conversation:messages-rejected', handleMessagesRejected)
      clearTimeout(debounceTimer)
    }
  }, [syncMessages])
  
  return {
    chatMessages,
    setChatMessages,
    isLoadingMessages,
    isAgentResponding,
    setIsAgentResponding,
    isTransitioningConversation,
    clearMessagesForTransition,
    loadMessages
  }
} 