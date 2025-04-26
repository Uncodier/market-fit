"use client"

import { useState, useEffect, useRef } from 'react'
import { ChatMessage } from '@/app/types/chat'
import { getConversationMessages, getAgentForConversation } from '@/app/services/chat-service'
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
  const { hasActiveChatRequest } = useApiRequestTracker()
  const messageSubscriptionRef = useRef<any>(null)
  
  // Efecto para controlar la animación de carga basado en peticiones API activas
  useEffect(() => {
    // Solo activar la animación de respuesta cuando hay una petición API activa a /agents/chat/message
    setIsAgentResponding(hasActiveChatRequest)
    console.log(`[ApiTracker] Estado de animación: ${hasActiveChatRequest ? '🟢 ACTIVA' : '🔴 INACTIVA'}`)
  }, [hasActiveChatRequest])
  
  // Load messages when the conversation changes
  useEffect(() => {
    async function loadMessages() {
      // Clean up any previous subscription
      if (messageSubscriptionRef.current) {
        console.log('Unsubscribing from previous conversation')
        messageSubscriptionRef.current.unsubscribe()
        messageSubscriptionRef.current = null
      }
    
      if (!conversationId) return
      
      setIsLoadingMessages(true)
      
      try {
        // Si es una nueva conversación, iniciar con un array vacío en lugar de mensaje dummy
        if (conversationId.startsWith("new-")) {
          setChatMessages([])
          // No mostrar animación para nuevas conversaciones hasta que se envíe el primer mensaje
          setIsAgentResponding(false)
        } else {
          console.log("Loading messages for conversation:", conversationId)
          
          // Load existing messages from the API
          const messages = await getConversationMessages(conversationId)
          
          // Log the messages to see the structure
          console.log("Loaded chat messages from API:", messages)
          console.log("Is agent-only conversation:", isAgentOnlyConversation)
          
          if (messages.length > 0) {
            setChatMessages(messages)
            
            // Ya no necesitamos esto porque ahora detectamos las peticiones API activas
            // Solo mostraremos la animación cuando hay peticiones activas a /agents/chat/message
            setIsAgentResponding(false)
          } else {
            // Si no hay mensajes, inicializar con array vacío
            setChatMessages([])
            // No activar la animación de espera si no hay mensajes reales
            setIsAgentResponding(false)
          }
          
          // Subscribe to new messages in real time
          if (!messageSubscriptionRef.current && !conversationId.startsWith("new-")) {
            const supabase = createClient()
            
            console.log(`Setting up real-time subscription for conversation: ${conversationId}`)
            
            // Create new subscription
            messageSubscriptionRef.current = supabase
              .channel(`conversation-${conversationId}`)
              .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`
              }, async (payload: { 
                new: { 
                  id: string
                  conversation_id: string
                  content: string
                  role: string
                  created_at: string
                  custom_data?: Record<string, any>
                }
              }) => {
                console.log(`[${new Date().toISOString()}] 📨 Nuevo mensaje via suscripción:`, {
                  id: payload.new.id,
                  role: payload.new.role,
                  contentPreview: payload.new.content.substring(0, 30) + "..."
                })
                
                // Ya no necesitamos desactivar la animación aquí, se desactivará automáticamente
                // cuando la petición API termine
                
                // Get all updated messages to fully synchronize
                getConversationMessages(conversationId).then(updatedMessages => {
                  // Replace the entire state with the updated messages from the API
                  setChatMessages(updatedMessages)
                })
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
      } finally {
        setIsLoadingMessages(false)
      }
    }
    
    loadMessages()
    
    // Clean up subscription when the component unmounts
    return () => {
      if (messageSubscriptionRef.current) {
        console.log('Unmounting: Unsubscribing from conversation')
        messageSubscriptionRef.current.unsubscribe()
        messageSubscriptionRef.current = null
      }
    }
  }, [conversationId, agentName, isAgentOnlyConversation])
  
  // Log messages when they're displayed
  useEffect(() => {
    console.log("Current chat messages state:", chatMessages)
    
    // Log the roles for debugging
    if (chatMessages.length > 0) {
      console.log("Message roles:", chatMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        hasVisitorId: !!msg.metadata?.visitor_id,
        hasLeadId: !!msg.metadata?.lead_id,
        isAgentOnly: isAgentOnlyConversation
      })))
    }
  }, [chatMessages, isAgentOnlyConversation])
  
  return {
    chatMessages,
    setChatMessages,
    isLoadingMessages,
    isAgentResponding,
    setIsAgentResponding
  }
} 