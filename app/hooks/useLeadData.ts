"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useLeadData(conversationId: string, siteId?: string) {
  const [leadData, setLeadData] = useState<any>(null)
  const [isLoadingLead, setIsLoadingLead] = useState(false)
  const [isAgentOnlyConversation, setIsAgentOnlyConversation] = useState(false)
  const lastConversationIdRef = useRef<string>('')
  const lastSiteIdRef = useRef<string>('')
  
  // Helper to check if we have a lead
  const isLead = leadData !== null
  
  // Optimized lead data loader
  const loadLeadData = useCallback(async () => {
    // Skip for new conversations or when siteId is missing
    if (!conversationId || conversationId.startsWith("new-") || !siteId) {
      setIsAgentOnlyConversation(false)
      setLeadData(null)
      return
    }
    
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
        return
      }
      
      // Check if this is an agent-only conversation
      if (!conversation.lead_id && conversation.visitor_id === null) {
        setIsAgentOnlyConversation(true)
        setLeadData(null)
        return
      } else {
        setIsAgentOnlyConversation(false)
      }
      
      if (!conversation || !conversation.lead_id) {
        setLeadData(null)
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
  }, [conversationId, siteId])
  
  // Load lead data only when necessary
  useEffect(() => {
    // Only reload if conversation or site actually changed
    if (lastConversationIdRef.current !== conversationId || lastSiteIdRef.current !== siteId) {
      lastConversationIdRef.current = conversationId
      lastSiteIdRef.current = siteId || ''
      loadLeadData()
    }
  }, [conversationId, siteId, loadLeadData])
  
  // Check URL parameters for conversation mode - optimized to run once
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const mode = url.searchParams.get("mode")
      
      if (mode === "agentOnly" || mode === "private") {
        setIsAgentOnlyConversation(true)
      }
    }
  }, []) // Only run once on mount
  
  return {
    leadData,
    isLoadingLead,
    isAgentOnlyConversation,
    setIsAgentOnlyConversation,
    isLead
  }
} 