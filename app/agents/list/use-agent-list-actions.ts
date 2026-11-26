import { openDetailFromView } from "@/lib/navigation/detail-view-navigation"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { createClient } from "@/lib/supabase/client"
import { useActivityExecution } from "@/app/hooks/use-activity-execution"
import type { Agent, AgentActivity } from "@/app/types/agents"
import { agentDetailHref, type ListedAgent } from "./agent-list-model"
import { templateShortcut } from "./template-workflows"

export function useAgentListActions(siteId?: string, userId?: string, url?: string | null) {
  const router = useRouter()
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<AgentActivity | null>(null)
  const [expanded, setExpanded] = useState<string[]>([])
  const { activityStates, setActivityState } = useActivityExecution()

  async function chat(agent: ListedAgent) {
    if (!agent.dbData) return
    if (!siteId || !userId) { toast.error("Cannot create conversation: Missing site or user information"); return }
    const now = new Date().toISOString()
    try {
      const { data, error } = await createClient().from("conversations").insert({
        site_id: siteId, user_id: userId, agent_id: agent.dbData.id, title: `Chat with ${agent.name}`,
        status: "active", is_archived: false, created_at: now, updated_at: now, last_message_at: now,
      }).select("id").single()
      if (error || !data?.id) throw new Error("Conversation not created")
      router.push(`/chat?conversationId=${data.id}&agentId=${agent.dbData.id}&agentName=${encodeURIComponent(agent.name)}`)
    } catch {
      toast.error("Failed to create conversation. Please try again.")
    }
  }

  async function execute(agent: ListedAgent, activity: AgentActivity) {
    setSelectedAgent(agent)
    setSelectedActivity(activity)
    const shortcut = agent.templateId && templateShortcut(activity)
    if (!shortcut) return
    try {
      if (!siteId || !userId) throw new Error("Cannot execute activity: Missing site or user information")
      if (shortcut.requiresUrl && !url) throw new Error("The selected site doesn't have a URL. Please add a URL to your site in the settings.")
      setActivityState(activity.id, "loading", shortcut.loading)
      const { result, href } = await shortcut.run({ siteId, userId, url })
      if (!result.success) {
        const detail = result.error
        throw new Error(typeof detail === "string" ? detail : (typeof detail === "object" && detail && "message" in detail)
          ? String(detail.message) : `Failed to execute ${activity.name}`)
      }
      setActivityState(activity.id, "success", shortcut.success)
      toast.success(shortcut.success)
      if (href) router.push(href)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Activity execution failed"
      setActivityState(activity.id, "error", message)
      toast.error(message)
    }
  }

  return {
    selection: { selectedAgent, setSelectedAgent, selectedActivity, setSelectedActivity },
    card: {
      onManage: (agent: ListedAgent, order: ListedAgent[] = []) => router.push(openDetailFromView(siteId, agentDetailHref(agent), order.filter(item => item.dbData).map(agentDetailHref))), onChat: chat, onExecuteActivity: execute,
      onToggleActivities: (agent: ListedAgent) => setExpanded(ids => ids.includes(agent.id) ? ids.filter(id => id !== agent.id) : [...ids, agent.id]),
      setSelectedAgent, activityStates,
    },
    isExpanded: (agent: ListedAgent) => expanded.includes(agent.id),
  }
}

export type AgentListViewProps = Pick<ReturnType<typeof useAgentListActions>, "card" | "isExpanded"> & {
  agents: ListedAgent[]; isLoading: boolean; query: string
}