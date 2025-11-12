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

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from("conversations")
      .select(`
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
      `)
      .eq("site_id", siteId)
      .eq("is_archived", false)

    if (channelFilter && channelFilter !== 'all') {
      if (channelFilter === 'web') {
        query = query.or(`custom_data->>channel.eq.web,custom_data->>channel.eq.website_chat,custom_data->>channel.is.null,custom_data.is.null`)
      } else {
        query = query.eq(`custom_data->>channel`, channelFilter)
      }
    }

    if (searchQuery && searchQuery.trim()) {
      const searchTerm = searchQuery.trim().toLowerCase()
      query = query.ilike('title', `%${searchTerm}%`)
    }

    // Apply initiatedBy filter at database level if specified
    if (initiatedByFilter && initiatedByFilter !== 'all') {
      // First, get all conversations for this site to get their IDs
      const { data: allSiteConversations } = await supabase
        .from("conversations")
        .select("id")
        .eq("site_id", siteId)
        .eq("is_archived", false)
      
      if (!allSiteConversations || allSiteConversations.length === 0) {
        return []
      }
      
      const conversationIds = allSiteConversations.map((c: any) => c.id)
      
      // Get the first message for each conversation
      // We'll use a query that gets messages ordered by conversation_id and created_at
      // Then we'll process them to find the first message per conversation
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('conversation_id, role, created_at')
        .in('conversation_id', conversationIds)
        .order('conversation_id', { ascending: true })
        .order('created_at', { ascending: true })
      
      if (messagesError) {
        console.error("Error fetching messages for initiatedBy filter:", messagesError)
        // Fall back to client-side filtering if query fails
      } else if (messages && messages.length > 0) {
        // Get first message per conversation
        const firstMessageByConversation = new Map<string, string>()
        for (const msg of messages) {
          if (!firstMessageByConversation.has(msg.conversation_id)) {
            firstMessageByConversation.set(msg.conversation_id, msg.role)
          }
        }
        
        // Filter conversation IDs based on first message role
        const matchingConversationIds: string[] = []
        
        for (const [conversationId, firstRole] of firstMessageByConversation.entries()) {
          if (initiatedByFilter === 'visitor') {
            // Inbound: first message from visitor/user
            if (firstRole === 'visitor' || firstRole === 'user') {
              matchingConversationIds.push(conversationId)
            }
          } else if (initiatedByFilter === 'agent') {
            // Outbound: first message from agent/assistant/system/team_member
            if (firstRole === 'agent' || firstRole === 'assistant' || firstRole === 'system' || firstRole === 'team_member') {
              matchingConversationIds.push(conversationId)
            }
          }
        }
        
        // If no matching conversations, return empty early
        if (matchingConversationIds.length === 0) {
          return []
        }
        
        // Filter conversations by matching IDs
        query = query.in('id', matchingConversationIds)
      }
    }

    const { data: conversations, error: conversationsError } = await query
      .order("last_message_at", { ascending: false })
      .range(from, to)

    if (conversationsError || !conversations || conversations.length === 0) {
      return []
    }

    let filteredConversations = conversations

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


