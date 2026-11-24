"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { getLeadsWithCount, searchLeadsWithCount } from "../actions"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { useUserData } from "@/app/hooks/use-user-data"
import { normalizeOrigin } from "../list-helpers"
import { isLeadSegmentId } from "../segment-scope"
import type { Lead, Segment } from "../types"

const EMPTY_LEADS: Lead[] = []
const EMPTY_SEGMENTS: Segment[] = []

export interface LeadsData {
  leads: Lead[]
  totalCount: number | null
  isSearch: boolean
}

export function useLeadsData(currentSite: { id: string } | null, segmentId?: string) {
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
    error: leadsError,
    isLoading: isLeadsLoading, 
    isValidating: isLeadsValidating,
    mutate: mutateLeads
  } = useSWR<LeadsData>(
    currentSite?.id ? ['leads', currentSite.id, debouncedSearchQuery, ...(segmentId === undefined ? [] : [segmentId])] : null,
    async ([, siteId, q, segment]: [string, string, string, string?]) => {
      if (segment !== undefined && !isLeadSegmentId(segment)) {
        return { leads: [], totalCount: 0, isSearch: Boolean(q) }
      }
      const segmentArgs: [string?] = segment === undefined ? [] : [segment]
      if (q) {
        const result = await searchLeadsWithCount(siteId, q, 200, 0, ...segmentArgs)
        if (result.error) throw new Error(result.error)
        return {
          leads: result.leads?.map(lead => ({
            ...lead,
            origin: normalizeOrigin(lead.origin),
            personal_email: lead.personal_email || null
          })) || [],
          totalCount: result.totalCount,
          isSearch: true
        }
      } else {
        // Read the exact total with the list under the same session and filters.
        const result = await getLeadsWithCount(siteId, ...segmentArgs)
        if (result.error) throw new Error(result.error)

        return {
          leads: result.leads?.map(lead => ({
            ...lead,
            origin: normalizeOrigin(lead.origin),
            personal_email: lead.personal_email || null
          })) || [],
          totalCount: result.totalCount,
          isSearch: false
        }
      }
    },
    { revalidateOnFocus: false, shouldRetryOnError: false, keepPreviousData: false }
  )

  const dbLeads = leadsData?.leads || EMPTY_LEADS
  const loading = isLeadsLoading
  const searchTotalCount = leadsData?.isSearch ? leadsData.totalCount : null
  const allLeadsTotalCount = leadsData && !leadsData.isSearch ? leadsData.totalCount : null

  // Fetch segments with SWR
  const { data: segments = EMPTY_SEGMENTS } = useSWR(
    currentSite?.id ? ['segments', currentSite.id] : null,
    async ([, siteId]) => {
      const response = await getSegments(siteId)
      if (response.error) throw new Error(response.error)
      return response.segments?.map(s => ({ id: s.id, name: s.name })) || []
    },
    { fallbackData: EMPTY_SEGMENTS }
  )

  // Fetch campaigns with SWR
  const { data: campaigns } = useSWR(
    currentSite?.id ? ['campaigns', currentSite.id] : null,
    async ([, siteId]) => {
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

  return { dbLeads, loading, leadsError, isLeadsValidating, hasLeadsData: leadsData !== undefined,
    searchTotalCount, allLeadsTotalCount, segments, campaigns, mutateLeads, searchQuery, setSearchQuery, userData }
}
