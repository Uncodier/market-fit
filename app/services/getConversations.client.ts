import { createClient } from "@/lib/supabase/client"
import { ConversationListItem } from "@/app/types/chat"
import {
  buildConversationListSelect,
  ConversationListRow,
  limitEmbeddedConversationMessages,
} from "@/app/services/conversations/conversation-list-query"
import { buildConversationListItems } from "@/app/services/conversations/conversation-list-items"

/**
 * Client-safe version of getConversations used by ChatList
 */
export async function getConversations(
  siteId: string,
  page: number = 1,
  pageSize: number = 20,
  channelFilter?: 'all' | 'web' | 'email' | 'whatsapp',
  assigneeFilter?: 'all' | 'assigned' | 'ai',
  currentUserId?: string,
  searchQuery?: string,
  initiatedByFilter?: 'all' | 'visitor' | 'agent' | 'replied',
  tasksOnly?: boolean,
  qualifiedLeadsOnly?: boolean
): Promise<ConversationListItem[]> {
  try {
    const supabase = createClient();

    // Initiation filters inspect compact first-message/reply embeds and then
    // paginate in memory across a larger candidate set.
    const needsPostFiltering = Boolean(
      initiatedByFilter && initiatedByFilter !== 'all'
    )
    const fetchMultiplier = needsPostFiltering ? 50 : 1 // Fetch 50x more for inbound/outbound

    // TASKS-ONLY: Two-step approach to search full history without row duplication
    if (tasksOnly) {
      const { data: taskRows, error: taskRowsError } = await supabase
        .from('tasks')
        .select('conversation_id')
        .eq('status', 'pending')
        .eq('site_id', siteId)
        .not('conversation_id', 'is', null)
        .limit(3000)
      if (taskRowsError) {
        console.error('Error fetching conversations with tasks:', taskRowsError)
        throw taskRowsError
      }

      const convIds = Array.from(new Set((taskRows || []).map((t: any) => t.conversation_id).filter(Boolean)))
      if (convIds.length === 0) return []

      const needsAssign = assigneeFilter === 'assigned' && currentUserId
      const needsQual = qualifiedLeadsOnly === true
      const tasksBaseSelect = buildConversationListSelect({
        includeInitiationData: false,
        useInnerLead: Boolean(needsAssign || needsQual),
      })

      let tasksQuery = limitEmbeddedConversationMessages(
        supabase
          .from('conversations')
          .select(tasksBaseSelect)
          .eq('site_id', siteId)
          .eq('is_archived', false)
          .in('id', convIds),
        false
      )
      if (needsAssign) {
        tasksQuery = tasksQuery.eq('leads.assignee_id', currentUserId)
      }
      if (needsQual) {
        tasksQuery = tasksQuery.in('leads.status', ['qualified', 'converted'])
      }
      if (searchQuery?.trim()) {
        tasksQuery = tasksQuery.ilike('title', `%${searchQuery.trim().toLowerCase()}%`)
      }

      const { data: allConvs, error } = await tasksQuery
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) {
        console.error('Error fetching conversations with tasks:', error)
        throw error
      }
      const sorted = (allConvs || []).sort((a: any, b: any) => {
        const dA = new Date(a.last_message_at || a.created_at || 0).getTime()
        const dB = new Date(b.last_message_at || b.created_at || 0).getTime()
        return dB - dA
      })
      const pageConvs = sorted.slice((page - 1) * pageSize, page * pageSize)
      return buildConversationListItems(supabase, pageConvs as ConversationListRow[])
    }

    // Build base query parts - add leads!inner for assigned/qualified filters (DB-level, full history)
    const needsAssigneeFilter = assigneeFilter === 'assigned' && currentUserId
    const needsQualifiedFilter = qualifiedLeadsOnly === true
    const QUALIFIED_STATUSES = ['qualified', 'converted']

    const baseSelect = buildConversationListSelect({
      includeInitiationData: Boolean(needsPostFiltering),
      useInnerLead: Boolean(needsAssigneeFilter || needsQualifiedFilter),
    })

    // Query 1: Get pending conversations (by status)
    let pendingQuery = limitEmbeddedConversationMessages(
      supabase
        .from("conversations")
        .select(baseSelect)
        .eq("site_id", siteId)
        .eq("is_archived", false)
        .eq("status", "pending"),
      needsPostFiltering
    )

    // Query 2: Get non-pending conversations
    let nonPendingQuery = limitEmbeddedConversationMessages(
      supabase
        .from("conversations")
        .select(baseSelect)
        .eq("site_id", siteId)
        .eq("is_archived", false)
        .neq("status", "pending"),
      needsPostFiltering
    )

    // DB-level filter: assigned (search full history, paginate 20)
    if (needsAssigneeFilter) {
      pendingQuery = pendingQuery.eq("leads.assignee_id", currentUserId!)
      nonPendingQuery = nonPendingQuery.eq("leads.assignee_id", currentUserId!)
    }
    // DB-level filter: qualified and above (qualified, converted)
    if (needsQualifiedFilter) {
      pendingQuery = pendingQuery.in("leads.status", QUALIFIED_STATUSES)
      nonPendingQuery = nonPendingQuery.in("leads.status", QUALIFIED_STATUSES)
    }

    // Apply channel filter to both queries if specified
    if (channelFilter && channelFilter !== 'all') {
      if (channelFilter === 'web') {
        const channelFilterStr = `channel.eq.web,channel.eq.website_chat,channel.is.null,custom_data->>channel.eq.web,custom_data->>channel.eq.website_chat,custom_data->>channel.is.null,custom_data.is.null`
        pendingQuery = pendingQuery.or(channelFilterStr)
        nonPendingQuery = nonPendingQuery.or(channelFilterStr)
      } else {
        const channelFilterStr = `channel.eq.${channelFilter},custom_data->>channel.eq.${channelFilter}`
        pendingQuery = pendingQuery.or(channelFilterStr)
        nonPendingQuery = nonPendingQuery.or(channelFilterStr)
      }
    }

    // Apply search filter to both queries if specified
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim().toLowerCase()
      pendingQuery = pendingQuery.ilike('title', `%${searchTerm}%`)
      nonPendingQuery = nonPendingQuery.ilike('title', `%${searchTerm}%`)
    }

    // Get the count of pending conversations
    let pendingCountQuery = supabase
      .from("conversations")
      .select(
        needsAssigneeFilter || needsQualifiedFilter
          ? "id, leads!inner(id)"
          : "id",
        { count: 'exact', head: true }
      )
      .eq("site_id", siteId)
      .eq("is_archived", false)
      .eq("status", "pending")

    if (needsAssigneeFilter) {
      pendingCountQuery = pendingCountQuery.eq(
        "leads.assignee_id",
        currentUserId!
      )
    }
    if (needsQualifiedFilter) {
      pendingCountQuery = pendingCountQuery.in(
        "leads.status",
        QUALIFIED_STATUSES
      )
    }

    // Apply the same channel filter to count query
    if (channelFilter && channelFilter !== 'all') {
      if (channelFilter === 'web') {
        const channelFilterStr = `channel.eq.web,channel.eq.website_chat,channel.is.null,custom_data->>channel.eq.web,custom_data->>channel.eq.website_chat,custom_data->>channel.is.null,custom_data.is.null`
        pendingCountQuery = pendingCountQuery.or(channelFilterStr)
      } else {
        const channelFilterStr = `channel.eq.${channelFilter},custom_data->>channel.eq.${channelFilter}`
        pendingCountQuery = pendingCountQuery.or(channelFilterStr)
      }
    }

    // Apply the same search filter to count query
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim().toLowerCase()
      pendingCountQuery = pendingCountQuery.ilike('title', `%${searchTerm}%`)
    }

    const { count: pendingCount, error: pendingCountError } = await pendingCountQuery
    if (pendingCountError) {
      console.error("Error counting pending conversations:", pendingCountError)
      throw pendingCountError
    }

    const totalPending = pendingCount || 0
    
    // Calculate what we need from pending vs non-pending based on page
    const requestedFrom = (page - 1) * pageSize
    
    let pendingConversations: any[] = []
    let nonPendingConversations: any[] = []

    if (needsPostFiltering) {
      // When filtering by initiatedBy, we need to fetch more data for in-memory filtering.
      // "replied" = agent started + visitor replied - most are non-pending, so we fetch
      // multiple batches of non-pending (Supabase default limit ~1000 per query).
      const fetchCount = Math.min(page * pageSize * fetchMultiplier, 1000) // cap per-query
      const isRepliedFilter = initiatedByFilter === 'replied'
      const nonPendingBatches = isRepliedFilter ? 5 : 1 // 5 batches of ~1000 = ~5000 for replied

      const { data: pendingData, error: pendingError } = await pendingQuery
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(fetchCount)

      if (pendingError) {
        console.error("Error fetching pending conversations:", pendingError)
        throw pendingError
      }
      pendingConversations = pendingData || []

      // For "replied", fetch multiple batches of non-pending to search deeper into history
      for (let batch = 0; batch < nonPendingBatches; batch++) {
        const from = batch * 1000
        const to = from + 999
        const { data: batchData, error: batchError } = await nonPendingQuery
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .range(from, to)
        if (batchError) {
          console.error("Error fetching non-pending batch:", batchError)
          throw batchError
        }
        const batchConvs = batchData || []
        nonPendingConversations.push(...batchConvs)
        if (batchConvs.length < 1000) break // no more data
      }
    } else {
      // Use database-level pagination for better performance
      // We want: pending conversations first (sorted by last_message_at), then non-pending
      
      if (requestedFrom < totalPending) {
        // We need some pending conversations
        const pendingFrom = requestedFrom
        const pendingLimit = Math.min(pageSize, totalPending - requestedFrom)
        
        const { data: pendingData, error: pendingError } = await pendingQuery
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .range(pendingFrom, pendingFrom + pendingLimit - 1)
        
        if (pendingError) {
          console.error("Error fetching pending conversations:", pendingError)
          throw pendingError
        }
        
        pendingConversations = pendingData || []
        
        // If we need more to fill the page, get from non-pending
        const remainingNeeded = pageSize - pendingConversations.length
        if (remainingNeeded > 0) {
          const { data: nonPendingData, error: nonPendingError } = await nonPendingQuery
            .order("last_message_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .range(0, remainingNeeded - 1)
          
          if (nonPendingError) {
            console.error("Error fetching non-pending conversations:", nonPendingError)
            throw nonPendingError
          } else {
            nonPendingConversations = nonPendingData || []
          }
        }
      } else {
        // All pending are before this page, only fetch non-pending
        const nonPendingFrom = requestedFrom - totalPending
        
        const { data: nonPendingData, error: nonPendingError } = await nonPendingQuery
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .range(nonPendingFrom, nonPendingFrom + pageSize - 1)
        
        if (nonPendingError) {
          console.error("Error fetching non-pending conversations:", nonPendingError)
          throw nonPendingError
        }
        
        nonPendingConversations = nonPendingData || []
      }
    }

    // Combine: pending conversations first, then non-pending
    const conversations = [...pendingConversations, ...nonPendingConversations]
    
    console.log(`✅ Pending conversations: ${pendingConversations.length} (total in DB: ${totalPending})`)
    console.log(`✅ Non-pending conversations: ${nonPendingConversations.length}`)
    console.log(`✅ Total conversations for page ${page}: ${conversations.length}`)

    if (!conversations || conversations.length === 0) {
      return []
    }

    let filteredConversations = conversations

    // Apply initiatedBy filter using compact embedded message markers.
    if (initiatedByFilter && initiatedByFilter !== 'all') {
      console.log(`🔍 Filtering conversations by initiatedBy (${initiatedByFilter})`)
      
      const userRoles = ['visitor', 'user']
      const systemRoles = ['agent', 'assistant', 'system', 'team_member']
      
      // First combine all fetched conversations
      const allFetched = [...pendingConversations, ...nonPendingConversations]
      
      const allFiltered = allFetched.filter((conv: any) => {
        const firstMessage = conv.first_message?.[0]

        if (!firstMessage) {
          // No messages = can't determine who initiated, exclude from filter
          return false
        }
        const firstRole = firstMessage.role
        
        if (initiatedByFilter === 'visitor') {
          // INBOUND: First message must be from user/visitor
          return userRoles.includes(firstRole)
        } else if (initiatedByFilter === 'agent') {
          // OUTBOUND: First message must be from system/agent
          return systemRoles.includes(firstRole)
        } else if (initiatedByFilter === 'replied') {
          // REPLIED: First message from system/agent, and AT LEAST one subsequent message from user/visitor
          const isOutbound = systemRoles.includes(firstRole)
          const hasVisitorReply = Boolean(conv.visitor_messages?.length)
          return isOutbound && hasVisitorReply
        }
        
        return false
      })
      
      const totalFiltered = allFiltered.length
      console.log(`✅ Filtered to ${totalFiltered} conversations matching ${initiatedByFilter} filter`)
      
      // Apply pagination in memory after filtering
      const paginatedFrom = (page - 1) * pageSize
      const paginatedTo = paginatedFrom + pageSize
      filteredConversations = allFiltered.slice(paginatedFrom, paginatedTo)
      
      // If we have more filtered results than needed for this page, we know there are more
      // The component checks if result.length === pageSize to determine hasMore
      // So we ensure we return exactly pageSize when there are more results
      const hasMoreResults = totalFiltered > paginatedTo
      if (hasMoreResults && filteredConversations.length < pageSize) {
        // This shouldn't happen if we fetched enough, but handle it gracefully
        console.warn(`⚠️ Expected ${pageSize} results but got ${filteredConversations.length} after filtering`)
      }
      
      console.log(`📄 Paginated: showing ${filteredConversations.length} conversations (page ${page}, ${pageSize} per page, hasMore: ${hasMoreResults})`)
    } else {
      // No initiatedBy filter - data is already paginated from DB
      filteredConversations = conversations
      console.log(`📄 DB Paginated: showing ${filteredConversations.length} conversations (page ${page}, ${pageSize} per page)`)
    }

    // Assignee filter
    if (assigneeFilter && assigneeFilter !== 'all' && currentUserId) {
      filteredConversations = filteredConversations.filter((conv: any) => {
        const hasLead = conv.lead_id && conv.leads
        const assigneeId = hasLead ? conv.leads.assignee_id : null
        if (assigneeFilter === 'assigned') return assigneeId === currentUserId
        if (assigneeFilter === 'ai') return !assigneeId
        return true
      })
    }

    return buildConversationListItems(
      supabase,
      filteredConversations as ConversationListRow[]
    )
  } catch (error) {
    console.error("Unexpected error in getConversations (client):", error)
    throw error
  }
}

