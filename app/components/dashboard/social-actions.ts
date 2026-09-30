"use server"

import { aggregateTopCommenters } from "./social-commenters"
import { buildSocialPerformanceReport } from "./social-metrics"
import {
  requireSocialSiteClient, socialActionError, validateSocialItemIds, validateSocialRange,
} from "./social-access"
import {
  indexSocialSnapshots, readLatestSocialSnapshot, readSocialCommentMessages,
  readSocialCommentThreads, readSocialSnapshots, socialMessageMetadata,
} from "./social-queries"
import type { ContentPerformanceRow, SocialPerformanceReport } from "./social-metrics-types"
import type { ContentCommentConversation } from "./social-queries"

// Preserve the imports used by the Content page and performance panel.
export type { ContentPerformanceRow } from "./social-metrics-types"
export type { ContentCommentConversation } from "./social-queries"

type SnapshotResponse = {
  error?: string
  data: ContentPerformanceRow[]
  byContentId: Record<string, ContentPerformanceRow>
  byPostId: Record<string, ContentPerformanceRow>
}
type ReportResponse = (SocialPerformanceReport & { error?: undefined }) | {
  error: string
  data?: undefined
  kpis?: undefined
  networks?: undefined
  trends?: undefined
  metadata?: undefined
}
type CommentersResponse = {
  error?: string
  data: ReturnType<typeof aggregateTopCommenters>
  metadata?: { messageCount: number; latestMessageAt?: string }
}

export async function getSocialPerformanceSnapshots(siteId: string): Promise<SnapshotResponse> {
  try {
    const client = await requireSocialSiteClient(siteId)
    return indexSocialSnapshots(await readSocialSnapshots(client, siteId))
  } catch (error) {
    return {
      error: socialActionError(error, "Unable to load social performance snapshots"),
      data: [] as ContentPerformanceRow[], byContentId: {}, byPostId: {},
    }
  }
}

export async function getSocialPerformanceData(
  siteId: string, startDate: Date, endDate: Date,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): Promise<ReportResponse> {
  try {
    validateSocialRange(startDate, endDate, timeZone)
    const client = await requireSocialSiteClient(siteId)
    const rows = await readSocialSnapshots(client, siteId)
    return buildSocialPerformanceReport(rows, startDate, endDate, timeZone)
  } catch (error) {
    return { error: socialActionError(error, "Unable to load social performance") }
  }
}

export async function getContentPerformanceForItem(
  siteId: string, contentId?: string, outstandPostId?: string,
): Promise<{ error?: string; data: ContentPerformanceRow | null }> {
  try {
    validateSocialItemIds(contentId, outstandPostId)
    const client = await requireSocialSiteClient(siteId)
    if (contentId) {
      const data = await readLatestSocialSnapshot(client, siteId, "content_id", contentId)
      if (data) return { data }
    }
    const data = outstandPostId
      ? await readLatestSocialSnapshot(client, siteId, "outstand_post_id", outstandPostId) : null
    return { data }
  } catch (error) {
    return { error: socialActionError(error, "Unable to load content performance"), data: null }
  }
}

export async function getContentCommentConversations(
  siteId: string, contentId?: string, outstandPostId?: string,
): Promise<{ error?: string; data: ContentCommentConversation[] }> {
  try {
    validateSocialItemIds(contentId, outstandPostId)
    const client = await requireSocialSiteClient(siteId)
    return { data: await readSocialCommentThreads(client, siteId, contentId, outstandPostId) }
  } catch (error) {
    return {
      error: socialActionError(error, "Unable to load comment conversations"),
      data: [] as ContentCommentConversation[],
    }
  }
}

export async function getTopCommentersData(
  siteId: string, startDate: Date, endDate: Date,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): Promise<CommentersResponse> {
  try {
    const { start, end } = validateSocialRange(startDate, endDate, timeZone)
    const client = await requireSocialSiteClient(siteId)
    const rows = await readSocialCommentMessages(client, siteId, start, end)
    return { data: aggregateTopCommenters(rows), metadata: socialMessageMetadata(rows) }
  } catch (error) {
    return { error: socialActionError(error, "Unable to load top commenters"), data: [] }
  }
}