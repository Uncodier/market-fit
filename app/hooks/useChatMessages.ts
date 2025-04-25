"use client"

import { useState, useEffect, useRef } from 'react'
import { ChatMessage } from '@/app/types/chat'
import { getConversationMessages, getAgentForConversation } from '@/app/services/chat-service'
import { createClient } from '@/lib/supabase/client'

export function useChatMessages(
  conversationId: string,
  agentId: string,
  agentName: string,
  isAgentOnlyConversation: boolean
) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isAgentResponding, setIsAgentResponding] = useState(false)
  const messageSubscriptionRef = useRef<any>(null)
  
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
          // Asegurarse que no haya animación de carga
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
            
            // Check if the last message was from the user or team_member
            // If so, we need to show the loading animation for the agent's response
            const lastMessage = messages[messages.length - 1]
            
            // Only activate the loading animation if the last message is from a user AND doesn't have an error status
            if (lastMessage && 
                (lastMessage.role === 'user' || lastMessage.role === 'team_member' || lastMessage.role === 'visitor') && 
                (!lastMessage.metadata?.command_status || lastMessage.metadata?.command_status !== "failed")) {
              console.log(`[${new Date().toISOString()}] 🟢🟢🟢 ACTIVANDO ANIMACIÓN (último mensaje del usuario) 🟢🟢🟢`)
              setIsAgentResponding(true)
            } else {
              // Disable animation for error messages or assistant messages
              setIsAgentResponding(false)
              console.log(`[${new Date().toISOString()}] 🔴🔴🔴 DESACTIVANDO ANIMACIÓN (último mensaje con error o del asistente) 🔴🔴🔴`)
            }
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
                
                // If the message is from the assistant, disable the waiting animation
                if (payload.new.role === 'assistant') {
                  console.log(`[${new Date().toISOString()}] 🔴🔴🔴 DESACTIVANDO ANIMACIÓN (suscripción - mensaje asistente) 🔴🔴🔴`)
                  // Disable immediately, without waiting
                  setIsAgentResponding(false)
                  
                  // Don't add to state immediately to avoid duplicates
                  // Let the getConversationMessages call handle all updates
                } else {
                  // Check if the message has custom_data with a failed command_status
                  const customData = payload.new.custom_data as Record<string, any> | undefined;
                  
                  if (customData && customData.command_status === "failed") {
                    console.log(`[${new Date().toISOString()}] 🔴🔴🔴 DESACTIVANDO ANIMACIÓN (suscripción - mensaje con error) 🔴🔴🔴`)
                    setIsAgentResponding(false)
                  } else {
                    console.log(`[${new Date().toISOString()}] ⏳ Mensaje no es del asistente (${payload.new.role}), manteniendo animación`)
                  }
                }
                
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
  
  // Add an effect to disable animation when we detect assistant messages or error messages
  useEffect(() => {
    // If we have messages and the last one is from the assistant or has error status, disable the animation
    if (chatMessages.length > 0) {
      const lastMessage = chatMessages[chatMessages.length - 1]
      if (lastMessage.role === 'assistant' || 
          (lastMessage.metadata?.command_status === "failed")) {
        console.log(`[${new Date().toISOString()}] 🔴🔴🔴 DESACTIVANDO ANIMACIÓN (mensaje del asistente o con error detectado en useEffect) 🔴🔴🔴`)
        setIsAgentResponding(false)
      }
    }
  }, [chatMessages])
  
  // Log messages when they're displayed
  useEffect(() => {
    console.log("Current chat messages state:", chatMessages)
    
    // Log the roles for debugging
    if (chatMessages.length > 0) {
      console.log("Message roles:", chatMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
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