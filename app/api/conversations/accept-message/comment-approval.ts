import { z } from 'zod'
import { validateCommentReplyTarget } from '@/app/api/agents/chat/intervention/comment-reply-preflight'

export type Metadata = Record<string, unknown>
export type ApprovalConversation = {
  id: string
  site_id: string
  channel?: unknown
  status?: unknown
  custom_data?: unknown
}
export type ApprovalMessage = {
  id: string
  conversation_id: string
  role: string
  custom_data?: unknown
}

export function metadata(value: unknown): Metadata {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Metadata : {}
}

function identifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512 &&
    !/[\s\u0000-\u001f\u007f]/.test(value)
}

function network(value: unknown): string {
  const name = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return name === 'twitter' ? 'x' : name
}

const COMMENT_NETWORKS = new Set(['facebook', 'instagram', 'threads', 'linkedin', 'x', 'youtube'])

export function needsCommentApproval(data: Metadata, conversation: ApprovalConversation): boolean {
  const context = metadata(conversation.custom_data)
  return data.source === 'comment' || context.source === 'comment' ||
    context.comment_grouping_version === 1 ||
    (!data.source && Boolean(data.reply_to_message_id || data.reply_to_comment_id || data.platform_comment_id || data.outstand_post_id))
}

export function mayHaveLegacyComments(conversation: ApprovalConversation): boolean {
  const context = metadata(conversation.custom_data)
  return !context.source && !context.outstand_conversation_id && COMMENT_NETWORKS.has(network(conversation.channel))
}

export function commentTargetId(data: Metadata): string | null {
  const parsed = z.string().uuid().safeParse(data.reply_to_message_id)
  return parsed.success && identifier(data.reply_to_comment_id) ? parsed.data : null
}

/** The caller must load both rows with user RLS and an authorized site scope. */
export function validCommentApproval(
  conversation: ApprovalConversation,
  message: ApprovalMessage,
  target: ApprovalMessage | null,
): boolean {
  const data = metadata(message.custom_data)
  const source = metadata(target?.custom_data)
  const context = metadata(conversation.custom_data)
  const targetId = commentTargetId(data)
  if (!target || !targetId || target.id !== targetId || message.id === target.id ||
    message.conversation_id !== conversation.id || target.conversation_id !== conversation.id ||
    !['assistant', 'team_member'].includes(message.role) || data.source !== 'comment' ||
    data.outstand_conversation_id || !validateCommentReplyTarget(conversation, target)) return false

  // Do not use the display parser as authorization or copy any routing fields.
  const channel = network(conversation.channel)
  if (!COMMENT_NETWORKS.has(channel) || data.network !== channel ||
    data.reply_to_comment_id !== source.platform_comment_id) return false
  for (const item of [data, source, ...(context.comment_grouping_version === 1 ? [context] : [])]) {
    if (item.network != null && network(item.network) !== channel) return false
    if (item.channel != null && network(item.channel) !== channel) return false
    if (!identifier(item.publisher_account_id) || !identifier(item.outstand_post_id) ||
      !/^[A-Za-z0-9_-]{1,200}$/.test(item.outstand_post_id)) return false
  }
  for (const key of ['publisher_account_id', 'outstand_post_id', 'author_id', 'platform_post_id']) {
    if (data[key] !== source[key]) return false
    if (data[key] !== undefined && !identifier(data[key])) return false
  }
  if (context.comment_grouping_version === 1) {
    if (context.source !== 'comment' || context.network !== channel || !identifier(context.author_id)) return false
    for (const key of ['publisher_account_id', 'outstand_post_id', 'author_id']) {
      if (context[key] !== source[key]) return false
    }
  }
  return true
}

export function acceptedMetadata(data: Metadata, conversation: ApprovalConversation, comment: boolean): Metadata {
  // A comment source is a discriminator, never a channel. Preserve saved routing.
  if (comment || data.channel) return { ...data, status: 'accepted' }
  const context = metadata(conversation.custom_data)
  const channel = network(data.source || conversation.channel || context.channel)
  return { ...data, status: 'accepted', ...(channel && channel !== 'comment' ? { channel } : {}) }
}