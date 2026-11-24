import { isManualIntervention } from '@/lib/chat/manual-intervention'
import type { ConversationListItem } from "@/app/types/chat"
import type { createClient } from '@/lib/supabase/client'
import { readConversationQuery, conversationReadError } from "./conversation-read-error"
import type { ConversationListRow } from "./conversation-list-query"
import { conversationDisplayTitle, resolveParticipantIdentity } from "@/lib/chat/participant-identity"
import { getCommentPostReference, getConversationPostContext, parseSocialCommentContext } from "@/lib/chat/social-comment-context"

type ConversationDataClient = Pick<ReturnType<typeof createClient>, 'from'>

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
  conversationIds: string[], signal?: AbortSignal,
): Promise<Map<string, MessageModerationFlags>> {
  const flags = new Map<string, MessageModerationFlags>()
  if (conversationIds.length === 0) return flags

  const data = await readConversationQuery<Array<{ conversation_id: string; role: string; custom_data?: { status?: string } }>>(supabase
    .from("messages")
    .select("conversation_id, role, custom_data")
    .in("conversation_id", conversationIds)
    .or("custom_data->>status.eq.pending,custom_data->>status.eq.accepted"), signal)
  if (!Array.isArray(data)) throw conversationReadError(null)

  for (const message of data) {
    if (isManualIntervention(message.role, message.custom_data)) continue
    const conversationId = message.conversation_id
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
  agentIds: string[], signal?: AbortSignal,
): Promise<Record<string, string>> {
  if (agentIds.length === 0) return {}

  const data = await readConversationQuery<Array<{ id: string; name: string }>>(supabase
    .from("agents")
    .select("id, name")
    .in("id", agentIds), signal)
  if (!Array.isArray(data)) throw conversationReadError(null)

  return data.reduce((names: Record<string, string>, agent) => {
    names[agent.id] = agent.name
    return names
  }, {})
}

async function loadLeadData(
  supabase: ConversationDataClient,
  conversations: ConversationListRow[], signal?: AbortSignal,
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
  type LeadRow = NonNullable<ConversationListRow['leads']> & { id: string }
  const leads: LeadRow[] = []
  const missing = new Set<string>()
  for (const row of conversations) {
    if (!row.lead_id) continue
    // The page query already embeds the RLS-filtered lead. A null embed is
    // authoritative; only raw realtime rows lack the relation entirely.
    if (row.leads === undefined) missing.add(row.lead_id)
    else if (row.leads) leads.push({ ...row.leads, id: row.lead_id })
  }
  if (missing.size) {
    const fetched = await readConversationQuery<LeadRow[]>(supabase.from('leads')
      .select('id, name, company, assignee_id, status').in('id', [...missing]), signal)
    if (!Array.isArray(fetched)) throw conversationReadError(null)
    leads.push(...fetched)
  }

  const assigneeIds = uniqueIds(leads.map(lead => lead.assignee_id || null))
  if (assigneeIds.length) {
    // Only names visible to this request's RLS client; never look up another
    // person's identity via Auth or an account-independent profile cache.
    const profiles = await readConversationQuery<Array<{ id: string; name: string | null }>>(
      supabase.from('profiles').select('id, name').in('id', assigneeIds), signal,
    )
    if (!Array.isArray(profiles)) throw conversationReadError(null)
    for (const id of assigneeIds) result.assigneeNames[id] = 'Team Member'
    for (const profile of profiles) {
      if (profile.name?.trim()) result.assigneeNames[profile.id] = profile.name.trim()
    }
  }

  for (const lead of leads) {
    const companyName =
      lead.company && typeof lead.company === "object" && lead.company.name
        ? lead.company.name
        : typeof lead.company === "string"
          ? lead.company
          : ""

    const name = typeof lead.name === "string" ? lead.name.trim() : ""
    result.names[lead.id] = name ? name + (companyName ? ` (${companyName})` : "") : ""
    if (lead.status) result.statuses[lead.id] = lead.status
    if (lead.assignee_id) result.assigneeIds[lead.id] = lead.assignee_id
  }

  return result
}

export async function buildConversationListItems(
  supabase: ConversationDataClient,
  conversations: ConversationListRow[], signal?: AbortSignal,
): Promise<ConversationListItem[]> {
  if (conversations.length === 0) return []

  const conversationIds = uniqueIds(conversations.map((conversation) => conversation.id))
  const agentIds = uniqueIds(conversations.map((conversation) => conversation.agent_id))

  const [agentNames, leadData, moderationFlags] = await Promise.all([
    loadAgentNames(supabase, agentIds, signal),
    loadLeadData(supabase, conversations, signal),
    loadMessageModerationFlags(supabase, conversationIds, signal),
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

    let title = conversationDisplayTitle(conversation, leadName)
    const participant = resolveParticipantIdentity(conversation, { name: leadName })
    const comment = parseSocialCommentContext(conversation.custom_data)
    const canonicalPost = getConversationPostContext(conversation.custom_data, [])
    const commentParticipant = comment
      ? leadName || (canonicalPost ? comment.authorName : undefined) || participant.name
      : undefined
    const subtitle = comment
      ? canonicalPost ? getCommentPostReference(canonicalPost) : "Comments · post context in messages"
      : undefined
    if (comment && (!conversation.title || /^(?:untitled conversation|conversation|visitor|chat with visitor|(?:social|instagram|facebook|threads|linkedin|x|youtube) comments?|comment thread)$/i.test(conversation.title))) {
      title = commentParticipant || "Social contact"
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
      subtitle,
      agentId,
      agentName,
      leadName: leadName || undefined,
      participantName: commentParticipant || (participant.channel !== "web" ? participant.name : undefined),
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
      automationPausedUntil: conversation.automation_paused_until,
      lastHumanReplyAt: conversation.last_human_reply_at,
      automationSnoozeHours: conversation.automation_snooze_hours,
    }
  })
}
