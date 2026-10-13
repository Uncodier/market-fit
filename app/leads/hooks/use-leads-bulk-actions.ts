"use client"

import { useState } from "react"
import type { KeyedMutator } from "swr"
import { assignLeadToUser, deleteLead, updateLead } from "../actions"
import { normalizeCompanyField } from "../list-helpers"
import { toast } from "sonner"
import type { Lead } from "../types"
import type { LeadsData } from "./use-leads-data"

export function useLeadsBulkActions(currentSite: { id: string } | null, user: { id: string } | null, dbLeads: Lead[], mutateLeads: KeyedMutator<LeadsData>) {
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)

  // Bulk actions
  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedLeads.size} leads?`)) return
    
    setIsBulkActionLoading(true)
    try {
      const promises = Array.from(selectedLeads).map(id => deleteLead(id))
      await Promise.all(promises)
      
      mutateLeads((currentData: any) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          leads: currentData.leads.filter((lead: Lead) => !selectedLeads.has(lead.id))
        }
      }, { revalidate: false })
      setSelectedLeads(new Set())
      toast.success(`${selectedLeads.size} leads deleted successfully`)
    } catch (error) {
      console.error("Error in bulk delete:", error)
      toast.error("Failed to delete some leads")
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  const handleBulkAssign = async () => {
    if (!user?.id || !currentSite?.id) {
      toast.error("User not authenticated or site not selected")
      return
    }

    setIsBulkActionLoading(true)
    try {
      const promises = Array.from(selectedLeads).map(id => assignLeadToUser(id, user.id, currentSite.id))
      await Promise.all(promises)
      
      mutateLeads((currentData: any) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          leads: currentData.leads.map((lead: Lead) => 
            selectedLeads.has(lead.id) ? { ...lead, assignee_id: user.id } : lead
          )
        }
      }, { revalidate: false })
      setSelectedLeads(new Set())
      toast.success(`${selectedLeads.size} leads assigned successfully`)
    } catch (error) {
      console.error("Error in bulk assign:", error)
      toast.error("Failed to assign some leads")
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  const handleBulkStatusChange = async (newStatus: string) => {
    if (!currentSite?.id) return

    setIsBulkActionLoading(true)
    try {
      const leadsToUpdate = dbLeads.filter((lead: Lead) => selectedLeads.has(lead.id))
      
      const promises = leadsToUpdate.map((lead: Lead) => {
        const normalizedCompany = normalizeCompanyField(lead)
        const updateData: any = {
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          position: lead.position,
          segment_id: lead.segment_id,
          status: newStatus as any,
          origin: lead.origin,
          site_id: currentSite.id
        }

        if (normalizedCompany !== undefined) {
          updateData.company = normalizedCompany
        }

        return updateLead(updateData)
      })
      
      await Promise.all(promises)
      
      mutateLeads((currentData: any) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          leads: currentData.leads.map((lead: Lead) => 
            selectedLeads.has(lead.id) ? { ...lead, status: newStatus as any } : lead
          )
        }
      }, { revalidate: false })
      setSelectedLeads(new Set())
      toast.success(`Status updated for ${selectedLeads.size} leads`)
    } catch (error) {
      console.error("Error in bulk status change:", error)
      toast.error("Failed to update status for some leads")
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  return { selectedLeads, setSelectedLeads, isBulkActionLoading, handleBulkDelete, handleBulkAssign, handleBulkStatusChange }
}
