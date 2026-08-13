"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Lead } from "@/app/leads/types"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { createClient } from "@/utils/supabase/client"
import { createConversation } from "@/app/services/chat-service"
import { LeadDetailActionKind } from "./LeadActionsMenu"

const WORKFLOWS: Record<
  "research" | "followup" | "invalidation",
  { path: string; success: string; failure: string }
> = {
  research: {
    path: "/api/workflow/leadResearch",
    success: "Lead research initiated successfully",
    failure: "Failed to initiate lead research",
  },
  followup: {
    path: "/api/workflow/leadFollowUp",
    success: "Lead follow-up initiated successfully",
    failure: "Failed to initiate lead follow-up",
  },
  invalidation: {
    path: "/api/workflow/leadInvalidation",
    success: "Lead invalidation initiated successfully",
    failure: "Failed to initiate lead invalidation",
  },
}

export function useLeadDetailActions(lead: Lead) {
  const { currentSite } = useSite()
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState<LeadDetailActionKind | null>(null)

  const runWorkflow = async (kind: "research" | "followup" | "invalidation") => {
    setLoading(kind)
    try {
      const { apiClient } = await import("@/app/services/api-client-service")
      const workflow = WORKFLOWS[kind]
      const response = await apiClient.post(workflow.path, {
        lead_id: lead.id,
        user_id: currentSite?.user_id,
        site_id: currentSite?.id,
      })
      if (!response.success) throw new Error(response.error?.message || workflow.failure)
      toast.success(workflow.success)
    } catch (error) {
      console.error(`Error calling ${kind}:`, error)
      toast.error(WORKFLOWS[kind].failure)
    } finally {
      setLoading(null)
    }
  }

  const handleNewConversation = async () => {
    if (!currentSite?.id || !user?.id) {
      toast.error("No site selected or user not authenticated")
      return
    }

    setLoading("newConversation")
    try {
      const supabase = createClient()
      const { data: agent, error: agentError } = await supabase
        .from("agents")
        .select("id, name")
        .eq("site_id", currentSite.id)
        .eq("role", "Customer Support")
        .single()

      const supportAgent = agent as { id: string; name: string } | null
      if (agentError || !supportAgent) {
        toast.error("Customer Support agent not found for this site")
        return
      }

      const conversation = await createConversation(
        currentSite.id,
        user.id,
        supportAgent.id,
        `Chat with ${lead.name}`,
        { lead_id: lead.id, channel: "web" }
      )

      if (!conversation) {
        toast.error("Failed to create conversation")
        return
      }

      toast.success("Conversation created successfully")
      router.push(
        `/chat?conversationId=${conversation.id}&agentId=${supportAgent.id}&agentName=${encodeURIComponent(supportAgent.name)}`
      )
    } catch (error) {
      console.error("Error creating conversation:", error)
      toast.error("Failed to create conversation")
    } finally {
      setLoading(null)
    }
  }

  return {
    loading,
    handleLeadResearch: () => runWorkflow("research"),
    handleLeadFollowUp: () => runWorkflow("followup"),
    handleLeadInvalidation: () => runWorkflow("invalidation"),
    handleNewConversation,
  }
}
