import { useState, useEffect, useCallback } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { getUserData } from '@/app/services/user-service'

export function useLeadData(conversationId: string, siteId?: string) {
  const [isAgentOnlyConversation, setIsAgentOnlyConversation] = useState(false)
  
  const { data, isLoading: isSwrLoadingLead, mutate } = useSWR(
    conversationId && !conversationId.startsWith("new-") && siteId ? ['lead-data', conversationId, siteId] : null,
    async ([_, convId, sId]) => {
      const supabase = createClient()
      
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
            status,
            companies (
              id,
              name
            )
          )
        `)
        .eq("id", convId)
        .maybeSingle()
        
      if (conversationError) throw conversationError
      
      if (!conversationWithLead) return { leadData: null, isInvalidated: false, isAgentOnly: false }
      
      // Check if this is an agent-only conversation
      if (!conversationWithLead.lead_id && conversationWithLead.visitor_id === null) {
        return { leadData: null, isInvalidated: false, isAgentOnly: true }
      }
      
      const lead = conversationWithLead.leads
      
      if (!lead && conversationWithLead.lead_id) {
        return { leadData: null, isInvalidated: true, isAgentOnly: false }
      }
      
      if (!lead) return { leadData: null, isInvalidated: false, isAgentOnly: false }
      
      let assigneeData = null
      if (lead.assignee_id) {
        try {
          assigneeData = await getUserData(lead.assignee_id)
        } catch (error) {
          console.error("Error fetching assignee data:", error)
        }
      }
      
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
      
      return {
        leadData: {
          id: lead.id,
          name: lead.name || "Unknown",
          type: "Lead",
          status: lead.status || "new",
          avatarUrl: null,
          email: lead.email,
          phone: lead.phone,
          assignee_id: lead.assignee_id,
          assignee: assigneeData ? {
            id: lead.assignee_id,
            name: assigneeData.name,
            avatar_url: assigneeData.avatar_url
          } : null,
          company: companyData,
          site_id: lead.site_id
        },
        isInvalidated: false,
        isAgentOnly: false
      }
    }
  )
  
  useEffect(() => {
    if (data?.isAgentOnly !== undefined) {
      setIsAgentOnlyConversation(data.isAgentOnly)
    }
  }, [data?.isAgentOnly])
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const mode = url.searchParams.get("mode")
      
      if (mode === "agentOnly" || mode === "private") {
        setIsAgentOnlyConversation(true)
      }
    }
  }, [])
  
  const refreshLeadData = useCallback(() => mutate(), [mutate])

  const isLoadingLead = isSwrLoadingLead && data === undefined

  return {
    leadData: data?.leadData || null,
    isLoadingLead,
    isAgentOnlyConversation,
    setIsAgentOnlyConversation,
    isLead: data?.leadData !== null && data?.leadData !== undefined,
    isLeadInvalidated: data?.isInvalidated || false,
    refreshLeadData
  }
}
