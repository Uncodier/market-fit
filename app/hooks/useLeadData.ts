"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUserData } from '@/app/services/user-service'

export function useLeadData(conversationId: string, siteId?: string) {
  const [leadData, setLeadData] = useState<any>(null)
  const [isLoadingLead, setIsLoadingLead] = useState(false)
  const [isAgentOnlyConversation, setIsAgentOnlyConversation] = useState(false)
  const [isLeadInvalidated, setIsLeadInvalidated] = useState(false)
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
      setIsLoadingLead(false)
      setIsLeadInvalidated(false)
      return
    }
    
    setIsLoadingLead(true)
    
    try {
      const supabase = createClient()
      
      // Get the lead data directly through the conversation using a JOIN
      // This bypasses RLS issues since the user has access to the conversation
      const { data: conversationWithLead, error: conversationError } = await supabase
        .from("conversations")
        .select(`
          lead_id,
          visitor_id,
          leads (
            id,
            name,
            email,
            phone,
            assignee_id,
            site_id,
            company_id,
            companies (
              id,
              name
            )
          )
        `)
        .eq("id", conversationId)
        .maybeSingle()
        
      if (conversationError) {
        console.error("Error fetching conversation data:", conversationError)
        setLeadData(null)
        setIsLoadingLead(false)
        setIsLeadInvalidated(false)
        return
      }
      
      if (!conversationWithLead) {
        setLeadData(null)
        setIsLoadingLead(false)
        setIsLeadInvalidated(false)
        return
      }
      
      // Check if this is an agent-only conversation
      if (!conversationWithLead.lead_id && conversationWithLead.visitor_id === null) {
        setIsAgentOnlyConversation(true)
        setLeadData(null)
        setIsLoadingLead(false)
        return
      } else {
        setIsAgentOnlyConversation(false)
      }
      
      // Extract lead data from the JOIN result
      const lead = conversationWithLead.leads
      
      if (!lead && conversationWithLead.lead_id) {
        // Lead is referenced but doesn't exist - it was deleted/invalidated
        console.warn("[useLeadData] Lead was invalidated/deleted:", conversationWithLead.lead_id)
        setIsLeadInvalidated(true)
        setLeadData(null)
        setIsLoadingLead(false)
        return
      }
      
      if (!lead) {
        setLeadData(null)
        setIsLoadingLead(false)
        setIsLeadInvalidated(false)
        return
      }
      
      // Reset invalidated state if lead is found
      setIsLeadInvalidated(false)

      // Get assignee information if assignee_id exists
      let assigneeData = null
      if (lead.assignee_id) {
        try {
          assigneeData = await getUserData(lead.assignee_id)
        } catch (error) {
          console.error("Error fetching assignee data:", error)
        }
      }
      
      // Set the lead data with company and assignee information
      // Handle both array and object company data
      let companyData = null
      if (lead.companies) {
        if (Array.isArray(lead.companies) && lead.companies.length > 0) {
          companyData = {
            id: lead.companies[0].id,
            name: lead.companies[0].name
          }
        } else if (typeof lead.companies === 'object' && lead.companies.id) {
          companyData = {
            id: lead.companies.id,
            name: lead.companies.name
          }
        }
      }
      
      setLeadData({
        id: lead.id,
        name: lead.name || "Unknown",
        type: "Lead",
        status: "Online",
        avatarUrl: null,
        email: lead.email,
        phone: lead.phone,
        assignee_id: lead.assignee_id,
        assignee: assigneeData ? {
          id: lead.assignee_id,
          name: assigneeData.name,
          avatar_url: assigneeData.avatar_url
        } : null,
        company: companyData
      })
      
    } catch (error) {
      console.error("Error loading lead data:", error)
      setLeadData(null)
    } finally {
      setIsLoadingLead(false)
    }
  }, [conversationId, siteId])
  
  // Load lead data only when necessary
  useEffect(() => {
    // Only reload if conversation or site actually changed
    if (lastConversationIdRef.current !== conversationId || lastSiteIdRef.current !== siteId) {
      // Immediately clear lead data when conversation changes to avoid showing stale data
      setLeadData(null)
      setIsLoadingLead(true)
      setIsLeadInvalidated(false)
      
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
    isLead,
    isLeadInvalidated
  }
} 