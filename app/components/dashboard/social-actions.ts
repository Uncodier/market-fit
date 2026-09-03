"use server"

import { createClient } from "@/lib/supabase/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value?: string | null): value is string {
  return !!value && UUID_RE.test(value)
}

function toDayRange(startDate: Date | string, endDate: Date | string) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)
  return { start: start.getTime(), end: end.getTime() }
}

export type ContentPerformanceRow = {
  id: string
  site_id: string
  content_id: string | null
  outstand_post_id: string
  likes: number
  comments: number
  shares: number
  views: number
  impressions: number
  reach: number
  engagement_rate: number
  metrics_by_account: Array<Record<string, any>>
  fetched_at: string
  content?: { title?: string | null; status?: string | null; published_at?: string | null } | null
}

function indexSnapshots(rows: ContentPerformanceRow[]) {
  const byContentId: Record<string, ContentPerformanceRow> = {}
  const byPostId: Record<string, ContentPerformanceRow> = {}
  for (const item of rows) {
    if (item.content_id) byContentId[item.content_id] = item
    if (item.outstand_post_id) byPostId[item.outstand_post_id] = item
  }
  return { byContentId, byPostId }
}

async function requireUserClient() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return { supabase: null, error: "Unauthorized" as const }
  }
  return { supabase, error: null }
}

export async function getSocialPerformanceSnapshots(siteId: string) {
  const { supabase, error: authError } = await requireUserClient()
  if (!supabase) return { error: authError, data: [], byContentId: {}, byPostId: {} }

  const { data, error } = await supabase
    .from("content_performance")
    .select("*, content(title, status, published_at)")
    .eq("site_id", siteId)
    .order("fetched_at", { ascending: false })

  if (error) {
    console.error("Error fetching social performance snapshots:", error)
    return { error: error.message, data: [], byContentId: {}, byPostId: {} }
  }

  const rows = (data || []) as ContentPerformanceRow[]
  return { data: rows, ...indexSnapshots(rows) }
}

export async function getSocialPerformanceData(siteId: string, startDate: Date, endDate: Date) {
  const result = await getSocialPerformanceSnapshots(siteId)
  if (result.error) return { error: result.error }

  const { start, end } = toDayRange(startDate, endDate)

  const uniquePosts = (result.data || []).filter((post) => {
    const publishedAt = post.content?.published_at ? new Date(post.content.published_at).getTime() : null
    if (publishedAt != null) return publishedAt >= start && publishedAt <= end
    const fetchedAt = post.fetched_at ? new Date(post.fetched_at).getTime() : null
    return fetchedAt != null && fetchedAt >= start && fetchedAt <= end
  })

  const kpis = {
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    totalViews: 0,
    totalReach: 0,
    avgEngagementRate: 0,
    postCount: uniquePosts.length,
  }

  let engagementSum = 0
  const byNetwork: Record<string, { network: string; views: number; likes: number; comments: number; reach: number }> = {}

  for (const post of uniquePosts) {
    kpis.totalLikes += post.likes || 0
    kpis.totalComments += post.comments || 0
    kpis.totalShares += post.shares || 0
    kpis.totalViews += post.views || 0
    kpis.totalReach += post.reach || 0
    engagementSum += Number(post.engagement_rate) || 0

    for (const acc of post.metrics_by_account || []) {
      const network = String(acc.network || "unknown").toLowerCase()
      if (!byNetwork[network]) {
        byNetwork[network] = { network, views: 0, likes: 0, comments: 0, reach: 0 }
      }
      byNetwork[network].views += acc.views || 0
      byNetwork[network].likes += acc.likes || 0
      byNetwork[network].comments += acc.comments || 0
      byNetwork[network].reach += acc.reach || 0
    }
  }

  if (kpis.postCount > 0) {
    kpis.avgEngagementRate = engagementSum / kpis.postCount
  }

  const ranked = [...uniquePosts].sort((a, b) => (Number(b.engagement_rate) || 0) - (Number(a.engagement_rate) || 0))

  return {
    data: ranked,
    kpis,
    networks: Object.values(byNetwork).sort((a, b) => b.views - a.views),
  }
}

export async function getContentPerformanceForItem(
  siteId: string,
  contentId?: string,
  outstandPostId?: string
) {
  const { supabase, error: authError } = await requireUserClient()
  if (!supabase) return { error: authError, data: null }

  const select = () =>
    supabase
      .from("content_performance")
      .select("*, content(title, status, published_at)")
      .eq("site_id", siteId)
      .order("fetched_at", { ascending: false })
      .limit(1)

  if (isUuid(contentId)) {
    const { data, error } = await select().eq("content_id", contentId).maybeSingle()
    if (error) {
      console.error("Error fetching content performance:", error)
      return { error: error.message, data: null }
    }
    if (data) return { data: data as ContentPerformanceRow }
  }

  if (outstandPostId) {
    const { data, error } = await select().eq("outstand_post_id", outstandPostId).maybeSingle()
    if (error) {
      console.error("Error fetching content performance:", error)
      return { error: error.message, data: null }
    }
    return { data: (data as ContentPerformanceRow) || null }
  }

  return { data: null }
}

export type ContentCommentConversation = {
  id: string
  title: string
  preview: string
  channel: string | null
  last_message_at: string | null
}

export async function getContentCommentConversations(
  siteId: string,
  contentId?: string,
  outstandPostId?: string
) {
  const { supabase, error: authError } = await requireUserClient()
  if (!supabase) return { error: authError, data: [] as ContentCommentConversation[] }

  const filters: string[] = []
  if (isUuid(contentId)) filters.push(`custom_data->>content_id.eq.${contentId}`)
  if (outstandPostId) filters.push(`custom_data->>outstand_post_id.eq."${outstandPostId.replace(/"/g, "")}"`)
  if (filters.length === 0) return { data: [] as ContentCommentConversation[] }

  const { data, error } = await supabase
    .from("messages")
    .select("conversation_id, content, created_at, custom_data, conversations!inner(id, title, last_message_at, channel, site_id, is_archived)")
    .eq("conversations.site_id", siteId)
    .eq("conversations.is_archived", false)
    .or(filters.join(","))
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("Error fetching comment conversations:", error)
    return { error: error.message, data: [] as ContentCommentConversation[] }
  }

  const byConversation = new Map<string, ContentCommentConversation>()
  for (const row of data || []) {
    const conversation = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations
    const conversationId = conversation?.id || row.conversation_id
    if (!conversationId || byConversation.has(conversationId)) continue
    byConversation.set(conversationId, {
      id: conversationId,
      title: conversation?.title || "Comment thread",
      preview: (row.content || "").trim(),
      channel: conversation?.channel || row.custom_data?.origin || null,
      last_message_at: conversation?.last_message_at || row.created_at || null,
    })
  }

  return { data: Array.from(byConversation.values()) }
}
