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
  initiatedByFilter?: 'all' | 'visitor' | 'agent' | 'replied',
  tasksOnly?: boolean,
  qualifiedLeadsOnly?: boolean
): Promise<ConversationListItem[]> {
  try {
    const supabase = createClient();

    // When initiatedBy filter is active, we need to fetch more conversations
    // to compensate for filtering, then paginate in memory (searches larger history)
    const needsPostFiltering = initiatedByFilter && initiatedByFilter !== 'all'
    const fetchMultiplier = needsPostFiltering ? 50 : 1 // Fetch 50x more for inbound/outbound
    // "Replied" (agent started + visitor replied) is rarer - often in non-pending, so we fetch deeper
    const isRepliedFilter = initiatedByFilter === 'replied'
    const REPLIED_BATCH_SIZE = 1000 // Supabase default limit per query
    const REPLIED_NON_PENDING_BATCHES = 5 // Fetch up to 5000 non-pending for replied

    // TASKS-ONLY: Two-step approach to search full history without row duplication
    if (tasksOnly) {
      const { data: taskRows } = await supabase
        .from('tasks')
        .select('conversation_id')
        .eq('status', 'pending')
        .eq('site_id', siteId)
        .not('conversation_id', 'is', null)
        .limit(3000)
      const convIds = [...new Set((taskRows || []).map((t: any) => t.conversation_id).filter(Boolean))]
      if (convIds.length === 0) return []

      const needsAssign = assigneeFilter === 'assigned' && currentUserId
      const needsQual = qualifiedLeadsOnly === true
      const tasksBaseSelect = needsAssign || needsQual
        ? `id, title, agent_id, lead_id, last_message_at, created_at, custom_data, status,
          messages (content, created_at, role, user_id, custom_data),
          leads!inner (assignee_id, status)`
        : `id, title, agent_id, lead_id, last_message_at, created_at, custom_data, status,
          messages (content, created_at, role, user_id, custom_data),
          leads (assignee_id, status)`

      let tasksQuery = supabase
        .from('conversations')
        .select(tasksBaseSelect)
        .eq('site_id', siteId)
        .eq('is_archived', false)
        .in('id', convIds)
      if (needsAssign) {
        tasksQuery = tasksQuery.eq('leads.assignee_id', currentUserId)
      }
      if (needsQual) {
        tasksQuery = tasksQuery.in_('leads.status', ['qualified', 'converted'])
      }
      if (searchQuery?.trim()) {
        tasksQuery = tasksQuery.ilike('title', `%${searchQuery.trim().toLowerCase()}%`)
      }

      const { data: allConvs, error } = await tasksQuery.order('last_message_at', { ascending: false })
      if (error) {
        console.error('Error fetching conversations with tasks:', error)
        return []
      }
      const sorted = (allConvs || []).sort((a: any, b: any) => {
        const dA = new Date(a.last_message_at || a.created_at || 0).getTime()
        const dB = new Date(b.last_message_at || b.created_at || 0).getTime()
        return dB - dA
      })
      const pageConvs = sorted.slice((page - 1) * pageSize, page * pageSize)
      return buildConversationListItems(supabase, pageConvs)
    }

    // Build base query parts - add leads!inner for assigned/qualified filters (DB-level, full history)
    const needsAssigneeFilter = assigneeFilter === 'assigned' && currentUserId
    const needsQualifiedFilter = qualifiedLeadsOnly === true
    const QUALIFIED_STATUSES = ['qualified', 'converted']

    let baseSelect = `
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
        user_id,
        custom_data
      ),
      leads (
        assignee_id,
        status
      )
    `

    // When assigneeFilter=assigned or qualifiedLeadsOnly: use leads!inner so we filter at DB level (searches full history)
    if (needsAssigneeFilter || needsQualifiedFilter) {
      baseSelect = baseSelect.replace(
        'leads (\n        assignee_id,\n        status\n      )',
        'leads!inner (\n        assignee_id,\n        status\n      )'
      )
    }

    // Query 1: Get pending conversations (by status)
    let pendingQuery = supabase
      .from("conversations")
      .select(baseSelect, { count: needsAssigneeFilter || needsQualifiedFilter ? undefined : 'exact' })
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

    // Get the count of pending conversations
    let pendingCountQuery = supabase
      .from("conversations")
      .select("id", { count: 'exact', head: true })
      .eq("site_id", siteId)
      .eq("is_archived", false)
      .eq("status", "pending")

    // Apply the same channel filter to count query
    if (channelFilter && channelFilter !== 'all') {
      if (channelFilter === 'web') {
        const channelFilterStr = `custom_data->>channel.eq.web,custom_data->>channel.eq.website_chat,custom_data->>channel.is.null,custom_data.is.null`
        pendingCountQuery = pendingCountQuery.or(channelFilterStr)
      } else {
        pendingCountQuery = pendingCountQuery.eq(`custom_data->>channel`, channelFilter)
      }
    }

    // Apply the same search filter to count query
    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim().toLowerCase()
      pendingCountQuery = pendingCountQuery.ilike('title', `%${searchTerm}%`)
    }

    const { count: pendingCount } = await pendingCountQuery

    const totalPending = pendingCount || 0
    
    // Calculate what we need from pending vs non-pending based on page
    const requestedFrom = (page - 1) * pageSize
    const requestedTo = requestedFrom + pageSize
    
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
        .order("last_message_at", { ascending: false })
        .limit(fetchCount)

      if (pendingError) {
        console.error("Error fetching pending conversations:", pendingError)
        return []
      }
      pendingConversations = pendingData || []

      // For "replied", fetch multiple batches of non-pending to search deeper into history
      for (let batch = 0; batch < nonPendingBatches; batch++) {
        const from = batch * 1000
        const to = from + 999
        const { data: batchData, error: batchError } = await nonPendingQuery
          .order("last_message_at", { ascending: false })
          .range(from, to)
        if (batchError) {
          console.error("Error fetching non-pending batch:", batchError)
          break
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
          .order("last_message_at", { ascending: false })
          .range(pendingFrom, pendingFrom + pendingLimit - 1)
        
        if (pendingError) {
          console.error("Error fetching pending conversations:", pendingError)
          return []
        }
        
        pendingConversations = pendingData || []
        
        // If we need more to fill the page, get from non-pending
        const remainingNeeded = pageSize - pendingConversations.length
        if (remainingNeeded > 0) {
          const { data: nonPendingData, error: nonPendingError } = await nonPendingQuery
            .order("last_message_at", { ascending: false })
            .range(0, remainingNeeded - 1)
          
          if (nonPendingError) {
            console.error("Error fetching non-pending conversations:", nonPendingError)
          } else {
            nonPendingConversations = nonPendingData || []
          }
        }
      } else {
        // All pending are before this page, only fetch non-pending
        const nonPendingFrom = requestedFrom - totalPending
        
        const { data: nonPendingData, error: nonPendingError } = await nonPendingQuery
          .order("last_message_at", { ascending: false })
          .range(nonPendingFrom, nonPendingFrom + pageSize - 1)
        
        if (nonPendingError) {
          console.error("Error fetching non-pending conversations:", nonPendingError)
          return []
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

    // Apply initiatedBy filter using messages that come with conversations
    if (initiatedByFilter && initiatedByFilter !== 'all') {
      console.log(`🔍 Filtering conversations by initiatedBy (${initiatedByFilter}) using messages from query`)
      
      const userRoles = ['visitor', 'user']
      const systemRoles = ['agent', 'assistant', 'system', 'team_member']
      
      // First combine all fetched conversations
      const allFetched = [...pendingConversations, ...nonPendingConversations]
      
      const allFiltered = allFetched.filter((conv: any) => {
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
        } else if (initiatedByFilter === 'replied') {
          // REPLIED: First message from system/agent, and AT LEAST one subsequent message from user/visitor
          const isOutbound = systemRoles.includes(firstRole)
          const hasVisitorReply = sortedMessages.slice(1).some((msg: any) => userRoles.includes(msg.role))
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
    let leadStatusMap: Record<string, string> = {}
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
        .select("id, name, company, assignee_id, status")
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
        
        leadStatusMap = leads.reduce((map: Record<string, string>, lead: any) => {
          if (lead.status) map[lead.id] = lead.status
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

      // Check if any message has accepted or pending status
      const hasAcceptedMessage = conv.messages && conv.messages.some((msg: any) => 
        msg.custom_data && msg.custom_data.status === 'accepted'
      )
      const hasPendingMessages = conv.messages && conv.messages.some((msg: any) =>
        msg.custom_data && (msg.custom_data.status === 'pending' || msg.custom_data.status === 'accepted')
      )

      const leadStatus = leadId ? leadStatusMap[leadId] : undefined

      return {
        id: conv.id || "",
        title,
        agentId,
        agentName,
        leadName: leadName || undefined,
        leadStatus: leadStatus || undefined,
        lastMessage,
        timestamp: new Date(messageDate),
        messageCount: conv.messages?.length || 0,
        channel: (channel as 'web' | 'email' | 'whatsapp') || 'web',
        status: (hasPendingMessages ? 'pending' : conv.status) || 'active',
        hasAcceptedMessage: hasAcceptedMessage || false
      }
    })
  } catch (error) {
    console.error("Unexpected error in getConversations (client):", error)
    return []
  }
}

/** Build ConversationListItem[] from raw conversation rows (for tasks path) */
async function buildConversationListItems(
  supabase: ReturnType<typeof createClient>,
  conversations: any[]
): Promise<ConversationListItem[]> {
  if (!conversations.length) return []
  const agentIds = conversations.map((c: any) => c.agent_id).filter(Boolean)
  const leadIds = conversations.map((c: any) => c.lead_id).filter(Boolean)
  let agentsMap: Record<string, string> = {}
  let leadsMap: Record<string, string> = {}
  let leadStatusMap: Record<string, string> = {}
  let assigneesMap: Record<string, string> = {}
  let leadAssigneeMap: Record<string, string> = {}

  if (agentIds.length > 0) {
    const { data: agents } = await supabase.from("agents").select("id, name").in("id", agentIds)
    agentsMap = (agents || []).reduce((map: Record<string, string>, a: any) => { map[a.id] = a.name; return map }, {})
  }
  if (leadIds.length > 0) {
    const { data: leads } = await supabase.from("leads").select("id, name, company, assignee_id, status").in("id", leadIds)
    if (leads?.length) {
      const assigneeIds = [...new Set(leads.map((l: any) => l.assignee_id).filter(Boolean))]
      if (assigneeIds.length > 0) {
        try {
          const { getUserData } = await import('@/app/services/user-service')
          const results = await Promise.all(assigneeIds.map(async (id: string) => ({
            id,
            name: (await getUserData(id))?.name || `User ${id.substring(0, 8)}`
          })))
          assigneesMap = results.reduce((m: Record<string, string>, r: any) => { m[r.id] = r.name; return m }, {})
        } catch { /* ignore */ }
      }
      leads.forEach((lead: any) => {
        const companyName = lead.company?.name ?? (typeof lead.company === 'string' ? lead.company : '')
        leadsMap[lead.id] = lead.name + (companyName ? ` (${companyName})` : '')
        if (lead.assignee_id) leadAssigneeMap[lead.id] = lead.assignee_id
        if (lead.status) leadStatusMap[lead.id] = lead.status
      })
    }
  }

  return conversations.map((conv: any) => {
    const lastMessage = conv.messages?.length ? conv.messages[conv.messages.length - 1].content : undefined
    const messageDate = conv.last_message_at || conv.created_at || new Date().toISOString()
    const leadId = conv.lead_id || ""
    const leadName = leadId ? leadsMap[leadId] : ""
    let title = conv.title || "Untitled Conversation"
    if (leadName && (!conv.title || conv.title === "Untitled Conversation")) title = `Chat with ${leadName}`
    const agentId = conv.agent_id || ""
    const assigneeId = leadId ? leadAssigneeMap[leadId] : null
    let agentName = agentsMap[agentId] || (agentId ? "Unknown Agent" : "Agent")
    if (assigneeId && assigneesMap[assigneeId]) agentName = assigneesMap[assigneeId]
    const customData = conv.custom_data || {}
    let channel = customData.channel || 'web'
    if (channel === 'website_chat') channel = 'web'
    const hasAcceptedMessage = conv.messages?.some((msg: any) => msg.custom_data?.status === 'accepted')
    const hasPendingMessages = conv.messages?.some((msg: any) =>
      msg.custom_data?.status === 'pending' || msg.custom_data?.status === 'accepted')
    return {
      id: conv.id || "",
      title,
      agentId,
      agentName,
      leadName: leadName || undefined,
      leadStatus: leadIds.includes(leadId) ? leadStatusMap[leadId] : undefined,
      lastMessage,
      timestamp: new Date(messageDate),
      messageCount: conv.messages?.length || 0,
      channel: (channel as 'web' | 'email' | 'whatsapp') || 'web',
      status: (hasPendingMessages ? 'pending' : conv.status) || 'active',
      hasAcceptedMessage: hasAcceptedMessage || false
    }
  })
}

