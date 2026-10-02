import { createClient } from "@/lib/supabase/client"
import { ChatMessage, Message } from "@/app/types/chat"
import { withMappedCommandStatus } from "@/app/services/map-chat-command-status"
import { isSocialCommentMetadata, orderCommentMessages, parseSocialCommentContext, resolveCommentReplyContext } from "@/lib/chat/social-comment-context"

const MESSAGE_FIELDS = "id, role, content, created_at, updated_at, user_id, agent_id, visitor_id, lead_id, command_id, custom_data"
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i

function toChatMessage(message: Message): ChatMessage {
  return {
    id: message.id,
    role: message.role as ChatMessage["role"],
    text: message.content,
    timestamp: new Date(message.created_at),
    metadata: withMappedCommandStatus(
      message.custom_data && typeof message.custom_data === "object" && !Array.isArray(message.custom_data)
        ? message.custom_data : undefined,
    ) as ChatMessage["metadata"],
    command_id: message.command_id || undefined,
    sender_id: message.user_id || message.agent_id || message.visitor_id || undefined,
    agent_id: message.agent_id || undefined,
  }
}

export async function getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  if (!conversationId || conversationId.startsWith("new-")) return []
  try {
    const supabase = createClient()
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations").select("custom_data").eq("id", conversationId).maybeSingle()
    if (conversationError || !conversation) return []
    const customData = conversation.custom_data
    const isLegacy = customData?.source == null
    let isComment = isSocialCommentMetadata(customData)

    const loadNonPending = (newestFirst: boolean) => supabase.from("messages")
      .select(MESSAGE_FIELDS).eq("conversation_id", conversationId)
      .or("custom_data->>status.neq.pending,custom_data->>status.is.null")
      .order("created_at", { ascending: !newestFirst })
      .order("id", { ascending: !newestFirst }).limit(40)

    const [pendingResult, initialResult] = await Promise.all([
      supabase.from("messages").select(MESSAGE_FIELDS).eq("conversation_id", conversationId)
        .eq("custom_data->>status", "pending").order("created_at", { ascending: true }).limit(1000),
      loadNonPending(isComment),
    ])
    if (pendingResult.error || initialResult.error) return []
    const pending: Message[] = pendingResult.data || []
    let nonPending: Message[] = initialResult.data || []
    // Legacy conversations have no canonical source marker; use explicit message metadata.
    let hasLegacyComment = !isComment && isLegacy &&
      [...pending, ...nonPending].some(message => isSocialCommentMetadata(message.custom_data))
    if (!isComment && isLegacy && !hasLegacyComment) {
      const { data, error } = await supabase.from("messages").select("id")
        .eq("conversation_id", conversationId).eq("role", "user").eq("custom_data->>source", "comment").limit(1)
      hasLegacyComment = !error && Boolean(data?.length)
    }
    if (hasLegacyComment) {
      isComment = true
      const latestResult = await loadNonPending(true)
      if (latestResult.error) return []
      nonPending = latestResult.data || []
    }
    const seen = new Set<string>()
    const messages = [...pending, ...nonPending].filter(message => {
      if (!message.id || seen.has(message.id)) return false
      seen.add(message.id)
      return true
    }).map(toChatMessage)

    if (isComment) {
      const missingIds = [...new Set(messages.map(message => parseSocialCommentContext(message.metadata)?.replyToMessageId)
        .filter((id): id is string => Boolean(id && UUID.test(id) && !seen.has(id))))]
      const parents: ChatMessage[] = []
      for (let index = 0; index < missingIds.length; index += 100) {
        // User-scoped RLS plus exact conversation scope: never load a foreign parent.
        const { data, error } = await supabase.from("messages").select(MESSAGE_FIELDS)
          .eq("conversation_id", conversationId).in("id", missingIds.slice(index, index + 100)).limit(100)
        if (!error) parents.push(...(data || []).map(toChatMessage))
      }
      for (const message of messages) {
        message.replyContext = resolveCommentReplyContext(message, [...messages, ...parents], true)
      }
    }

    const teamMemberIds = [...new Set(messages.filter(message => message.role === "team_member" && message.sender_id)
      .map(message => message.sender_id as string))]
    const profiles = new Map<string, { name: string; avatar_url: string | null }>()
    if (teamMemberIds.length > 0) {
      const { data, error } = await supabase.from("profiles").select("id, email, name, avatar_url").in("id", teamMemberIds)
      if (!error) for (const profile of data || []) profiles.set(profile.id, {
        name: profile.name || (profile.email ? profile.email.split("@")[0] : "Team Member"),
        avatar_url: profile.avatar_url,
      })
    }
    for (const message of messages) {
      const profile = message.sender_id ? profiles.get(message.sender_id) : undefined
      message.sender_name = message.metadata?.user_name || message.metadata?.sender_name || profile?.name
      message.sender_avatar = message.metadata?.avatar_url || message.metadata?.sender_avatar || profile?.avatar_url || undefined
    }
    return isComment ? orderCommentMessages(messages, customData) : messages
  } catch (error) {
    console.error("Unable to load conversation messages:", error)
    return []
  }
}