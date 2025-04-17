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
      if (!conversationId) return
      
      setIsLoadingMessages(true)
      
      try {
        // If it's a new conversation, show a welcome message
        if (conversationId.startsWith("new-")) {
          setChatMessages([{
            id: "welcome",
            role: "user",
            text: `Hello! I'm looking for help with my project.`,
            timestamp: new Date(),
          }])
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
            if (lastMessage && (lastMessage.role === 'user' || lastMessage.role === 'team_member' || lastMessage.role === 'visitor')) {
              console.log(`[${new Date().toISOString()}] 🟢🟢🟢 ACTIVANDO ANIMACIÓN (último mensaje del usuario) 🟢🟢🟢`)
              setIsAgentResponding(true)
            }
          } else {
            // If there are no messages, set a welcome message
            setChatMessages([{
              id: "welcome",
              role: "user",
              text: `Hello! I'm looking for help with my project.`,
              timestamp: new Date(),
            }])
            
            // Show loading animation after welcome message
            console.log(`[${new Date().toISOString()}] 🟢🟢🟢 ACTIVANDO ANIMACIÓN (mensaje de bienvenida) 🟢🟢🟢`)
            setIsAgentResponding(true)
          }
          
          // Subscribe to new messages in real time
          if (!messageSubscriptionRef.current && !conversationId.startsWith("new-")) {
            const supabase = createClient()
            
            console.log(`Setting up real-time subscription for conversation: ${conversationId}`)
            
            // Clean up any previous subscription if it exists
            if (messageSubscriptionRef.current) {
              messageSubscriptionRef.current.unsubscribe()
            }
            
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
                  
                  // Update the messages to immediately add the assistant's response
                  setChatMessages(prev => [...prev, {
                    id: payload.new.id,
                    role: 'assistant',
                    text: payload.new.content,
                    timestamp: new Date(payload.new.created_at)
                  }])
                } else {
                  console.log(`[${new Date().toISOString()}] ⏳ Mensaje no es del asistente (${payload.new.role}), manteniendo animación`)
                }
                
                // Get all updated messages to fully synchronize
                getConversationMessages(conversationId).then(updatedMessages => {
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
        }])
      } finally {
        setIsLoadingMessages(false)
      }
    }
    
    loadMessages()
    
    // Clean up subscription when conversation changes or component unmounts
    return () => {
      if (messageSubscriptionRef.current) {
        console.log('Unsubscribing from previous conversation')
        messageSubscriptionRef.current.unsubscribe()
        messageSubscriptionRef.current = null
      }
    }
  }, [conversationId, agentName, isAgentOnlyConversation])
  
  // Add an effect to disable animation when we detect assistant messages
  useEffect(() => {
    // If we have messages and the last one is from the assistant, disable the animation
    if (chatMessages.length > 0) {
      const lastMessage = chatMessages[chatMessages.length - 1]
      if (lastMessage.role === 'assistant') {
        console.log(`[${new Date().toISOString()}] 🔴🔴🔴 DESACTIVANDO ANIMACIÓN (mensaje del asistente detectado en useEffect) 🔴🔴🔴`)
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