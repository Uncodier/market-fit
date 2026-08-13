"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Lead } from "@/app/leads/types"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { assignLeadToUser, updateLead } from "@/app/leads/actions"
import { createClient } from "@/utils/supabase/client"
import { createConversation } from "@/app/services/chat-service"

export type LeadActionKind = "research" | "followup" | "invalidation" | "newConversation"

type CompanyGroup = { leads: Lead[] }

const WORKFLOWS: Record<"research" | "followup" | "invalidation", { path: string; success: string; failure: string }> = {
  research: {
    path: "/api/workflow/leadResearch",
    success: "Lead research initiated",
    failure: "Failed to initiate research",
  },
  followup: {
    path: "/api/workflow/leadFollowUp",
    success: "Lead follow-up initiated",
    failure: "Failed to initiate follow-up",
  },
  invalidation: {
    path: "/api/workflow/leadInvalidation",
    success: "Lead invalidation initiated",
    failure: "Failed to initiate invalidation",
  },
}

export function useLeadTableActions({
  companyGroups,
  invalidateJourneyStageCache,
  onUpdateLead,
  onDeleteLead,
}: {
  companyGroups: CompanyGroup[]
  invalidateJourneyStageCache: (leadId: string) => void
  onUpdateLead?: (leadId: string, updates: Partial<Lead> & { invalidated?: boolean }) => void
  onDeleteLead?: (leadId: string) => Promise<void>
}) {
  const { currentSite } = useSite()
  const { user } = useAuth()
  const router = useRouter()
  const [loadingActions, setLoadingActions] = useState<Record<string, LeadActionKind | null>>({})
  const [successActions, setSuccessActions] = useState<Record<string, LeadActionKind | null>>({})
  const [assigningLeads, setAssigningLeads] = useState<Record<string, boolean>>({})
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null)
  const [isDeletingLead, setIsDeletingLead] = useState(false)

  const findLead = (leadId: string) =>
    companyGroups.flatMap((group) => group.leads).find((lead) => lead.id === leadId)

  const markSuccess = (leadId: string, kind: LeadActionKind) => {
    setSuccessActions((prev) => ({ ...prev, [leadId]: kind }))
    setTimeout(() => setSuccessActions((prev) => ({ ...prev, [leadId]: null })), 2000)
    setTimeout(() => invalidateJourneyStageCache(leadId), 1000)
    setTimeout(() => invalidateJourneyStageCache(leadId), 5000)
  }

  const runWorkflow = async (
    kind: "research" | "followup" | "invalidation",
    leadId: string,
    isBulk = false,
    allLeads?: Lead[]
  ) => {
    const leadsToProcess = isBulk && allLeads ? allLeads : [{ id: leadId } as Lead]
    leadsToProcess.forEach((lead) => setLoadingActions((prev) => ({ ...prev, [lead.id]: kind })))

    try {
      const { apiClient } = await import("@/app/services/api-client-service")
      const workflow = WORKFLOWS[kind]
      const results = await Promise.all(
        leadsToProcess.map(async (lead) => {
          try {
            const response = await apiClient.post(workflow.path, {
              lead_id: lead.id,
              user_id: currentSite?.user_id,
              site_id: currentSite?.id,
            })
            if (!response.success) throw new Error(response.error?.message || workflow.failure)
            markSuccess(lead.id, kind)
            if (kind === "invalidation") {
              setTimeout(() => onUpdateLead?.(lead.id, { invalidated: true }), 2500)
            }
            return { success: true }
          } catch (error) {
            console.error(`Error calling ${kind} for lead ${lead.id}:`, error)
            return { success: false }
          }
        })
      )

      const successCount = results.filter((result) => result.success).length
      const failedCount = results.length - successCount
      if (successCount > 0) toast.success(`${workflow.success} for ${successCount} lead${successCount > 1 ? "s" : ""}`)
      if (failedCount > 0) toast.error(`${workflow.failure} for ${failedCount} lead${failedCount > 1 ? "s" : ""}`)
    } catch (error) {
      console.error(`Error calling ${kind}:`, error)
      toast.error(WORKFLOWS[kind].failure)
    } finally {
      leadsToProcess.forEach((lead) => setLoadingActions((prev) => ({ ...prev, [lead.id]: null })))
    }
  }

  const handleNewConversation = async (leadId: string) => {
    if (!currentSite?.id || !user?.id) {
      toast.error("No site selected or user not authenticated")
      return
    }

    setLoadingActions((prev) => ({ ...prev, [leadId]: "newConversation" }))
    try {
      const supabase = createClient()
      const { data: agent, error: agentError } = await supabase
        .from("agents")
        .select("id, name")
        .eq("site_id", currentSite.id)
        .eq("role", "Customer Support")
        .single()

      if (agentError || !agent) {
        toast.error("Customer Support agent not found for this site")
        return
      }

      const lead = findLead(leadId)
      if (!lead) {
        toast.error("Lead not found")
        return
      }

      const conversation = await createConversation(
        currentSite.id,
        user.id,
        agent.id,
        `Chat with ${lead.name}`,
        { lead_id: lead.id, channel: "web" }
      )

      if (!conversation) {
        toast.error("Failed to create conversation")
        return
      }

      markSuccess(leadId, "newConversation")
      toast.success("Conversation created successfully")
      router.push(`/chat?conversationId=${conversation.id}&agentId=${agent.id}&agentName=${encodeURIComponent(agent.name)}`)
    } catch (error) {
      console.error("Error creating conversation:", error)
      toast.error("Failed to create conversation")
    } finally {
      setLoadingActions((prev) => ({ ...prev, [leadId]: null }))
    }
  }

  const handleToggleAssignee = async (leadId: string) => {
    if (!user?.id || !currentSite?.id) {
      toast.error("User not authenticated or site not selected")
      return
    }

    const lead = findLead(leadId)
    if (!lead) return

    setAssigningLeads((prev) => ({ ...prev, [leadId]: true }))
    try {
      const newAssigneeId = lead.assignee_id === user.id ? null : user.id
      if (newAssigneeId === null) {
        const result = await updateLead({
          id: leadId,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          position: lead.position,
          segment_id: lead.segment_id,
          status: lead.status,
          origin: lead.origin,
          site_id: currentSite.id,
          assignee_id: null,
        })
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Lead assigned to AI Team")
      } else {
        const result = await assignLeadToUser(leadId, user.id, currentSite.id)
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Lead assigned to you")
      }
      onUpdateLead?.(leadId, { assignee_id: newAssigneeId })
      invalidateJourneyStageCache(leadId)
    } catch (error) {
      console.error("Error toggling assignee:", error)
      toast.error("Failed to update assignee")
    } finally {
      setAssigningLeads((prev) => ({ ...prev, [leadId]: false }))
    }
  }

  const confirmDeleteLead = async () => {
    if (!leadToDelete || !onDeleteLead) return
    setIsDeletingLead(true)
    try {
      await onDeleteLead(leadToDelete.id)
      setShowDeleteDialog(false)
      setLeadToDelete(null)
      toast.success("Lead deleted successfully")
    } catch (error) {
      console.error("Error deleting lead:", error)
      toast.error("Error deleting lead")
    } finally {
      setIsDeletingLead(false)
    }
  }

  return {
    user,
    loadingActions,
    successActions,
    assigningLeads,
    showDeleteDialog,
    setShowDeleteDialog,
    leadToDelete,
    isDeletingLead,
    handleLeadResearch: (leadId: string, isBulk = false, allLeads?: Lead[]) =>
      runWorkflow("research", leadId, isBulk, allLeads),
    handleLeadFollowUp: (leadId: string, isBulk = false, allLeads?: Lead[]) =>
      runWorkflow("followup", leadId, isBulk, allLeads),
    handleLeadInvalidation: (leadId: string, isBulk = false, allLeads?: Lead[]) =>
      runWorkflow("invalidation", leadId, isBulk, allLeads),
    handleNewConversation,
    handleToggleAssignee,
    handleDeleteLead: (lead: Lead) => {
      setLeadToDelete(lead)
      setShowDeleteDialog(true)
    },
    confirmDeleteLead,
  }
}
