type CommentMessage = {
  id?: string
  custom_data: unknown
  lead_id?: string | null
  visitor_id?: string | null
  conversations?: { channel?: string | null } | { channel?: string | null }[] | null
}

type Commenter = { id: string; name: string; avatar: string | null; count: number }

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null
}

function providerId(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : text(value)
}

function avatarUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null
  } catch { return null }
}

export function aggregateTopCommenters(rows: CommentMessage[]): Commenter[] {
  const commenters = new Map<string, Commenter>()
  const seenMessages = new Set<string>()
  const seenProviderComments = new Set<string>()

  for (const row of rows) {
    // Repeated synchronization/page rows must not increase a commenter's activity.
    if (row.id) {
      if (seenMessages.has(row.id)) continue
      seenMessages.add(row.id)
    }
    const metadata = record(row.custom_data)
    const author = record(metadata.author)
    const from = record(metadata.from)
    const conversation = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations
    const rawNetwork = (text(metadata.network) || text(metadata.channel) || text(conversation?.channel)
      || text(metadata.origin) || "unknown").toLowerCase()
    const network = rawNetwork === "twitter" ? "x" : rawNetwork
    const providerCommentId = providerId(metadata.platform_comment_id) || providerId(metadata.comment_id)
    const postId = providerId(metadata.outstand_post_id) || providerId(metadata.post_id)
    if (providerCommentId && postId) {
      const commentKey = JSON.stringify([network, postId, providerCommentId])
      if (seenProviderComments.has(commentKey)) continue
      seenProviderComments.add(commentKey)
    }
    // Top-level username belongs to the owned account, not the commenter.
    const handle = text(metadata.social_handle) || text(author.username) || text(from.username)
    const authorName = text(metadata.author_name) || text(author.name) || text(from.name)
      || text(metadata.author) || text(metadata.from)
    const authorId = providerId(metadata.author_id) || providerId(author.id) || providerId(from.id)
    const profileUrl = text(metadata.profile_url)
    const leadId = text(row.lead_id)
    const visitorId = text(row.visitor_id)
    let id: string
    if (authorId) id = `author:${network}:${authorId}`
    else if (leadId) id = `lead:${leadId}`
    else if (visitorId) id = `visitor:${visitorId}`
    else if (handle) id = `handle:${network}:${handle.toLowerCase()}`
    else if (profileUrl) id = `profile:${network}:${profileUrl}`
    else if (authorName) id = `name:${network}:${authorName}`
    else continue // A post/account reference alone does not identify a commenter.

    const name = authorName || handle || "Anonymous Visitor"
    const avatar = avatarUrl(text(author.avatar) || text(from.avatar) || text(metadata.avatar)
      || text(metadata.profile_image_url))
    const existing = commenters.get(id)
    if (existing) {
      existing.count++
      if (authorName || existing.name === "Anonymous Visitor") existing.name = name
      if (!existing.avatar) existing.avatar = avatar
    } else {
      commenters.set(id, { id, name, avatar, count: 1 })
    }
  }

  return Array.from(commenters.values()).sort((a, b) => b.count - a.count).slice(0, 5)
}