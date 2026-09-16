import type { ConversationListItem } from "@/app/types/chat"
import { getUserData } from "@/app/services/user-service"
import type { ConversationListRow } from "./conversation-list-query"

interface ConversationDataClient {
  from: (table: string) => any
}

interface MessageModerationFlags {
  accepted: boolean
  pending: boolean
}

function uniqueIds(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function normalizeConversationStatus(
  status: string | null,
  hasPendingMessage: boolean
): ConversationListItem["status"] {
  if (hasPendingMessage) return "pending"
  if (
    status === "pending" ||
    status === "active" ||
    status === "closed" ||
    status === "archived"
  ) {
    return status
  }
  return "active"
}

async function loadMessageModerationFlags(
  supabase: ConversationDataClient,
  conversationIds: string[]
): Promise<Map<string, MessageModerationFlags>> {
  const flags = new Map<string, MessageModerationFlags>()
  if (conversationIds.length === 0) return flags

  const { data, error } = await supabase
    .from("messages")
    .select("conversation_id, custom_data")
    .in("conversation_id", conversationIds)
    .or("custom_data->>status.eq.pending,custom_data->>status.eq.accepted")

  if (error) {
    console.error("Error fetching conversation moderation flags:", error)
    throw error
  }

  for (const message of data || []) {
    const conversationId = message.conversation_id as string
    const status = message.custom_data?.status
    const current = flags.get(conversationId) || {
      accepted: false,
      pending: false,
    }

    if (status === "accepted") current.accepted = true
    if (status === "pending" || status === "accepted") current.pending = true
    flags.set(conversationId, current)
  }

  return flags
}

async function loadAgentNames(
  supabase: ConversationDataClient,
  agentIds: string[]
): Promise<Record<string, string>> {
  if (agentIds.length === 0) return {}

  const { data, error } = await supabase
    .from("agents")
    .select("id, name")
    .in("id", agentIds)

  if (error) {
    console.error("Error fetching conversation agents:", error)
    throw error
  }

  return (data || []).reduce((names: Record<string, string>, agent: any) => {
    names[agent.id] = agent.name
    return names
  }, {})
}

async function loadLeadData(
  supabase: ConversationDataClient,
  leadIds: string[]
): Promise<{
  names: Record<string, string>
  statuses: Record<string, string>
  assigneeIds: Record<string, string>
  assigneeNames: Record<string, string>
}> {
  const result = {
    names: {} as Record<string, string>,
    statuses: {} as Record<string, string>,
    assigneeIds: {} as Record<string, string>,
    assigneeNames: {} as Record<string, string>,
  }
  if (leadIds.length === 0) return result

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, company, assignee_id, status")
    .in("id", leadIds)

  if (error) {
    console.error("Error fetching conversation leads:", error)
    throw error
  }

  const assigneeIds = uniqueIds(
    (leads || []).map((lead: any) => lead.assignee_id || null)
  )
  const assignees = await Promise.all(
    assigneeIds.map(async (id) => {
      const user = await getUserData(id)
      return {
        id,
        name: user?.name || `User ${id.substring(0, 8)}`,
      }
    })
  )

  for (const assignee of assignees) {
    result.assigneeNames[assignee.id] = assignee.name
  }

  for (const lead of leads || []) {
    const companyName =
      lead.company && typeof lead.company === "object" && lead.company.name
        ? lead.company.name
        : typeof lead.company === "string"
          ? lead.company
          : ""

    result.names[lead.id] =
      lead.name + (companyName ? ` (${companyName})` : "")
    if (lead.status) result.statuses[lead.id] = lead.status
    if (lead.assignee_id) result.assigneeIds[lead.id] = lead.assignee_id
  }

  return result
}

export async function buildConversationListItems(
  supabase: ConversationDataClient,
  conversations: ConversationListRow[]
): Promise<ConversationListItem[]> {
  if (conversations.length === 0) return []

  const conversationIds = uniqueIds(conversations.map((conversation) => conversation.id))
  const agentIds = uniqueIds(conversations.map((conversation) => conversation.agent_id))
  const leadIds = uniqueIds(conversations.map((conversation) => conversation.lead_id))

  const [agentNames, leadData, moderationFlags] = await Promise.all([
    loadAgentNames(supabase, agentIds),
    loadLeadData(supabase, leadIds),
    loadMessageModerationFlags(supabase, conversationIds),
  ])

  return conversations.map((conversation) => {
    const leadId = conversation.lead_id || ""
    const leadName = leadId ? leadData.names[leadId] : ""
    const assigneeId = leadId ? leadData.assigneeIds[leadId] : undefined
    const agentId = conversation.agent_id || ""
    const flags = moderationFlags.get(conversation.id) || {
      accepted: false,
      pending: false,
    }

    let title = conversation.title || "Untitled Conversation"
    if (leadName && (!conversation.title || conversation.title === "Untitled Conversation")) {
      title = `Chat with ${leadName}`
    }

    let agentName =
      agentNames[agentId] || (agentId ? "Unknown Agent" : "Agent")
    if (assigneeId && leadData.assigneeNames[assigneeId]) {
      agentName = leadData.assigneeNames[assigneeId]
    }

    const customData = conversation.custom_data || {}
    let channel = conversation.channel || String(customData.channel || "web")
    if (channel === "website_chat") channel = "web"

    return {
      id: conversation.id,
      title,
      agentId,
      agentName,
      leadName: leadName || undefined,
      leadStatus: leadId ? leadData.statuses[leadId] : undefined,
      lastMessage: conversation.latest_message?.[0]?.content,
      timestamp: new Date(
        conversation.last_message_at ||
          conversation.created_at ||
          new Date().toISOString()
      ),
      channel,
      status: normalizeConversationStatus(conversation.status, flags.pending),
      hasAcceptedMessage: flags.accepted,
    }
  })
}
