import { createClient } from "@/lib/supabase/client"
import { ConversationListItem } from "@/app/types/chat"

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
  initiatedByFilter?: 'all' | 'visitor' | 'agent',
  tasksOnly?: boolean
): Promise<ConversationListItem[]> {
  try {
    const supabase = createClient();

    // When initiatedBy filter is active, we need to fetch more conversations
    // to compensate for filtering, then paginate in memory
    const needsPostFiltering = initiatedByFilter && initiatedByFilter !== 'all'
    const fetchMultiplier = needsPostFiltering ? 5 : 1 // Fetch 5x more when filtering
    
    let from: number
    let to: number
    
    if (needsPostFiltering) {
      // Fetch enough conversations to cover the requested page after filtering
      // For page N, we need at least N * pageSize filtered results
      // So we fetch (N * pageSize * multiplier) conversations
      const targetFilteredCount = page * pageSize
      const fetchCount = targetFilteredCount * fetchMultiplier
      from = 0
      to = fetchCount - 1
    } else {
      // Normal pagination
      from = (page - 1) * pageSize
      to = from + pageSize - 1
    }

    // Build base query parts
    const baseSelect = `
      id,
      title,
      agent_id,
      lead_id,
      last_message_at,
      created_at,
      custom_data,
      status,
      messages (
        content,
        created_at,
        role,
        user_id
      ),
      leads (
        assignee_id
      )
    `

    // Query 1: Get pending conversations first
    let pendingQuery = supabase
      .from("conversations")
      .select(baseSelect)
      .eq("site_id", siteId)
      .eq("is_archived", false)
      .eq("status", "pending")

    // Query 2: Get non-pending conversations
    let nonPendingQuery = supabase
      .from("conversations")
      .select(baseSelect)
      .eq("site_id", siteId)
      .eq("is_archived", false)
      .neq("status", "pending")

    // Apply channel filter to both queries if specified
    if (channelFilter && channelFilter !== 'all') {
      if (channelFilter === 'web') {
        const channelFilterStr = `custom_data->>channel.eq.web,custom_data->>channel.eq.website_chat,custom_data->>channel.is.null,custom_data.is.null`
        pendingQuery = pendingQuery.or(channelFilterStr)
        nonPendingQuery = nonPendingQuery.or(channelFilterStr)
      } else {
        pendingQuery = pendingQuery.eq(`custom_data->>channel`, channelFilter)
        nonPendingQuery = nonPendingQuery.eq(`custom_data->>channel`, channelFilter)
      }
    }

    // Apply search filter to both queries if specified
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim().toLowerCase()
      pendingQuery = pendingQuery.ilike('title', `%${searchTerm}%`)
      nonPendingQuery = nonPendingQuery.ilike('title', `%${searchTerm}%`)
    }

    // Fetch pending conversations (fetch enough to cover pagination after filtering)
    // We fetch more pending conversations to ensure we have enough after filtering
    const pendingFetchCount = needsPostFiltering ? pageSize * fetchMultiplier * 2 : pageSize * 3
    const { data: pendingConversations, error: pendingError } = await pendingQuery
      .order("last_message_at", { ascending: false })
      .limit(pendingFetchCount)

    // Fetch non-pending conversations (fetch enough to cover pagination)
    const nonPendingFetchCount = needsPostFiltering ? pageSize * fetchMultiplier : pageSize * 2
    const { data: nonPendingConversations, error: nonPendingError } = await nonPendingQuery
      .order("last_message_at", { ascending: false })
      .limit(nonPendingFetchCount)

    if (pendingError || nonPendingError) {
      console.error("Error fetching conversations:", pendingError || nonPendingError)
      return []
    }

    // Combine: pending conversations first, then non-pending
    const conversations = [...(pendingConversations || []), ...(nonPendingConversations || [])]
    
    console.log(`✅ Pending conversations: ${(pendingConversations || []).length}`)
    console.log(`✅ Non-pending conversations: ${(nonPendingConversations || []).length}`)
    console.log(`✅ Total conversations before filtering: ${conversations.length}`)

    if (!conversations || conversations.length === 0) {
      return []
    }

    let filteredConversations = conversations

    // Apply initiatedBy filter using messages that come with conversations
    if (initiatedByFilter && initiatedByFilter !== 'all') {
      console.log(`🔍 Filtering conversations by initiatedBy (${initiatedByFilter}) using messages from query`)
      
      const userRoles = ['visitor', 'user']
      const systemRoles = ['agent', 'assistant', 'system', 'team_member']
      
      filteredConversations = filteredConversations.filter((conv: any) => {
        // Get messages for this conversation
        const messages = conv.messages || []
        
        if (!messages || messages.length === 0) {
          // No messages = can't determine who initiated, exclude from filter
          return false
        }
        
        // Find the first message (oldest by created_at)
        const sortedMessages = [...messages].sort((a: any, b: any) => {
          const dateA = new Date(a.created_at).getTime()
          const dateB = new Date(b.created_at).getTime()
          return dateA - dateB
        })
        
        const firstMessage = sortedMessages[0]
        const firstRole = firstMessage.role
        
        if (initiatedByFilter === 'visitor') {
          // INBOUND: First message must be from user/visitor
          return userRoles.includes(firstRole)
        } else if (initiatedByFilter === 'agent') {
          // OUTBOUND: First message must be from system/agent
          return systemRoles.includes(firstRole)
        }
        
        return false
      })
      
      const totalFiltered = filteredConversations.length
      console.log(`✅ Filtered to ${totalFiltered} conversations matching ${initiatedByFilter} filter`)
      
      // Apply pagination in memory after filtering
      const paginatedFrom = (page - 1) * pageSize
      const paginatedTo = paginatedFrom + pageSize
      filteredConversations = filteredConversations.slice(paginatedFrom, paginatedTo)
      
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
      // No initiatedBy filter, apply normal pagination in memory
      const paginatedFrom = (page - 1) * pageSize
      const paginatedTo = paginatedFrom + pageSize
      filteredConversations = filteredConversations.slice(paginatedFrom, paginatedTo)
      console.log(`📄 Paginated: showing ${filteredConversations.length} conversations (page ${page}, ${pageSize} per page)`)
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

    // Tasks-only filter: keep conversations that have at least one task linked by conversation_id
    if (tasksOnly) {
      const conversationIds = filteredConversations.map((c: any) => c.id)
      if (conversationIds.length === 0) {
        return []
      }
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, conversation_id')
        .in('conversation_id', conversationIds)
        .eq('status', 'pending')

      const withTasks = new Set((tasks || []).map((t: any) => t.conversation_id))
      filteredConversations = filteredConversations.filter((c: any) => withTasks.has(c.id))
    }

    // Build maps for names
    const agentIds = filteredConversations.map((c: any) => c.agent_id).filter(Boolean)
    const leadIds = filteredConversations.map((c: any) => c.lead_id).filter(Boolean)

    let agentsMap: Record<string, string> = {}
    let leadsMap: Record<string, string> = {}
    let assigneesMap: Record<string, string> = {}
    let leadAssigneeMap: Record<string, string> = {}

    if (agentIds.length > 0) {
      const { data: agents } = await supabase
        .from("agents")
        .select("id, name")
        .in("id", agentIds)
      agentsMap = (agents || []).reduce((map: Record<string, string>, a: any) => {
        map[a.id] = a.name
        return map
      }, {})
    }

    if (leadIds.length > 0) {
      const { data: leads } = await supabase
        .from("leads")
        .select("id, name, company, assignee_id")
        .in("id", leadIds)

      if (leads && leads.length > 0) {
        const assigneeIds = leads
          .map((l: any) => l.assignee_id)
          .filter(Boolean)
          .filter((id: string, idx: number, arr: string[]) => arr.indexOf(id) === idx)

        if (assigneeIds.length > 0) {
          try {
            const { getUserData } = await import('@/app/services/user-service')
            const results = await Promise.all(assigneeIds.map(async (id: string) => {
              try {
                const u = await getUserData(id)
                return { id, name: u?.name || `User ${id.substring(0, 8)}` }
              } catch {
                return { id, name: `User ${id.substring(0, 8)}` }
              }
            }))
            assigneesMap = results.reduce((map: Record<string, string>, r: any) => {
              map[r.id] = r.name
              return map
            }, {})
          } catch {
            // ignore
          }
        }

        leadsMap = leads.reduce((map: Record<string, string>, lead: any) => {
          const companyName = lead.company && typeof lead.company === 'object' && lead.company.name
            ? lead.company.name
            : (typeof lead.company === 'string' ? lead.company : '')
          map[lead.id] = lead.name + (companyName ? ` (${companyName})` : '')
          if (lead.assignee_id) leadAssigneeMap[lead.id] = lead.assignee_id
          return map
        }, {})
      }
    }

    return filteredConversations.map((conv: any) => {
      const lastMessage = conv.messages && conv.messages.length > 0
        ? conv.messages[conv.messages.length - 1].content
        : undefined
      const messageDate = conv.last_message_at || conv.created_at || new Date().toISOString()
      const leadId = conv.lead_id || ""
      const leadName = leadId ? leadsMap[leadId] : ""
      let title = conv.title || "Untitled Conversation"
      if (leadName && (!conv.title || conv.title === "Untitled Conversation")) {
        title = `Chat with ${leadName}`
      }
      const agentId = conv.agent_id || ""
      const assigneeId = leadId ? leadAssigneeMap[leadId] : null
      let agentName = agentsMap[agentId] || (agentId && agentId !== "" ? "Unknown Agent" : "Agent")
      if (assigneeId && assigneesMap[assigneeId]) agentName = assigneesMap[assigneeId]
      const customData = conv.custom_data || {}
      let channel = customData.channel || 'web'
      if (channel === 'website_chat') channel = 'web'

      return {
        id: conv.id || "",
        title,
        agentId,
        agentName,
        leadName: leadName || undefined,
        lastMessage,
        timestamp: new Date(messageDate),
        messageCount: conv.messages?.length || 0,
        channel: (channel as 'web' | 'email' | 'whatsapp') || 'web',
        status: conv.status || 'active'
      }
    })
  } catch (error) {
    console.error("Unexpected error in getConversations (client):", error)
    return []
  }
}


