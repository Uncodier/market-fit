/** Display metadata only. These helpers never authorize a provider reply or a tenant. */
export interface SocialCommentContext {
  network?: string
  socialAccountId?: string
  publisherUsername?: string
  postId?: string
  platformPostId?: string
  contentId?: string
  postUrl?: string
  postTitle?: string
  postText?: string
  authorId?: string
  authorName?: string
  commentId?: string
  commentUrl?: string
  parentCommentId?: string
  replyToMessageId?: string
  replyToCommentId?: string
  groupingVersion?: number
}

export interface SocialCommentReplyContext {
  availability: "available" | "unavailable"
  messageId?: string
  commentId?: string
  text?: string
  authorName?: string
  url?: string
}

export interface CommentContextMessage {
  id?: string
  role: string
  text: string
  metadata?: unknown
  replyContext?: SocialCommentReplyContext
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

function text(value: unknown, maxLength = 10000): string | undefined {
  return typeof value === "string" && value.length <= maxLength
    ? value.trim() || undefined : undefined
}

function identifier(value: unknown): string | undefined {
  const candidate = typeof value === "number" && Number.isSafeInteger(value)
    ? String(value) : text(value, 512)
  return candidate && !/[\s\u0000-\u001f\u007f]/.test(candidate) ? candidate : undefined
}

function participantName(value: unknown): string | undefined {
  const name = text(value, 300)
  return name && !/^(?:visitor|social user|unknown|anonymous)$/i.test(name) &&
    !/^(?:https?:\/\/|urn:)/i.test(name) && !/^\d+$/.test(name) ? name : undefined
}

const SOCIAL_HOSTS = [
  "instagram.com", "facebook.com", "fb.com", "threads.net", "threads.com",
  "linkedin.com", "twitter.com", "x.com", "youtube.com", "youtu.be", "tiktok.com",
  "pinterest.com", "bsky.app", "reddit.com",
]

/** Links only: no arbitrary origins, credentials, non-HTTPS protocols or unusual ports. */
export function getSafeSocialUrl(value: unknown): string | undefined {
  const candidate = text(value, 4096)
  if (!candidate || /[\u0000-\u0020\u007f\\]/.test(candidate)) return undefined
  try {
    const url = new URL(candidate)
    if (url.protocol !== "https:" || url.username || url.password || url.port) return undefined
    if (!SOCIAL_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
      return undefined
    }
    return url.href
  } catch { return undefined }
}

export function getCommentContentHref(contentId: unknown, postId?: unknown): string | undefined {
  const content = identifier(contentId)
  if (content && /^[a-z\d_-]+$/i.test(content)) return `/content/${encodeURIComponent(content)}`
  const post = identifier(postId)
  return post ? `/content?search=${encodeURIComponent(post)}` : undefined
}

export function isSocialCommentMetadata(value: unknown): boolean {
  const data = record(value)
  if (data.source != null && data.source !== "comment") return false
  return data.source === "comment" || Boolean(identifier(data.outstand_post_id))
}

export function parseSocialCommentContext(value: unknown): SocialCommentContext | undefined {
  if (!isSocialCommentMetadata(value)) return undefined
  const data = record(value)
  const rawNetwork = (text(data.network, 40) || text(data.channel, 40))?.toLowerCase()
  const network = rawNetwork === "twitter" ? "x" : rawNetwork
  return {
    network,
    socialAccountId: identifier(data.publisher_account_id),
    publisherUsername: text(data.publisher_username, 200),
    postId: identifier(data.outstand_post_id),
    platformPostId: identifier(data.platform_post_id),
    contentId: identifier(data.content_id),
    postUrl: getSafeSocialUrl(data.platform_post_url),
    postTitle: text(data.post_title, 500),
    postText: text(data.post_text),
    authorId: identifier(data.author_id),
    // LinkedIn names are resolved on read, never taken from persisted provider metadata.
    authorName: network === "linkedin" ? undefined : participantName(data.author_name) ||
      participantName(data.author_username) || participantName(data.social_handle),
    commentId: identifier(data.platform_comment_id),
    commentUrl: getSafeSocialUrl(data.platform_comment_url),
    parentCommentId: identifier(data.parent_comment_id),
    replyToMessageId: identifier(data.reply_to_message_id),
    replyToCommentId: identifier(data.reply_to_comment_id),
    groupingVersion: data.comment_grouping_version === 1 ? 1 : undefined,
  }
}

export function hasCommentContextConflict(left: SocialCommentContext, right: SocialCommentContext): boolean {
  return (["network", "socialAccountId", "postId", "platformPostId"] as const)
    .some(key => Boolean(left[key] && right[key] && left[key] !== right[key]))
}

export function isSocialCommentConversation(customData: unknown, messages: CommentContextMessage[]): boolean {
  const source = record(customData).source
  if (source != null && source !== "comment") return false
  return isSocialCommentMetadata(customData) || messages.some(message => isSocialCommentMetadata(message.metadata))
}

/** A legacy loaded page cannot establish that the whole conversation has only one post. */
export function getConversationPostContext(
  customData: unknown,
  messages: CommentContextMessage[],
): SocialCommentContext | undefined {
  const context = parseSocialCommentContext(customData)
  if (!context || context.groupingVersion !== 1 || !context.postId || !context.network ||
      !context.socialAccountId || !context.authorId) return undefined
  const conflicting = messages.some(message => {
    const source = record(message.metadata).source
    if (source != null && source !== "comment") return true
    const messageContext = parseSocialCommentContext(message.metadata)
    return messageContext && (hasCommentContextConflict(context, messageContext) ||
      Boolean(messageContext.authorId && messageContext.authorId !== context.authorId))
  })
  return conflicting ? undefined : context
}

export function getCommentPostReference(context: SocialCommentContext): string {
  return context.postTitle || context.postText?.slice(0, 100) ||
    (context.platformPostId || context.postId ? `Post ${context.platformPostId || context.postId}` : "Post unavailable")
}

function isReplyRole(role: string): boolean {
  return role === "assistant" || role === "agent" || role === "team_member"
}

/** Resolve exact identifiers only; chronological proximity is never reply evidence. */
export function resolveCommentReplyContext(
  message: CommentContextMessage,
  messages: CommentContextMessage[] = [],
  commentConversation = false,
): SocialCommentReplyContext | undefined {
  const source = record(message.metadata).source
  if (source != null && source !== "comment") return undefined
  const context = parseSocialCommentContext(message.metadata)
  if (!context && !commentConversation) return undefined
  const messageId = context?.replyToMessageId
  const commentId = context?.replyToCommentId || context?.parentCommentId
  if (!messageId && !commentId && !isReplyRole(message.role)) return undefined
  const unavailable: SocialCommentReplyContext = { availability: "unavailable", messageId, commentId }

  const cached = message.replyContext
  if (cached?.availability === "available" && messageId && cached.messageId === messageId &&
      (!commentId || cached.commentId === commentId) && text(cached.text)) {
    return { ...cached, url: getSafeSocialUrl(cached.url) }
  }
  const candidates = messages.filter(candidate => {
    if (candidate === message || (message.id && candidate.id === message.id)) return false
    if (messageId && candidate.id !== messageId) return false
    const target = parseSocialCommentContext(candidate.metadata)
    if (!target || (context && hasCommentContextConflict(context, target))) return false
    if (messageId) return candidate.id === messageId && (!commentId || target.commentId === commentId)
    // Provider IDs alone are not globally unique; require the complete post/account scope.
    return Boolean(commentId && context?.postId && context.network && context.socialAccountId &&
      target.postId === context.postId && target.network === context.network &&
      target.socialAccountId === context.socialAccountId && target.commentId === commentId)
  })
  if (candidates.length !== 1 || !text(candidates[0].text)) return unavailable
  const target = candidates[0]
  const targetContext = parseSocialCommentContext(target.metadata)!
  return {
    availability: "available",
    messageId: target.id,
    commentId: targetContext.commentId,
    text: target.text,
    authorName: targetContext.authorName,
    url: targetContext.commentUrl,
  }
}

/** Chronological roots and siblings; exact replies stay directly below their parent. */
export function orderCommentMessages<T extends CommentContextMessage & { timestamp: Date }>(
  messages: T[],
  customData?: unknown,
): T[] {
  if (!isSocialCommentConversation(customData, messages)) return messages
  const chronological = messages.map((message, index) => ({ message, index })).sort((left, right) => {
    const a = new Date(left.message.timestamp).getTime()
    const b = new Date(right.message.timestamp).getTime()
    return (Number.isFinite(a) && Number.isFinite(b) ? a - b : 0) || left.index - right.index
  }).map(({ message }) => message)
  const children = new Map<number, number[]>()
  const hasParent = new Set<number>()
  chronological.forEach((message, index) => {
    const reply = resolveCommentReplyContext({ ...message, replyContext: undefined }, chronological)
    if (reply?.availability !== "available" || !reply.messageId) return
    const parentIndexes = chronological.map((parent, parentIndex) => parent.id === reply.messageId ? parentIndex : -1)
      .filter(parentIndex => parentIndex >= 0 && parentIndex !== index)
    if (parentIndexes.length !== 1) return
    const parentIndex = parentIndexes[0]
    children.set(parentIndex, [...(children.get(parentIndex) || []), index])
    hasParent.add(index)
  })
  const ordered: T[] = []
  const visited = new Set<number>()
  const visit = (start: number) => {
    const stack = [start]
    while (stack.length) {
      const index = stack.pop()!
      if (visited.has(index)) continue
      visited.add(index)
      ordered.push(chronological[index])
      stack.push(...[...(children.get(index) || [])].reverse())
    }
  }
  chronological.forEach((_, index) => { if (!hasParent.has(index)) visit(index) })
  // Malformed cycles are displayed exactly once instead of disappearing or recursing forever.
  chronological.forEach((_, index) => visit(index))
  return ordered
}