"use client"

import React, { useEffect, useState } from "react"
import type { KeyedMutator } from "swr"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { normalizeOrigin } from "../list-helpers"
import type { Lead } from "../types"
import type { ViewType } from "@/app/components/view-selector"
import type { LeadsData } from "./use-leads-data"

export function useLeadsKanban(currentSite: { id: string } | null, viewType: ViewType, loading: boolean, mutateLeads: KeyedMutator<LeadsData>) {
  // Kanban pagination state for leads
  const [kanbanPagination, setKanbanPagination] = useState<Record<string, { page: number; hasMore: boolean; isLoading: boolean }>>({
    new: { page: 1, hasMore: true, isLoading: false },
    contacted: { page: 1, hasMore: true, isLoading: false },
    qualified: { page: 1, hasMore: true, isLoading: false },
    cold: { page: 1, hasMore: true, isLoading: false },
    converted: { page: 1, hasMore: true, isLoading: false },
    lost: { page: 1, hasMore: true, isLoading: false },
    not_qualified: { page: 1, hasMore: true, isLoading: false }
  })

  // Total counts for each status from the database
  const [totalCounts, setTotalCounts] = useState<Record<string, number>>({
    new: 0,
    contacted: 0,
    qualified: 0,
    cold: 0,
    converted: 0,
    lost: 0,
    not_qualified: 0
  })

  // Function to load total counts for kanban view
  const loadTotalCounts = React.useCallback(async () => {
    if (!currentSite?.id) return

    try {
      const supabase = createClient()
      const statuses = ['new', 'contacted', 'qualified', 'cold', 'converted', 'lost', 'not_qualified']
      const counts: Record<string, number> = {}

      // Fetch count for each status
      for (const status of statuses) {
        const { count, error } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('site_id', currentSite.id)
          .eq('status', status)

        if (error) {
          console.error(`Error fetching count for ${status}:`, error)
          counts[status] = 0
        } else {
          counts[status] = count || 0
        }
      }

      setTotalCounts(counts)

      // Set kanban pagination state based on total counts
      setKanbanPagination({
        new: { page: 1, hasMore: counts.new > 50, isLoading: false },
        contacted: { page: 1, hasMore: counts.contacted > 50, isLoading: false },
        qualified: { page: 1, hasMore: counts.qualified > 50, isLoading: false },
        cold: { page: 1, hasMore: counts.cold > 50, isLoading: false },
        converted: { page: 1, hasMore: counts.converted > 50, isLoading: false },
        lost: { page: 1, hasMore: counts.lost > 50, isLoading: false },
        not_qualified: { page: 1, hasMore: counts.not_qualified > 50, isLoading: false }
      })
    } catch (error) {
      console.error("Error loading total counts:", error)
    }
  }, [currentSite?.id])

  // Handle load more for kanban columns
  const handleLoadMoreKanban = async (status: string) => {
    const currentPagination = kanbanPagination[status]
    if (currentPagination.isLoading || !currentPagination.hasMore) return

    if (!currentSite) return

    // Set loading state
    setKanbanPagination(prev => ({
      ...prev,
      [status]: { ...prev[status], isLoading: true }
    }))

    try {
      const supabase = createClient()
      const itemsPerPage = 50
      const offset = currentPagination.page * itemsPerPage

      // Fetch more leads for this specific status
      const { data: moreLeads, error } = await supabase
        .from('leads')
        .select(`
          id,
          name,
          email,
          personal_email,
          phone,
          company,
          company_id,
          position,
          segment_id,
          campaign_id,
          status,
          notes,
          origin,
          created_at,
          updated_at,
          last_contact,
          site_id,
          user_id,
          birthday,
          language,
          social_networks,
          address,
          attribution,
          assignee_id,
          companies(name)
        `)
        .eq('site_id', currentSite.id)
        .eq('status', status)
        .order('created_at', { ascending: false })
        .range(offset, offset + itemsPerPage - 1)

      if (error) throw error

      // Normalize new leads
      const normalizedMoreLeads = moreLeads.map((lead: any) => ({
        ...lead,
        origin: normalizeOrigin(lead.origin),
        personal_email: lead.personal_email || null
      }))

      // Add new leads to the existing leads array
      mutateLeads((currentData: any) => {
        if (!currentData) return currentData
        const existingLeadIds = new Set(currentData.leads.map((l: Lead) => l.id))
        const newLeads = normalizedMoreLeads.filter((l: any) => !existingLeadIds.has(l.id))
        return {
          ...currentData,
          leads: [...currentData.leads, ...newLeads]
        }
      }, { revalidate: false })

      // Update pagination state
      setKanbanPagination(prev => ({
        ...prev,
        [status]: { 
          ...prev[status], 
          page: prev[status].page + 1,
          isLoading: false,
          hasMore: moreLeads.length === itemsPerPage
        }
      }))

    } catch (error) {
      console.error('Error loading more leads:', error)
      toast.error("Failed to load more leads")
      setKanbanPagination(prev => ({
        ...prev,
        [status]: { ...prev[status], isLoading: false }
      }))
    }
  }

  // Load total counts when switching to kanban view
  useEffect(() => {
    if (viewType === 'kanban' && !loading) {
      loadTotalCounts()
    }
  }, [viewType, loading, loadTotalCounts])

  return { kanbanPagination, totalCounts, handleLoadMoreKanban }
}
