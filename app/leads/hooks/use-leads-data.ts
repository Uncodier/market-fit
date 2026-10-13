"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { getLeads, searchLeadsWithCount } from "../actions"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { createClient } from "@/lib/supabase/client"
import { useUserData } from "@/app/hooks/use-user-data"
import { normalizeOrigin } from "../list-helpers"
import type { Lead } from "../types"

export interface LeadsData {
  leads: Lead[]
  totalCount: number
  isSearch: boolean
}

export function useLeadsData(currentSite: { id: string } | null) {
  // Debounced search query for SWR
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch leads with SWR
  const { 
    data: leadsData, 
    isLoading: isLeadsLoading, 
    mutate: mutateLeads 
  } = useSWR<LeadsData>(
    currentSite?.id ? ['leads', currentSite.id, debouncedSearchQuery] : null,
    async ([, siteId, q]: [string, string, string]) => {
      if (q) {
        const result = await searchLeadsWithCount(siteId, q, 200, 0)
        if (result.error) throw new Error(result.error)
        return {
          leads: result.leads?.map((lead: any) => ({
            ...lead,
            origin: normalizeOrigin(lead.origin),
            personal_email: lead.personal_email || null
          })) || [],
          totalCount: result.totalCount || 0,
          isSearch: true
        }
      } else {
        const result = await getLeads(siteId)
        if (result.error) throw new Error(result.error)
        
        const supabase = createClient()
        const { count } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('site_id', siteId)
          
        return {
          leads: result.leads?.map((lead: any) => ({
            ...lead,
            origin: normalizeOrigin(lead.origin),
            personal_email: lead.personal_email || null
          })) || [],
          totalCount: count || 0,
          isSearch: false
        }
      }
    },
    { revalidateOnFocus: false }
  )

  const dbLeads = leadsData?.leads || []
  const loading = isLeadsLoading
  const searchTotalCount = leadsData?.isSearch ? leadsData.totalCount : null
  const allLeadsTotalCount = leadsData && !leadsData.isSearch ? leadsData.totalCount : null

  // Fetch segments with SWR
  const { data: segments } = useSWR(
    currentSite?.id ? ['segments', currentSite.id] : null,
    async ([_, siteId]) => {
      const response = await getSegments(siteId)
      if (response.error) throw new Error(response.error)
      return response.segments?.map(s => ({ id: s.id, name: s.name })) || []
    },
    { fallbackData: [] }
  )

  // Fetch campaigns with SWR
  const { data: campaigns } = useSWR(
    currentSite?.id ? ['campaigns', currentSite.id] : null,
    async ([_, siteId]) => {
      const result = await getCampaigns(siteId)
      if (result.error) throw new Error(result.error)
      return result.data || []
    },
    { fallbackData: [] }
  )
  // Get unique assignee IDs from leads
  const assigneeIds = useMemo(() => {
    const ids = dbLeads.map(lead => lead.assignee_id).filter(Boolean) as string[]
    return Array.from(new Set(ids))
  }, [dbLeads])
  
  // Fetch user data for assignees
  const { userData } = useUserData(assigneeIds)

  return { dbLeads, loading, searchTotalCount, allLeadsTotalCount, segments, campaigns, mutateLeads, searchQuery, setSearchQuery, userData }
}
