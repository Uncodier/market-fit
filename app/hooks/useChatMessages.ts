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
  const lastConversationIdRef = useRef<string>('')
  
  // Efecto para controlar la animación de carga basado en peticiones API activas
  useEffect(() => {
    setIsAgentResponding(hasActiveChatRequest)
  }, [hasActiveChatRequest])
  
  // Function to clear messages and set transition state
  const clearMessagesForTransition = useCallback(() => {
    setIsTransitioningConversation(true)
    setChatMessages([])
  }, [])
  
  // Optimized message loader
  const loadMessages = useCallback(async () => {
    // Clean up any previous subscription
    if (messageSubscriptionRef.current) {
      messageSubscriptionRef.current.unsubscribe()
      messageSubscriptionRef.current = null
    }
  
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
        const messages = await getConversationMessages(conversationId)
        
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
              // Get all updated messages to fully synchronize
              const updatedMessages = await getConversationMessages(conversationId)
              setChatMessages(updatedMessages)
            })
            .subscribe()
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
  }, [conversationId])
  
  // Load messages when the conversation changes - optimized to prevent unnecessary reloads
  useEffect(() => {
    // Only load if conversation ID actually changed
    if (lastConversationIdRef.current !== conversationId) {
      lastConversationIdRef.current = conversationId
      loadMessages()
    }
    
    // Clean up subscription when the component unmounts
    return () => {
      if (messageSubscriptionRef.current) {
        messageSubscriptionRef.current.unsubscribe()
        messageSubscriptionRef.current = null
      }
    }
  }, [conversationId, loadMessages])
  
  return {
    chatMessages,
    setChatMessages,
    isLoadingMessages,
    isAgentResponding,
    setIsAgentResponding,
    isTransitioningConversation,
    clearMessagesForTransition
  }
} 