"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useLeadData(conversationId: string, siteId?: string) {
  const [leadData, setLeadData] = useState<any>(null)
  const [isLoadingLead, setIsLoadingLead] = useState(false)
  const [isAgentOnlyConversation, setIsAgentOnlyConversation] = useState(false)
  
  // Helper to check if we have a lead
  const isLead = leadData !== null
  
  useEffect(() => {
    // Skip for new conversations or when siteId is missing
    if (!conversationId || conversationId.startsWith("new-") || !siteId) return
    
    const loadLeadData = async () => {
      setIsLoadingLead(true)
      
      try {
        const supabase = createClient()
        
        // Get the lead_id and visitor_id from the conversation
        const { data: conversation, error: conversationError } = await supabase
          .from("conversations")
          .select("lead_id, visitor_id")
          .eq("id", conversationId)
          .single()
          
        if (conversationError) {
          console.error("Error fetching conversation data:", conversationError)
          setIsLoadingLead(false)
          return
        }
        
        // Check if this is an agent-only conversation
        if (!conversation.lead_id && conversation.visitor_id === null) {
          console.log("This is an agent-only conversation")
          setIsAgentOnlyConversation(true)
          setIsLoadingLead(false)
          return
        } else {
          setIsAgentOnlyConversation(false)
        }
        
        if (!conversation || !conversation.lead_id) {
          console.log("No lead associated with this conversation")
          setIsLoadingLead(false)
          return
        }
        
        // Then get the lead data
        const { data: lead, error: leadError } = await supabase
          .from("leads")
          .select("*")
          .eq("id", conversation.lead_id)
          .single()
          
        if (leadError) {
          console.error("Error fetching lead data:", leadError)
          setIsLoadingLead(false)
          return
        }
        
        // Set the lead data
        setLeadData({
          id: lead.id,
          name: lead.name || "Unknown",
          type: "Lead",
          status: "Online",
          avatarUrl: "/avatars/visitor-default.png" // Fallback image
        })
        
      } catch (error) {
        console.error("Error loading lead data:", error)
      } finally {
        setIsLoadingLead(false)
      }
    }
    
    loadLeadData()
  }, [conversationId, siteId])
  
  // Also check URL parameters for conversation mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const mode = url.searchParams.get("mode")
      
      if (mode === "agentOnly" || mode === "private") {
        console.log("Setting agent-only mode from URL parameter")
        setIsAgentOnlyConversation(true)
      }
    }
  }, [])
  
  return {
    leadData,
    isLoadingLead,
    isAgentOnlyConversation,
    setIsAgentOnlyConversation,
    isLead
  }
} 