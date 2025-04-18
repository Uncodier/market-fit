"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { useSite } from '@/app/context/SiteContext'
import { ChatMessage } from '@/app/types/chat'
import { toast } from 'react-hot-toast'
import { 
  createConversation,
  sendTeamMemberIntervention,
  sendAgentMessage,
  addMessage,
  addTeamMemberMessage
} from '@/app/services/chat-service'

// Helper function to log detailed API errors
const logApiError = (error: any, context: string) => {
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
  leadData: any
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
  
  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading || !currentSite?.id || !user?.id) return
    
    // Obtain user name and avatar
    const userName = user.user_metadata?.name || (user.email ? user.email.split('@')[0] : 'Team Member')
    const userAvatar = user.user_metadata?.avatar_url || "/avatars/user-default.png"
    
    // Create a temporary message for UI feedback with the correct role (always team_member for UI)
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "team_member", // Always team_member for UI display, regardless of conversation type
      text: message,
      timestamp: new Date(),
      sender_id: user.id,
      sender_name: userName,
      sender_avatar: userAvatar
    }
    
    // Set loading state while we send the API request
    setIsLoading(true)
    
    // Add temporary message to conversation immediately for UI feedback
    // Use a function version to ensure we work with latest state
    setChatMessages(prevMessages => {
      // Check if this temp message is already in the array to avoid duplicates
      const isDuplicate = prevMessages.some(msg => msg.id === tempUserMessage.id);
      if (isDuplicate) {
        return prevMessages;
      }
      return [...prevMessages, tempUserMessage];
    });
    
    // Activate waiting animation for agent response
    setIsAgentResponding(true)
    console.log(`[${new Date().toISOString()}] 🟢🟢🟢 ACTIVANDO ANIMACIÓN DE ESPERA 🟢🟢🟢`)
    
    try {
      // For new conversations, create a real conversation first
      let actualConversationId = conversationId
      
      if (conversationId.startsWith("new-")) {
        // Create a new conversation
        const newConversation = await createConversation(
          currentSite.id,
          user.id,
          agentId,
          `Chat with ${agentName}`,
          {
            lead_id: leadData?.id
          }
        )
        
        if (newConversation) {
          actualConversationId = newConversation.id
          
          // Update the URL with the real conversation ID
          router.replace(`/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${actualConversationId}`)
        } else {
          throw new Error("Failed to create conversation")
        }
      }
      
      // Custom data for API
      const customData = {
        user_name: userName,
        avatar_url: userAvatar
      }
      
      console.log(`Sending message for conversation: ${actualConversationId}, agent: ${agentId}, isAgentOnly: ${isAgentOnlyConversation}`)
      console.log(`Message type: ${isAgentOnlyConversation ? 'DIRECT AGENT MESSAGE' : 'TEAM INTERVENTION'}`)
      
      try {
        if (isAgentOnlyConversation) {
          // Use direct agent message API for agent-only conversations
          console.log("★★★ SENDING DIRECT AGENT MESSAGE ★★★")
          console.log("Message text:", tempUserMessage.text)
          
          try {
            // Call the direct agent message API - let the API handle the message creation
            console.log(`[${new Date().toISOString()}] 📞 Calling sendAgentMessage...`)
            const result = await sendAgentMessage(
              actualConversationId,
              tempUserMessage.text,
              agentId,
              {
                site_id: currentSite.id,
                lead_id: leadData?.id,
                visitor_id: undefined, // No visitor for direct agent conversations
                team_member_id: user.id
              }
            )
            console.log(`[${new Date().toISOString()}] ✅ RESPUESTA directa recibida:`, result?.success)
            
            // Process the response if we have the full expected structure
            if (result?.success && result?.data?.messages?.assistant) {
              console.log(`[${new Date().toISOString()}] 📝 Respuesta completa recibida con estructura correcta`)
              
              const agentResponse: ChatMessage = {
                id: result.data.messages.assistant.message_id || `agent-${Date.now()}`,
                role: "assistant",
                text: result.data.messages.assistant.content,
                timestamp: new Date(),
              }
              
              // Add the agent response to the conversation
              console.log(`[${new Date().toISOString()}] 📝 Agregando respuesta del agente al chat`)
              setChatMessages(prev => [...prev, agentResponse])
            } else {
              console.log(`[${new Date().toISOString()}] ⚠️ Respuesta incompleta:`, result)
            }
          } catch (apiCallError) {
            console.error(`[${new Date().toISOString()}] ❌ Error en la API de mensajes directos:`, apiCallError)
            
            throw apiCallError
          }
        } else {
          // Use the intervention API for conversations with leads or visitors
          console.log(`[${new Date().toISOString()}] 📞 Enviando team intervention`)
          
          await sendTeamMemberIntervention(
            actualConversationId,
            tempUserMessage.text,
            user.id,
            agentId,
            {
              site_id: currentSite?.id,
              lead_id: leadData?.id || undefined,
              visitor_id: undefined
            }
          )
          console.log(`[${new Date().toISOString()}] ✅ Team intervention enviada correctamente`)
        }
      } catch (apiError) {
        console.error(`[${new Date().toISOString()}] ❌ Error al enviar mensaje:`, apiError)
        logApiError(apiError, isAgentOnlyConversation ? 'DirectAgentMessage' : 'TeamIntervention')
        
        // Show a toast notification with the error
        toast.error(apiError instanceof Error 
          ? `Error: ${apiError.message}` 
          : "Failed to send message to the server."
        )
        
        // Si falla la API, crear mensaje en DB con status:failed
        try {
          // Remove temporary message to avoid duplicates
          setChatMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id))
          
          // Create error metadata
          const errorMetadata = {
            ...customData,
            command_status: "failed",
            error_message: apiError instanceof Error ? apiError.message : "API communication error"
          }
          
          // Add message to database with failed status
          const savedMessage = await addTeamMemberMessage(
            actualConversationId,
            user.id,
            userName,
            userAvatar,
            tempUserMessage.text,
            errorMetadata
          )
          
          if (savedMessage) {
            // Add the saved message with failed status to UI
            setChatMessages(prev => [...prev, {
              id: savedMessage.id,
              role: "team_member",
              text: tempUserMessage.text,
              timestamp: new Date(savedMessage.created_at),
              sender_id: user.id,
              sender_name: userName,
              sender_avatar: userAvatar,
              metadata: {
                command_status: "failed",
                error_message: errorMetadata.error_message
              }
            }])
            
            console.log(`[${new Date().toISOString()}] ⚠️ Mensaje guardado con estado 'failed'`, savedMessage.id)
          }
        } catch (dbError) {
          console.error(`[${new Date().toISOString()}] 💥 Error al guardar mensaje de error en DB:`, dbError)
        }
      }
    } catch (error) {
      console.error("Error sending message:", error)
      
      // Add error message to chat
      setChatMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: "system",
        text: error instanceof Error 
          ? `Error: ${error.message}` 
          : "There was an error sending your message. Please try again.",
        timestamp: new Date()
      }])
      
      // Remove temporary message since there was an error
      setChatMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id))
    } finally {
      // Always clear loading states
      setIsLoading(false)
      setIsAgentResponding(false)
      console.log(`[${new Date().toISOString()}] 🔴🔴🔴 DESACTIVANDO ANIMACIÓN (finally) 🔴🔴🔴`)
    }
  }

  // Start a new conversation
  const startNewConversation = async () => {
    console.log("==== Starting: startNewConversation ====")
    
    // Debug essential values
    console.log("currentSite:", currentSite)
    console.log("user:", user)
    console.log("agentId:", agentId)
    console.log("agentName:", agentName)
    
    if (!agentId) {
      console.error("ERROR: agentId is empty")
      return
    }
    
    if (!currentSite?.id) {
      console.error("ERROR: currentSite or currentSite.id is null or undefined")
      return
    }
    
    if (!user?.id) {
      console.error("ERROR: user or user.id is null or undefined")
      return
    }
    
    try {
      // Reset any active agent response animations before creating a new conversation
      setIsAgentResponding(false)
      
      // Debug parameters being passed to createConversation
      console.log("Creating conversation with parameters:")
      console.log("- siteId:", currentSite.id)
      console.log("- userId:", user.id)
      console.log("- agentId:", agentId)
      console.log("- title:", `Chat with ${agentName}`)
      console.log("- options: {}") // No additional options
      
      // Create a generic conversation
      const conversation = await createConversation(
        currentSite.id,
        user.id,
        agentId,
        `Chat with ${agentName}`
        // No additional options
      )
      
      if (conversation) {
        console.log("New conversation created successfully:", conversation)
        
        // Clear the chat messages to avoid any transitional issues
        setChatMessages([])
        
        router.push(`/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${conversation.id}`)
      } else {
        console.error("Failed to create conversation - returned null")
        // Fallback to temporary ID if creation fails
        const newConversationId = `new-${Date.now()}`
        router.push(`/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${newConversationId}`)
      }
    } catch (error) {
      console.error("Error creating conversation:", error)
      console.error("Error details:", error instanceof Error ? error.message : String(error))
      // Fallback to temporary ID on error
      const newConversationId = `new-${Date.now()}`
      router.push(`/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${newConversationId}`)
    } finally {
      console.log("==== Ending: startNewConversation ====")
    }
  }

  // Create a new lead conversation
  const handleNewLeadConversation = async () => {
    console.log("==== Starting: handleNewLeadConversation ====")
    
    // Debug essential values
    console.log("currentSite:", currentSite)
    console.log("user:", user)
    console.log("agentId:", agentId)
    console.log("agentName:", agentName)
    console.log("leadData:", leadData)
    
    if (!agentId) {
      console.error("ERROR: agentId is empty")
      return
    }
    
    if (!currentSite?.id) {
      console.error("ERROR: currentSite or currentSite.id is null or undefined")
      return
    }
    
    if (!user?.id) {
      console.error("ERROR: user or user.id is null or undefined")
      return
    }
    
    if (!leadData?.id) {
      console.error("ERROR: leadData or leadData.id is null or undefined")
      return
    }
    
    try {
      // Reset any active agent response animations before creating a new conversation
      setIsAgentResponding(false)
      
      // Debug parameters being passed to createConversation
      console.log("Creating lead conversation with parameters:")
      console.log("- siteId:", currentSite.id)
      console.log("- userId:", user.id)
      console.log("- agentId:", agentId)
      console.log("- title:", `Chat with ${leadData.name}`)
      console.log("- options:", { lead_id: leadData.id })
      
      // Create a conversation with lead_id
      const conversation = await createConversation(
        currentSite.id,
        user.id,
        agentId,
        `Chat with ${leadData.name}`,
        { lead_id: leadData.id }
      )
      
      console.log("createConversation result:", conversation)
      
      if (conversation) {
        console.log("New lead conversation created successfully:", conversation)
        console.log("Redirecting to:", `/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${conversation.id}`)
        
        // Clear the chat messages to avoid any transitional issues
        setChatMessages([])
        
        router.push(`/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${conversation.id}`)
      } else {
        console.error("Failed to create lead conversation - returned null")
      }
    } catch (error) {
      console.error("Error creating lead conversation:", error)
      console.error("Error details:", error instanceof Error ? error.message : String(error))
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace available")
    } finally {
      console.log("==== Ending: handleNewLeadConversation ====")
    }
  }
  
  // Create a new agent-only conversation
  const handleNewAgentConversation = async () => {
    console.log("==== Starting: handleNewAgentConversation ====")
    
    // Debug essential values
    console.log("currentSite:", currentSite)
    console.log("user:", user)
    console.log("agentId:", agentId)
    console.log("agentName:", agentName)
    
    if (!agentId) {
      console.error("ERROR: agentId is empty")
      toast?.error?.("Cannot create agent conversation: No agent selected")
      return
    }
    
    if (!currentSite?.id) {
      console.error("ERROR: currentSite or currentSite.id is null or undefined")
      toast?.error?.("Cannot create conversation: No site selected")
      return
    }
    
    if (!user?.id) {
      console.error("ERROR: user or user.id is null or undefined")
      toast?.error?.("Cannot create conversation: Not logged in")
      return
    }
    
    try {
      // Reset any active agent response animations before creating a new conversation
      setIsAgentResponding(false)
      
      // Debug parameters being passed to createConversation
      console.log("Creating AGENT-ONLY conversation with parameters:")
      console.log("- siteId:", currentSite.id)
      console.log("- userId:", user.id)
      console.log("- agentId:", agentId)
      console.log("- title:", `Direct chat with ${agentName}`)
      console.log("- options: { is_agent_conversation: true }")
      
      // Create a regular conversation with just the agent - explicitly specify this is an agent conversation
      const conversation = await createConversation(
        currentSite.id,
        user.id,
        agentId,
        `Direct chat with ${agentName}`,
        { is_agent_conversation: true } // This flag will tell the service not to create a visitor_id
      )
      
      console.log("Agent-only conversation creation result:", conversation)
      
      if (conversation) {
        console.log("★★★ NEW AGENT-ONLY CONVERSATION CREATED ★★★")
        console.log("Conversation ID:", conversation.id)
        
        // Create URL with mode parameter for agent-only conversation
        const newUrl = `/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${conversation.id}&mode=agentOnly`
        console.log("Redirecting to new agent conversation URL:", newUrl)
        
        // Clear the chat messages to avoid any transitional issues
        setChatMessages([])
        
        // Navigate to the new conversation
        router.push(newUrl) // Use router.push instead of window.history for proper routing
      } else {
        console.error("Failed to create agent conversation - returned null")
        toast?.error?.("Failed to create conversation. Please try again.")
      }
    } catch (error) {
      console.error("Error creating agent conversation:", error)
      console.error("Error details:", error instanceof Error ? error.message : String(error))
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace available")
      toast?.error?.("Error creating conversation: " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      console.log("==== Ending: handleNewAgentConversation ====")
    }
  }
  
  // Create a new private discussion
  const handlePrivateDiscussion = async () => {
    console.log("==== Starting: handlePrivateDiscussion ====")
    
    // Debug essential values
    console.log("currentSite:", currentSite)
    console.log("user:", user)
    console.log("agentId:", agentId)
    console.log("agentName:", agentName)
    
    if (!agentId) {
      console.error("ERROR: agentId is empty")
      return
    }
    
    if (!currentSite?.id) {
      console.error("ERROR: currentSite or currentSite.id is null or undefined")
      return
    }
    
    if (!user?.id) {
      console.error("ERROR: user or user.id is null or undefined")
      return
    }
    
    try {
      // Reset any active agent response animations before creating a new conversation
      setIsAgentResponding(false)
      
      // Debug parameters being passed to createConversation
      console.log("Creating private conversation with parameters:")
      console.log("- siteId:", currentSite.id)
      console.log("- userId:", user.id)
      console.log("- agentId:", agentId)
      console.log("- title:", `Private discussion with ${agentName}`)
      console.log("- options:", { is_private: true })
      
      // Create a private conversation
      const conversation = await createConversation(
        currentSite.id,
        user.id,
        agentId,
        `Private discussion with ${agentName}`,
        { 
          is_private: true
        }
      )
      
      console.log("createConversation result:", conversation)
      
      if (conversation) {
        console.log("New private conversation created successfully:", conversation)
        console.log("Redirecting to:", `/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${conversation.id}&mode=private`)
        
        // Clear the chat messages to avoid any transitional issues
        setChatMessages([])
        
        router.push(`/chat?agentId=${agentId}&agentName=${encodeURIComponent(agentName)}&conversationId=${conversation.id}&mode=private`)
      } else {
        console.error("Failed to create private conversation - returned null")
      }
    } catch (error) {
      console.error("Error creating private conversation:", error)
      console.error("Error details:", error instanceof Error ? error.message : String(error))
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace available")
    } finally {
      console.log("==== Ending: handlePrivateDiscussion ====")
    }
  }

  return {
    isLoading,
    handleSendMessage,
    startNewConversation,
    handleNewLeadConversation,
    handleNewAgentConversation,
    handlePrivateDiscussion
  }
} 