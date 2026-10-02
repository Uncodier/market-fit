import { parseSocialCommentContext } from '@/lib/chat/social-comment-context'

type Conversation = { channel?: unknown; custom_data?: unknown }
type Target = { role?: unknown; custom_data?: unknown } | null

export function validateCommentReplyTarget(conversation: Conversation, target: Target): boolean {
  if (!target || target.role !== 'user') return false
  const targetData = target.custom_data as Record<string, unknown> | null
  if (targetData?.source !== 'comment' || targetData.outstand_conversation_id) return false
  const comment = parseSocialCommentContext(target.custom_data)
  if (!comment?.commentId || !comment.postId || !comment.network || !comment.socialAccountId) return false
  const conversationData = conversation.custom_data as Record<string, unknown> | null
  if (conversationData?.outstand_conversation_id ||
    (conversationData?.source != null && conversationData.source !== 'comment')) return false
  const context = parseSocialCommentContext(conversation.custom_data)
  const channel = conversation.channel === 'twitter' ? 'x' : conversation.channel
  if (channel !== comment.network) return false
  // Versioned conversations identify exactly one publisher, post and author.
  // Legacy conversations can hold multiple posts; only the explicitly selected
  // persisted inbound row may supply those dimensions there.
  if (context?.groupingVersion === 1) {
    return Boolean(context.postId && context.socialAccountId && context.authorId && context.network &&
      context.postId === comment.postId && context.socialAccountId === comment.socialAccountId &&
      context.authorId === comment.authorId && context.network === comment.network)
  }
  return true
}