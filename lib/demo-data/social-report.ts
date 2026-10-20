import { formatInTimeZone } from "date-fns-tz"
import { aggregateTopCommenters } from "@/app/components/dashboard/social-commenters"
import { buildSocialPerformanceReport } from "@/app/components/dashboard/social-metrics"
import { getSocialDateRange, parseSocialTimestamp } from "@/app/components/dashboard/social-trends"
import type { SocialPerformanceReport, SocialPerformanceSnapshotInput } from "@/app/components/dashboard/social-metrics-types"
import { isKnownDemoSite } from "./index"
import { demoReportContext } from "./report-context"
import type { DemoReportRow } from "./report-types"

async function socialContext(siteId: string, startDate: Date, endDate: Date, timeZone: string) {
  if (!isKnownDemoSite(siteId)) throw new Error("Unknown demo site")
  if (typeof timeZone !== "string" || !timeZone || timeZone.length > 100) throw new Error("Invalid time zone")
  const range = getSocialDateRange(startDate, endDate, timeZone)
  const params = new URLSearchParams({
    siteId,
    startDate: formatInTimeZone(startDate, timeZone, "yyyy-MM-dd"),
    endDate: formatInTimeZone(endDate, timeZone, "yyyy-MM-dd"),
  })
  return { ...await demoReportContext(params, 366), range }
}

/** Client-local equivalent of the publication-cohort report, never a Server Action. */
export async function getDemoSocialPerformance(
  siteId: string, startDate: Date, endDate: Date, timeZone = "UTC",
): Promise<SocialPerformanceReport & { error?: undefined }> {
  const { rows } = await socialContext(siteId, startDate, endDate, timeZone)
  const contentMap = new Map(rows("content").map(row => [row.id, row]))
  const snapshots: SocialPerformanceSnapshotInput[] = rows("content_performance").map(row => {
    const contentId = typeof row.content_id === "string" ? row.content_id : null
    const content = contentId ? contentMap.get(contentId) : undefined
    return {
      id: row.id, site_id: siteId, content_id: contentId,
      outstand_post_id: typeof row.outstand_post_id === "string" ? row.outstand_post_id : "",
      fetched_at: typeof row.fetched_at === "string" ? row.fetched_at : "",
      likes: row.likes, comments: row.comments, shares: row.shares, views: row.views,
      impressions: row.impressions, reach: row.reach, engagement_rate: row.engagement_rate,
      metrics_by_account: row.metrics_by_account,
      content: content ? {
        title: content.title, status: content.status,
        published_at: typeof content.published_at === "string" ? content.published_at : null,
      } : null,
    }
  })
  return buildSocialPerformanceReport(snapshots, startDate, endDate, timeZone)
}

/** Comment activity uses message dates, rather than cumulative snapshot comment totals. */
export async function getDemoSocialCommenters(siteId: string, startDate: Date, endDate: Date, timeZone = "UTC") {
  const { data, rows, range } = await socialContext(siteId, startDate, endDate, timeZone)
  const conversationMap = new Map(rows("conversations").map(row => [row.id, row]))
  const messages = ((data.messages || []) as DemoReportRow[]).flatMap(row => {
    const conversation = conversationMap.get(row.conversation_id || "")
    const timestamp = parseSocialTimestamp(row.created_at)?.getTime()
    const customData = row.custom_data as Record<string, unknown> | null | undefined
    if (!conversation || (row.site_id && row.site_id !== siteId) || !["visitor", "user"].includes(row.role || "") ||
      !customData || customData.outstand_post_id == null || timestamp === undefined || timestamp < range.start || timestamp > range.end) return []
    return [{
      id: row.id, created_at: row.created_at, custom_data: customData,
      lead_id: row.lead_id, visitor_id: typeof row.visitor_id === "string" ? row.visitor_id : null,
      conversations: { channel: typeof conversation.channel === "string" ? conversation.channel : null },
    }]
  })
  const latest = messages.reduce((value, row) => Math.max(value, Date.parse(row.created_at)), -Infinity)
  return {
    data: aggregateTopCommenters(messages),
    metadata: { messageCount: messages.length, ...(Number.isFinite(latest) ? { latestMessageAt: new Date(latest).toISOString() } : {}) },
    error: undefined,
  }
}