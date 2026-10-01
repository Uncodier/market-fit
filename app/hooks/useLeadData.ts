import { useCallback } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { getUserData } from '@/app/services/user-service'
import { conversationChannel, isInternalAgentConversation } from '@/lib/chat/conversation-routing'
import { resolveParticipantIdentity } from '@/lib/chat/participant-identity'

export function useLeadData(conversationId: string, siteId?: string) {
  const { data, error, isLoading: isSwrLoadingLead, mutate } = useSWR(
    conversationId && !conversationId.startsWith("new-") && siteId ? ['lead-data', conversationId, siteId] : null,
    async ([, convId, sId]) => {
      const supabase = createClient()
      
      const { data: conversationWithLead, error: conversationError } = await supabase
        .from("conversations")
        .select(`
          lead_id,
          visitor_id,
          channel,
          custom_data,
          leads (
            id,
            name,
            email,
            phone,
            social_networks,
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
        .eq("site_id", sId)
        .maybeSingle()
        
      if (conversationError) throw conversationError
      
      if (!conversationWithLead) throw new Error('Conversation not found')
      const routing = {
        channel: conversationChannel(conversationWithLead),
        isAgentOnly: isInternalAgentConversation(conversationWithLead),
        participantIdentity: resolveParticipantIdentity(conversationWithLead, conversationWithLead.leads),
      }
      
      // Check if this is an agent-only conversation
      if (routing.isAgentOnly) {
        return { leadData: null, isInvalidated: false, ...routing }
      }
      
      const lead = conversationWithLead.leads
      
      if (!lead && conversationWithLead.lead_id) {
        return { leadData: null, isInvalidated: true, ...routing }
      }
      
      if (!lead) return { leadData: null, isInvalidated: false, ...routing }
      
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
          name: routing.participantIdentity.name,
          type: "Lead",
          status: lead.status || "new",
          avatarUrl: routing.participantIdentity.avatarUrl || null,
          email: lead.email,
          phone: lead.phone,
          social_networks: lead.social_networks,
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
        ...routing,
      }
    }
  )
  
  const refreshLeadData = useCallback(() => mutate(), [mutate])

  const isLoadingLead = isSwrLoadingLead && data === undefined

  return {
    leadData: data?.leadData || null,
    participantIdentity: data?.isAgentOnly ? undefined : data?.participantIdentity,
    isLoadingLead,
    isAgentOnlyConversation: data?.isAgentOnly === true,
    conversationChannel: data?.channel,
    isConversationReady: Boolean(data && !error),
    isLead: data?.leadData !== null && data?.leadData !== undefined,
    isLeadInvalidated: data?.isInvalidated || false,
    refreshLeadData
  }
}
