import type { CommunicationChannel } from "@/lib/site-channels"
import type { ConversationListItem } from "@/app/types/chat"
import { supabase } from "./chat-runtime"
import { createClient } from "@/lib/supabase/client"
import { getUserData } from "./chat-profiles"

/**
 * Get all conversations for a site with pagination
 */
export async function getConversations(
  siteId: string, 
  page: number = 1, 
  pageSize: number = 20,
  channelFilter?: 'all' | CommunicationChannel,
  assigneeFilter?: 'all' | 'assigned' | 'ai',
  currentUserId?: string,
  searchQuery?: string,
  initiatedByFilter?: 'all' | 'visitor' | 'agent' | 'replied',
  tasksOnly?: boolean
): Promise<ConversationListItem[]> {
  try {
    console.log(`🔍 DEBUG: getConversations called for site: ${siteId}, page: ${page}, pageSize: ${pageSize}, channelFilter: ${channelFilter || 'none'}, searchQuery: ${searchQuery || 'none'}`);
    const supabase = createClient();
    
    // Calculate pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    
    // Build base query parts
    const baseSelect = `
      id,
      title,
      agent_id,
      lead_id,
      last_message_at,
      created_at,
      custom_data,
      channel,
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

    // Fetch pending conversations (fetch more to ensure we get enough)
    const pendingFetchCount = pageSize * 2
    const { data: pendingConversations, error: pendingError } = await pendingQuery
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(pendingFetchCount)

    // Fetch non-pending conversations
    const { data: nonPendingConversations, error: nonPendingError } = await nonPendingQuery
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(pageSize)

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
      console.log(`🔍 DEBUG: No conversations found for site ${siteId}, page ${page}`);
      return []
    }
    
    // Apply assignee filter if specified
    let filteredConversations = conversations;
    if (assigneeFilter && assigneeFilter !== 'all' && currentUserId) {
      filteredConversations = conversations.filter((conv: any) => {
        const hasLead = conv.lead_id && conv.leads;
        const assigneeId = hasLead ? conv.leads.assignee_id : null;
        
        if (assigneeFilter === 'assigned') {
          // Show conversations where current user is assigned to the lead
          return assigneeId === currentUserId;
        } else if (assigneeFilter === 'ai') {
          // Show conversations with no assignee (AI conversations)
          return !assigneeId;
        }
        
        return true;
      });
    }
    
    // Apply pagination after filtering
    const paginatedFrom = (page - 1) * pageSize
    const paginatedTo = paginatedFrom + pageSize
    filteredConversations = filteredConversations.slice(paginatedFrom, paginatedTo)
    
    console.log(`🔍 DEBUG: Retrieved ${conversations.length} conversations from database`);
    console.log(`🔍 DEBUG: After assignee filter: ${filteredConversations.length} conversations`);
    console.log(`🔍 DEBUG: After pagination (page ${page}): ${filteredConversations.length} conversations`);
    console.log('🔍 DEBUG: First conversation titles:', filteredConversations.slice(0, 3).map((c: any) => c.title));
    
    // Obtenemos los IDs de los agentes
    const agentIds = filteredConversations.map((conv: any) => conv.agent_id).filter(Boolean)
    
    // Obtenemos los IDs de leads
    const leadIds = filteredConversations.map((conv: any) => conv.lead_id).filter(Boolean)
    
    // Inicializamos los mapas de agentes y leads
    let agentsMap: Record<string, string> = {};
    let leadsMap: Record<string, string> = {};
    
    // Si hay IDs de agentes, obtenemos sus nombres
    if (agentIds.length > 0) {
      const { data: agents, error: agentsError } = await supabase
        .from("agents")
        .select("id, name")
        .in("id", agentIds)

      if (agentsError) {
        console.error("Error fetching agents:", agentsError)
      } else {
        // Creamos un mapa de agentes para búsqueda rápida
        agentsMap = (agents || []).reduce((map: Record<string, string>, agent: any) => {
          map[agent.id] = agent.name;
          return map;
        }, {});
      }
    }
    
    // Si hay IDs de leads, obtenemos sus nombres y assignees
    let assigneesMap: Record<string, string> = {};
    let leadAssigneeMap: Record<string, string> = {}; // Mapea lead_id -> assignee_id
    
    if (leadIds.length > 0) {
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("id, name, company, assignee_id")
        .in("id", leadIds)

      if (leadsError) {
        console.error("Error fetching leads:", leadsError)
      } else {
        // Obtener assignee IDs únicos
        const assigneeIds = (leads || [])
          .map((lead: any) => lead.assignee_id)
          .filter(Boolean)
          .filter((id: string, index: number, arr: string[]) => arr.indexOf(id) === index) // Remove duplicates

        // Si hay assignees, obtener su información
        if (assigneeIds.length > 0) {
          try {
            // Import getUserData dynamically to avoid circular dependencies
            const { getUserData } = await import('@/app/services/user-service');
            const assigneeDataPromises = assigneeIds.map(async (assigneeId: string) => {
              try {
                const userData = await getUserData(assigneeId);
                return { id: assigneeId, name: userData?.name || `User ${assigneeId.substring(0, 8)}` };
              } catch (error) {
                console.error(`Error fetching assignee ${assigneeId}:`, error);
                return { id: assigneeId, name: `User ${assigneeId.substring(0, 8)}` };
              }
            });
            
            const assigneeResults = await Promise.all(assigneeDataPromises);
            assigneesMap = assigneeResults.reduce((map: Record<string, string>, assignee: any) => {
              map[assignee.id] = assignee.name;
              return map;
            }, {});
          } catch (error) {
            console.error("Error loading assignee data:", error);
          }
        }

        // Creamos un mapa de leads para búsqueda rápida
        leadsMap = (leads || []).reduce((map: Record<string, string>, lead: any) => {
          const companyName = lead.company && typeof lead.company === 'object' && lead.company.name 
            ? lead.company.name 
            : (typeof lead.company === 'string' ? lead.company : '');
          
          map[lead.id] = lead.name + (companyName ? ` (${companyName})` : '');
          
          // Store lead -> assignee mapping
          if (lead.assignee_id) {
            leadAssigneeMap[lead.id] = lead.assignee_id;
          }
          
          return map;
        }, {});
      }
    }

    // Mapeamos las conversaciones con toda la información disponible
    return filteredConversations.map((conv: any) => {
      const lastMessage = conv.messages && conv.messages.length > 0
        ? conv.messages[conv.messages.length - 1].content
        : undefined

      // Usar last_message_at si está disponible, o created_at como respaldo
      const messageDate = conv.last_message_at || conv.created_at || new Date().toISOString()
      
      // Get lead name if available
      const leadId = conv.lead_id || "";
      const leadName = leadId ? leadsMap[leadId] : "";
      
      // Generate a better title if we have a lead name
      let title = conv.title || "Untitled Conversation";
      if (leadName && (!conv.title || conv.title === "Untitled Conversation")) {
        title = `Chat with ${leadName}`;
      }
      
      // Get agent name with fallback, but prioritize assignee if lead has one
      const agentId = conv.agent_id || "";
      const assigneeId = leadId ? leadAssigneeMap[leadId] : null;
      
      let agentName = agentsMap[agentId] || 
        (agentId && agentId !== "" ? "Unknown Agent" : "Agent");
      
      // If lead has an assignee, use assignee name instead of agent name
      if (assigneeId && assigneesMap[assigneeId]) {
        agentName = assigneesMap[assigneeId];
      }
      
      // Extract channel from custom_data or default to 'web'
      const customData = conv.custom_data || {};
      let channel = conv.channel || customData.channel || 'web';
      
      // Normalize website_chat to web since they are the same
      if (channel === 'website_chat') {
        channel = 'web';
      }
      
      return {
        id: conv.id || "",
        title: title,
        agentId: agentId,
        agentName: agentName,
        leadName: leadName || undefined,
        lastMessage,
        timestamp: new Date(messageDate),
        messageCount: conv.messages?.length || 0,
        channel: channel || 'web',
        status: conv.status || 'active'
      }
    })
  } catch (error) {
    console.error("Unexpected error in getConversations:", error)
    return []
  }
}
