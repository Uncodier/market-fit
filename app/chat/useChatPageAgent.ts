"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { agents } from "@/app/data/mock-agents"
import type { Agent } from "@/app/types/agents"
import { markUINavigation } from "@/lib/navigation/navigation-helpers"
import { createClient } from "@/lib/supabase/client"

interface ChatPageAgentProps {
  agentId: string
  agentName: string
  conversationId: string
  clearMessagesForTransition: () => void
}

export function useChatPageAgent({
  agentId, agentName, conversationId, clearMessagesForTransition,
}: ChatPageAgentProps) {
  const router = useRouter()
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null)

  // Load agent data when agentId changes
  useEffect(() => {
    const loadAgent = async () => {
      // First try to find the agent in our mock list
      const mockAgent = agents.find((a: Agent) => a.id === agentId)
      
      if (mockAgent) {
        setCurrentAgent(mockAgent)
      } else {
        // Try to load from database
        try {
          const { getAgentForConversation } = await import("@/app/services/chat-service.client")
          const dbAgent: Agent | null = await getAgentForConversation(agentId)
          if (dbAgent) {
            setCurrentAgent(dbAgent)
          } else {
            // Use the URL name if the agent could not be loaded.
            if (agentName) {
              setCurrentAgent({
                id: agentId,
                name: agentName,
                description: "",
                type: "support",
                status: "active",
                conversations: 0,
                successRate: 0,
                lastActive: new Date().toISOString(),
                icon: "User"
              });
            }
          }
        } catch (error) {
          console.error("Error fetching agent from database:", error)
          // Preserve the agent display name when loading fails.
          if (agentName) {
            setCurrentAgent({
              id: agentId,
              name: agentName,
              description: "",
              type: "support",
              status: "active", 
              conversations: 0,
              successRate: 0,
              lastActive: new Date().toISOString(),
              icon: "User"
            });
          }
        }
      }
    }
    
    if (agentId) {
      console.log(`Loading agent data for agentId: ${agentId}, name: ${agentName}`);
      loadAgent()
    }
  }, [agentId, agentName])

  // Update breadcrumb when page is loaded
  useEffect(() => {
    // Prefer the loaded agent name over the URL name.
    const displayName = currentAgent?.name || agentName;
    
    // Update page title
    document.title = `Chat with ${displayName} | Market Fit`
    
    // Emit an event to update the breadcrumb
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        agentId,
        agentName: displayName
      }
    })
    
    window.dispatchEvent(event)
    
    // Clean up when unmounting
    return () => {
      document.title = 'Market Fit'
    }
  }, [agentId, agentName, currentAgent])

  // Fetch agent details when conversationId changes
  useEffect(() => {
    async function fetchConversationAgent() {
      if (!conversationId || conversationId.startsWith("new-")) return
      
      try {
        // Get the conversation to find its agent ID
        const { data: conversation, error } = await createClient()
          .from("conversations")
          .select("agent_id")
          .eq("id", conversationId)
          .single()
          
        if (error || !conversation) {
          console.error("Error fetching conversation agent:", error)
          return
        }
        
        const conversationAgentId = conversation.agent_id
        
        // Only update if we have a valid agent ID and it's different from current agentId
        if (conversationAgentId && conversationAgentId !== agentId) {
          // Get agent details
          const { getAgentForConversation } = await import("@/app/services/chat-service.client")
          const agent: Agent | null = await getAgentForConversation(conversationAgentId)
          if (agent) {
            // Update the URL with the agent details
            markUINavigation();
            router.replace(`/chat?conversationId=${conversationId}&agentId=${agent.id}&agentName=${encodeURIComponent(agent.name)}`)
          }
        }
      } catch (error) {
        console.error("Error fetching agent details:", error)
      }
    }
    
    fetchConversationAgent()
  }, [conversationId, router, agentId])

  // Add a listener for popstate events (browser back/forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const url = new URL(window.location.href)
      const convId = url.searchParams.get('conversationId')
      const agId = url.searchParams.get('agentId')
      const agName = url.searchParams.get('agentName')
      
      // Synchronize conversation mode and agent after browser navigation.
      if (convId && agId && agName) {
        // Reset messages when the conversation changes.
        if (convId !== conversationId) {
          clearMessagesForTransition();
        }
        
        // Routing is derived from the persisted conversation, never URL mode flags.
        
        // Load the agent when its ID changes.
        if (agId !== agentId) {
          // Check the local agent list first.
          const mockAgent = agents.find((a: Agent) => a.id === agId)
          if (mockAgent) {
            setCurrentAgent(mockAgent)
          } else {
            // Load the agent from the database.
            import("@/app/services/chat-service.client").then(async (mod) => {
              const dbAgent: Agent | null = await mod.getAgentForConversation(agId)
              if (dbAgent) {
                setCurrentAgent(dbAgent)
              } else if (agName) {
                // Fall back to the name from the URL.
                setCurrentAgent({
                  id: agId,
                  name: agName,
                  description: "",
                  type: "support",
                  status: "active",
                  conversations: 0,
                  successRate: 0,
                  lastActive: new Date().toISOString(),
                  icon: "User"
                });
              }
            }).catch((error: unknown) => {
              console.error("Error fetching agent during popstate:", error)
              // Fall back to the name from the URL.
              if (agName) {
                setCurrentAgent({
                  id: agId,
                  name: agName,
                  description: "",
                  type: "support",
                  status: "active",
                  conversations: 0,
                  successRate: 0,
                  lastActive: new Date().toISOString(),
                  icon: "User"
                });
              }
            });
          }
        }
      }
    }
    
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [conversationId, agentId, clearMessagesForTransition])

  return currentAgent
}
