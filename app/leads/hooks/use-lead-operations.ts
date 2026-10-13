"use client"

import { useState } from "react"
import type { KeyedMutator } from "swr"
import { deleteLead, importLeads, updateLead } from "../actions"
import { toast } from "sonner"
import { safeReload } from "@/app/utils/safe-reload"
import { normalizeCompanyField } from "../list-helpers"
import type { AttributionData, Lead } from "../types"
import type { LeadsData } from "./use-leads-data"

export function useLeadOperations(currentSite: { id: string } | null, dbLeads: Lead[], mutateLeads: KeyedMutator<LeadsData>) {
  const [showAttributionModal, setShowAttributionModal] = useState(false)
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    leadId: string
    leadName: string
    newStatus: string
  } | null>(null)

  const handleUpdateLead = (leadId: string, updates: Partial<Lead> & { invalidated?: boolean }) => {
    mutateLeads((currentData: any) => {
      if (!currentData) return currentData
      
      if (updates.invalidated) {
        return {
          ...currentData,
          leads: currentData.leads.filter((lead: Lead) => lead.id !== leadId)
        }
      }
      
      return {
        ...currentData,
        leads: currentData.leads.map((lead: Lead) => 
          lead.id === leadId 
            ? { ...lead, ...updates }
            : lead
        )
      }
    }, { revalidate: false })
  }

  const handleDeleteLead = async (leadId: string) => {
    try {
      const result = await deleteLead(leadId)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      mutateLeads((currentData: any) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          leads: currentData.leads.filter((lead: Lead) => lead.id !== leadId)
        }
      }, { revalidate: false })
      
      toast.success("Lead deleted successfully")
    } catch (error) {
      console.error("Error deleting lead:", error)
      toast.error("Error deleting lead")
    }
  }

  const handleImportLeads = async (leadsData: Partial<Lead>[]) => {
    if (!currentSite?.id) {
      return { success: false, count: 0, errors: ["No site selected"] };
    }

    try {
      const result = await importLeads(leadsData, currentSite.id);

      if (result.success) {
        if (result.errors && result.errors.length > 0) {
          toast.warning(`Imported ${result.count} leads, but some rows had errors.`);
          console.warn("Import errors:", result.errors);
          setTimeout(() => {
            safeReload(false, "Leads imported with some errors");
          }, 3000);
        } else {
          safeReload(false, "Leads imported successfully");
        }
      }

      return result;
    } catch (error) {
      console.error("Error importing leads:", error);
      return {
        success: false,
        count: 0,
        errors: ["Failed to import leads"],
      };
    }
  };

  const handleExportLeads = async () => {
    if (!currentSite?.id) return;
    try {
      const response = await fetch(
        `/api/leads/export?siteId=${currentSite.id}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exporting leads:", error);
      toast.error("Failed to export leads");
    }
  };

  const handleUpdateLeadStatus = async (leadId: string, newStatus: string) => {
    const lead = dbLeads.find(l => l.id === leadId)
    if (!lead) return
    
    if (newStatus === "converted" || newStatus === "lost") {
      setPendingStatusChange({
        leadId,
        leadName: lead.name,
        newStatus
      })
      setShowAttributionModal(true)
      return
    }

    await updateLeadDirectly(leadId, newStatus, lead)
  }

  const updateLeadDirectly = async (leadId: string, newStatus: string, lead: Lead, attribution?: AttributionData) => {
    try {
      const normalizedCompany = normalizeCompanyField(lead)
      
      const updateData: any = {
        id: leadId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        position: lead.position,
        segment_id: lead.segment_id,
        status: newStatus as any,
        origin: lead.origin,
        site_id: currentSite?.id || "",
        ...(lead.attribution && !attribution && { attribution: lead.attribution })
      }

      // Only include company field if it's not undefined (undefined means we should omit it)
      if (normalizedCompany !== undefined) {
        updateData.company = normalizedCompany
      }

      if (attribution) {
        updateData.attribution = attribution
      }

      const result = await updateLead(updateData)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      mutateLeads((currentData: any) => {
        if (!currentData) return currentData
        return {
          ...currentData,
          leads: currentData.leads.map((l: Lead) => 
            l.id === leadId ? { 
              ...l, 
              status: newStatus as any,
              ...(attribution && { attribution })
            } : l
          )
        }
      }, { revalidate: false })
      
      toast.success("Lead updated successfully")
    } catch (error) {
      console.error("Error updating lead status:", error)
      toast.error("Error updating lead status")
    }
  }

  const handleAttributionConfirm = async (attribution: AttributionData) => {
    if (!pendingStatusChange) return

    const lead = dbLeads.find(l => l.id === pendingStatusChange.leadId)
    if (!lead) return

    await updateLeadDirectly(
      pendingStatusChange.leadId, 
      pendingStatusChange.newStatus, 
      lead,
      attribution
    )

    setPendingStatusChange(null)
    setShowAttributionModal(false)
  }

  const handleAttributionCancel = () => {
    setPendingStatusChange(null)
    setShowAttributionModal(false)
  }

  return {
    showAttributionModal, setShowAttributionModal, pendingStatusChange,
    handleUpdateLead, handleDeleteLead, handleImportLeads, handleExportLeads,
    handleUpdateLeadStatus, handleAttributionConfirm, handleAttributionCancel
  }
}
