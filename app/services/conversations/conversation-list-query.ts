export interface ConversationListRow {
  id: string
  title: string | null
  agent_id: string | null
  lead_id: string | null
  last_message_at: string | null
  created_at: string
  custom_data: Record<string, unknown> | null
  channel: string | null
  status: string | null
  latest_message?: Array<{
    content: string
    created_at: string
  }>
  first_message?: Array<{
    role: string
    created_at: string
  }>
  visitor_messages?: Array<{
    role: string
  }>
  leads?: {
    assignee_id: string | null
    status: string | null
  } | null
}

interface EmbeddedMessageQuery {
  order: (
    column: string,
    options: {
      ascending: boolean
      referencedTable: string
    }
  ) => EmbeddedMessageQuery
  limit: (
    rows: number,
    options: {
      referencedTable: string
    }
  ) => EmbeddedMessageQuery
  or: (
    filters: string,
    options: {
      referencedTable: string
    }
  ) => EmbeddedMessageQuery
}

interface ConversationSelectOptions {
  includeInitiationData: boolean
  useInnerLead: boolean
}

export function buildConversationListSelect({
  includeInitiationData,
  useInnerLead,
}: ConversationSelectOptions): string {
  const initiationRelations = includeInitiationData
    ? `,
      first_message:messages (
        role,
        created_at
      ),
      visitor_messages:messages (
        role
      )`
    : ""

  return `
    id,
    title,
    agent_id,
    lead_id,
    last_message_at,
    created_at,
    custom_data,
    channel,
    status,
    latest_message:messages (
      content,
      created_at
    )
    ${initiationRelations},
    leads${useInnerLead ? "!inner" : ""} (
      assignee_id,
      status
    )
  `
}

/**
 * PostgREST otherwise embeds every message for every conversation. The list
 * only needs the newest message plus small initiation markers for its filters.
 */
export function limitEmbeddedConversationMessages<T extends EmbeddedMessageQuery>(
  query: T,
  includeInitiationData: boolean
): T {
  let scopedQuery = query
    .order("created_at", {
      ascending: false,
      referencedTable: "latest_message",
    })
    .order("id", {
      ascending: false,
      referencedTable: "latest_message",
    })
    .limit(1, { referencedTable: "latest_message" })

  if (includeInitiationData) {
    scopedQuery = scopedQuery
      .order("created_at", {
        ascending: true,
        referencedTable: "first_message",
      })
      .order("id", {
        ascending: true,
        referencedTable: "first_message",
      })
      .limit(1, { referencedTable: "first_message" })
      .or("role.eq.visitor,role.eq.user", {
        referencedTable: "visitor_messages",
      })
      .limit(1, { referencedTable: "visitor_messages" })
  }

  return scopedQuery as T
}
