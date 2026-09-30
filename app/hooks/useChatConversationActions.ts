"use client"

import type { Dispatch, SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { useSite } from '@/app/context/SiteContext'
import type { ChatMessage } from '@/app/types/chat'
import { toast } from 'react-hot-toast'
import { createConversation } from '@/app/services/chat-service'

interface ChatConversationActionsProps {
  agentId: string
  agentName: string
  setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>
  setIsAgentResponding: Dispatch<SetStateAction<boolean>>
  leadData: { id?: string; name?: string | null } | null
}

export function useChatConversationActions({
  agentId,
  agentName,
  setChatMessages,
  setIsAgentResponding,
  leadData,
}: ChatConversationActionsProps) {
  const router = useRouter()
  const { user } = useAuthContext()
  const { currentSite } = useSite()

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
    startNewConversation,
    handleNewLeadConversation,
    handleNewAgentConversation,
    handlePrivateDiscussion,
  }
}
