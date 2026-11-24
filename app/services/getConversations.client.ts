import { createClient } from '@/lib/supabase/client'
import type { ConversationListItem } from '@/app/types/chat'
import { buildConversationListItems } from './conversations/conversation-list-items'
import { buildConversationListSelect, limitEmbeddedConversationMessages, type ConversationListRow } from './conversations/conversation-list-query'
import { conversationReadError, prepareConversationQuery, readConversationQuery } from './conversations/conversation-read-error'

export type ConversationFilter = 'all' | 'outbound' | 'inbound' | 'replied' | 'tasks' | 'assigned' | 'qualified'
interface PageOptions {
  siteId: string
  page?: number
  pageSize?: number
  channelFilter?: 'all' | 'web' | 'email' | 'whatsapp'
  assigneeFilter?: 'all' | 'assigned' | 'ai'
  currentUserId?: string
  searchQuery?: string
  initiatedByFilter?: 'all' | 'visitor' | 'agent' | 'replied'
  tasksOnly?: boolean
  qualifiedLeadsOnly?: boolean
  signal?: AbortSignal
}

export interface ConversationPage {
  items: ConversationListItem[]
  page: number
  hasMore: boolean
}

const BATCH_SIZE = 1000 // Existing initiation-filter candidate window per status group.
const VISITOR_ROLES = new Set(['visitor', 'user'])
const AGENT_ROLES = new Set(['agent', 'assistant', 'system', 'team_member'])
const WEB_PREDICATE = 'channel.eq.web,channel.eq.website_chat,channel.is.null,custom_data->>channel.eq.web,custom_data->>channel.eq.website_chat,custom_data->>channel.is.null,custom_data.is.null'

function matchesInitiation(row: ConversationListRow, filter: PageOptions['initiatedByFilter']) {
  const role = row.first_message?.[0]?.role
  if (!role) return false
  if (filter === 'visitor') return VISITOR_ROLES.has(role)
  return AGENT_ROLES.has(role) && (filter !== 'replied' || Boolean(row.visitor_messages?.length))
}

/** Pending rows sort first. A lookahead uses the normal 20-row stride, never a 21-row offset. */
export async function getConversationPage({
  siteId, page = 1, pageSize = 20, channelFilter = 'all', assigneeFilter = 'all', currentUserId,
  searchQuery, initiatedByFilter = 'all', tasksOnly, qualifiedLeadsOnly, signal,
}: PageOptions): Promise<ConversationPage> {
  const controller = new AbortController()
  const cancel = () => controller.abort()
  if (signal?.aborted) cancel()
  signal?.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(cancel, 12_000)
  try {
    const client = createClient()
    const readSignal = controller.signal
    const start = (page - 1) * pageSize
    const count = pageSize + 1
    const end = start + count
    const needsInitiation = !tasksOnly && initiatedByFilter !== 'all'
    const assigned = assigneeFilter === 'assigned' && Boolean(currentUserId)
    const select = buildConversationListSelect({ includeInitiationData: needsInitiation, useInnerLead: assigned || !!qualifiedLeadsOnly })

    function scopedQuery(head = false) {
      const countSelect = assigned || qualifiedLeadsOnly ? 'id, leads!inner(id)' : 'id'
      let query = client.from('conversations').select(head ? countSelect : select, head ? { head: true, count: 'exact' } : {})
        .eq('site_id', siteId).eq('is_archived', false)
      if (assigned) query = query.eq('leads.assignee_id', currentUserId)
      if (qualifiedLeadsOnly) query = query.in('leads.status', ['qualified', 'converted'])
      if (searchQuery?.trim()) query = query.ilike('title', `%${searchQuery.trim().toLowerCase()}%`)
      if (channelFilter === 'web') {
        query = query.or(WEB_PREDICATE)
      } else if (channelFilter !== 'all') {
        query = query.or(`channel.eq.${channelFilter},custom_data->>channel.eq.${channelFilter}`)
      }
      return query
    }

    function baseQuery() {
      return limitEmbeddedConversationMessages(scopedQuery(), needsInitiation)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }).order('id', { ascending: false })
    }

    async function readGroup(pending: boolean, offset: number, length: number) {
      const query = baseQuery()
      const grouped = pending ? query.eq('status', 'pending') : query.neq('status', 'pending')
      const data = await readConversationQuery<ConversationListRow[]>(grouped.range(offset, offset + length - 1), readSignal)
      if (!Array.isArray(data)) throw conversationReadError(null)
      return data
    }

    let candidates: ConversationListRow[]
    if (tasksOnly) {
      const taskRows = await readConversationQuery<{ conversation_id: string }[]>(client.from('tasks')
        .select('conversation_id').eq('status', 'pending').eq('site_id', siteId)
        .not('conversation_id', 'is', null).limit(3000), readSignal)
      if (!Array.isArray(taskRows)) throw conversationReadError(null)
      const ids = [...new Set(taskRows.map(row => row.conversation_id))]
      if (!ids.length) return { items: [], page, hasMore: false }
      const rows = await readConversationQuery<ConversationListRow[]>(baseQuery().in('id', ids), readSignal)
      if (!Array.isArray(rows)) throw conversationReadError(null)
      // Task view uses updated-or-created chronology, not the pending-status grouping.
      const timestamp = (row: ConversationListRow) => new Date(row.last_message_at || row.created_at).getTime()
      candidates = rows.sort((a, b) => timestamp(b) - timestamp(a)).slice(start, end)
    } else if (needsInitiation) {
      const pending = await readGroup(true, 0, Math.min(page * pageSize * 50, BATCH_SIZE))
      const matching = pending.filter(row => matchesInitiation(row, initiatedByFilter))
      const batches = initiatedByFilter === 'replied' ? 5 : 1
      for (let batch = 0; batch < batches && matching.length < end; batch++) {
        const rows = await readGroup(false, batch * BATCH_SIZE, BATCH_SIZE)
        matching.push(...rows.filter(row => matchesInitiation(row, initiatedByFilter)))
        if (rows.length < BATCH_SIZE) break
      }
      candidates = matching.slice(start, end)
    } else {
      // No exact-count scan on page one. Later pages still need the real offset
      // within the non-pending group; local moderation/realtime is not a count.
      let pendingLimit = count
      let otherOffset = 0
      if (start > 0) {
        const result = await prepareConversationQuery(scopedQuery(true).eq('status', 'pending'), readSignal)
        const total = result.count
        if (result.error || typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0) {
          throw conversationReadError(result.error, result.status)
        }
        otherOffset = Math.max(0, start - total)
        pendingLimit = Math.min(count, Math.max(0, total - start))
      }
      candidates = pendingLimit ? await readGroup(true, start, pendingLimit) : []
      if (candidates.length < count) candidates.push(...await readGroup(false, otherOffset, count - candidates.length))
    }
    // The Assigned filter is already in PostgREST. Preserve the legacy AI-only projection.
    if (assigneeFilter === 'ai' && currentUserId) candidates = candidates.filter(row => !row.leads?.assignee_id)
    const items = await buildConversationListItems(client, candidates.slice(0, pageSize), readSignal)
    if (readSignal.aborted) throw conversationReadError(null, 408)
    return { items, page, hasMore: candidates.length > pageSize }
  } catch (error) {
    cancel() // Stop sibling enrichment transport on failure.
    throw conversationReadError(error)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
}

// Keep the existing array-returning service contract for consumers that don't paginate.
export async function getConversations(
  siteId: string, page = 1, pageSize = 20, channelFilter?: PageOptions['channelFilter'],
  assigneeFilter?: PageOptions['assigneeFilter'], currentUserId?: string, searchQuery?: string,
  initiatedByFilter?: PageOptions['initiatedByFilter'], tasksOnly?: boolean, qualifiedLeadsOnly?: boolean,
) {
  return (await getConversationPage({ siteId, page, pageSize, channelFilter, assigneeFilter, currentUserId,
    searchQuery, initiatedByFilter, tasksOnly, qualifiedLeadsOnly })).items
}