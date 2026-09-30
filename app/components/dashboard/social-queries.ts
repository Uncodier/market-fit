import "server-only"

import type { createClient } from "@/lib/supabase/server"
import type { ContentPerformanceRow } from "./social-metrics-types"
import type { aggregateTopCommenters } from "./social-commenters"
import { readSocialIdPages } from "./social-paging"
import { compareSocialSnapshots, parseSocialTimestamp } from "./social-trends"

type SocialClient = Awaited<ReturnType<typeof createClient>>

export const SOCIAL_SNAPSHOT_FIELDS = "id, site_id, content_id, outstand_post_id, likes, comments, shares, views, impressions, reach, engagement_rate, metrics_by_account, fetched_at, content(title, status, published_at)"

export function readSocialSnapshots(client: SocialClient, siteId: string) {
  // Publication time can be missing, malformed or unavailable through the content
  // relation. Scan the explicit, bounded cache instead of filtering on fetched_at
  // (which loses old posts refreshed today) or dropping unknown-date coverage.
  // Both selected and previous cohorts are resolved by the pure report builder.
  return readSocialIdPages<ContentPerformanceRow>((cursor, limit) => {
    let query = client.from("content_performance").select(SOCIAL_SNAPSHOT_FIELDS)
      .eq("site_id", siteId).order("id", { ascending: false }).limit(limit)
    if (cursor !== undefined) query = query.lt("id", cursor)
    return query
  })
}

function timestamp(value: string | null | undefined) {
  return parseSocialTimestamp(value)?.getTime() ?? -Infinity
}

export function indexSocialSnapshots(rows: ContentPerformanceRow[]) {
  const data = [...rows].sort(compareSocialSnapshots)
  const byContentId = new Map<string, ContentPerformanceRow>()
  const byPostId = new Map<string, ContentPerformanceRow>()
  for (const row of data) {
    if (row.content_id && !byContentId.has(row.content_id)) byContentId.set(row.content_id, row)
    if (row.outstand_post_id && !byPostId.has(row.outstand_post_id)) byPostId.set(row.outstand_post_id, row)
  }
  return { data, byContentId: Object.fromEntries(byContentId), byPostId: Object.fromEntries(byPostId) }
}

export async function readLatestSocialSnapshot(
  client: SocialClient, siteId: string, field: "content_id" | "outstand_post_id", value: string,
): Promise<ContentPerformanceRow | null> {
  const { data, error } = await client.from("content_performance").select(SOCIAL_SNAPSHOT_FIELDS)
    .eq("site_id", siteId).eq(field, value)
    .order("fetched_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false }).limit(1)
  if (error || (data != null && !Array.isArray(data))) throw new Error("Social snapshot read failed")
  return data?.[0] ?? null
}

type CommentMessage = Parameters<typeof aggregateTopCommenters>[0][number] & { id: string; created_at: string | null }

export function readSocialCommentMessages(client: SocialClient, siteId: string, start: number, end: number) {
  return readSocialIdPages<CommentMessage>((cursor, limit) => {
    let query = client.from("messages")
      .select("id, created_at, custom_data, visitor_id, lead_id, conversations!inner(site_id, channel)")
      .eq("conversations.site_id", siteId)
      .not("custom_data->>outstand_post_id", "is", null).in("role", ["visitor", "user"])
      .gte("created_at", new Date(start).toISOString()).lte("created_at", new Date(end).toISOString())
      .order("id", { ascending: false }).limit(limit)
    if (cursor !== undefined) query = query.lt("id", cursor)
    return query
  })
}

export function socialMessageMetadata(rows: CommentMessage[]) {
  const latest = rows.reduce((value, row) => Math.max(value, timestamp(row.created_at)), -Infinity)
  return { messageCount: rows.length, ...(Number.isFinite(latest) ? { latestMessageAt: new Date(latest).toISOString() } : {}) }
}

export type ContentCommentConversation = {
  id: string
  title: string
  preview: string
  channel: string | null
  last_message_at: string | null
}

type ThreadMessage = {
  id: string
  conversation_id: string
  content: string | null
  created_at: string | null
  custom_data: { origin?: string | null } | null
  conversations: Omit<ContentCommentConversation, "preview"> | Omit<ContentCommentConversation, "preview">[] | null
}

export async function readSocialCommentThreads(
  client: SocialClient, siteId: string, contentId?: string, postId?: string,
): Promise<ContentCommentConversation[]> {
  const matches = async (field: string, value: string): Promise<ThreadMessage[]> => {
    const { data, error } = await client.from("messages")
      .select("id, conversation_id, content, created_at, custom_data, conversations!inner(id, title, last_message_at, channel, site_id, is_archived)")
      .eq("conversations.site_id", siteId).eq("conversations.is_archived", false)
      .eq(field, value).order("created_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false }).limit(50)
    if (error || (data != null && !Array.isArray(data))) throw new Error("Social thread read failed")
    return data ?? []
  }
  // Separate equality predicates keep provider IDs out of PostgREST filter syntax.
  const pages = await Promise.all([
    contentId ? matches("custom_data->>content_id", contentId) : Promise.resolve([]),
    postId ? matches("custom_data->>outstand_post_id", postId) : Promise.resolve([]),
  ])
  const rows = pages.flat().sort((a, b) => {
    const left = timestamp(a.created_at), right = timestamp(b.created_at)
    return (left === right ? 0 : left > right ? -1 : 1) || b.id.localeCompare(a.id)
  })
  const byConversation = new Map<string, ContentCommentConversation>()
  for (const row of rows) {
    const conversation = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations
    const id = conversation?.id || row.conversation_id
    if (!id || byConversation.has(id)) continue
    byConversation.set(id, {
      id, title: conversation?.title || "Comment thread", preview: (row.content || "").trim(),
      channel: conversation?.channel || row.custom_data?.origin || null,
      last_message_at: conversation?.last_message_at || row.created_at || null,
    })
  }
  return [...byConversation.values()].sort((a, b) => {
    const left = timestamp(a.last_message_at), right = timestamp(b.last_message_at)
    return (left === right ? 0 : left > right ? -1 : 1) || b.id.localeCompare(a.id)
  }).slice(0, 50)
}