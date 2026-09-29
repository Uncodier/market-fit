import { isValid } from "date-fns"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"
import type { ContentPerformanceRow } from "./social-actions"

export type SocialTrendMetric = "views" | "reach" | "engagement" | "comments" | "likes" | "shares"

export type SocialTrendTotals = Record<Exclude<SocialTrendMetric, "engagement">, number> & {
  engagement: number | null
  postCount: number
}

export type SocialTrendPoint = {
  date: string
  endDate: string
  previousDate: string
  previousEndDate: string
  current: SocialTrendTotals
  previous: SocialTrendTotals
}

export type SocialTrendsData = {
  points: SocialTrendPoint[]
  current: SocialTrendTotals
  previous: SocialTrendTotals
  bucketDays: number
  undatedPostCount: number
}

const countMetrics = ["views", "reach", "comments", "likes", "shares"] as const

function emptyTotals(): SocialTrendTotals {
  return { views: 0, reach: 0, comments: 0, likes: 0, shares: 0, engagement: null, postCount: 0 }
}

function safeNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

export function normalizeSocialEngagementRate(value: unknown) {
  const rate = safeNumber(value)
  // Preserve the provider convention already supported by the Social UI.
  return rate > 1 ? rate / 100 : rate
}

const DAY_MS = 86_400_000

function calendarDay(date: Date, timeZone: string) {
  return Date.parse(`${formatInTimeZone(date, timeZone, "yyyy-MM-dd")}T00:00:00Z`) / DAY_MS
}

function dateKey(day: number) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

export function getSocialDateRange(startDate: Date, endDate: Date, timeZone: string) {
  const start = calendarDay(startDate, timeZone)
  const end = calendarDay(endDate, timeZone)
  return {
    start: fromZonedTime(`${dateKey(start)}T00:00:00`, timeZone).getTime(),
    end: fromZonedTime(`${dateKey(end + 1)}T00:00:00`, timeZone).getTime() - 1,
  }
}

function addPost(totals: SocialTrendTotals, post: ContentPerformanceRow) {
  for (const metric of countMetrics) totals[metric] += safeNumber(post[metric])
  totals.engagement = (totals.engagement ?? 0) + normalizeSocialEngagementRate(post.engagement_rate) * 100
  totals.postCount++
}

function averageEngagement(totals: SocialTrendTotals) {
  if (totals.postCount > 0) totals.engagement = (totals.engagement ?? 0) / totals.postCount
}

export function getSocialPostDate(post: ContentPerformanceRow) {
  const publishedAt = post.content?.published_at ? new Date(post.content.published_at) : null
  if (publishedAt && isValid(publishedAt)) return { date: publishedAt, isFallback: false }
  const fetchedAt = new Date(post.fetched_at)
  return isValid(fetchedAt) ? { date: fetchedAt, isFallback: true } : null
}

/** Compare latest post totals, not historical activity or changes between syncs. */
export function buildSocialTrends(
  posts: ContentPerformanceRow[],
  startDate: Date,
  endDate: Date,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): SocialTrendsData {
  const result: SocialTrendsData = {
    points: [], current: emptyTotals(), previous: emptyTotals(), bucketDays: 1, undatedPostCount: 0,
  }
  if (!isValid(startDate) || !isValid(endDate)) return result

  const start = calendarDay(startDate, timeZone)
  const end = calendarDay(endDate, timeZone)
  const dayCount = end - start + 1
  if (dayCount <= 0) return result

  const previousStart = start - dayCount
  // Keep long ranges readable and bounded, using equally sized comparison buckets.
  const bucketDays = dayCount <= 45 ? 1 : dayCount <= 180 ? 7 : Math.max(30, Math.ceil(dayCount / 60))
  result.bucketDays = bucketDays

  for (let offset = 0; offset < dayCount; offset += bucketDays) {
    const lastOffset = Math.min(offset + bucketDays - 1, dayCount - 1)
    result.points.push({
      date: dateKey(start + offset),
      endDate: dateKey(start + lastOffset),
      previousDate: dateKey(previousStart + offset),
      previousEndDate: dateKey(previousStart + lastOffset),
      current: emptyTotals(),
      previous: emptyTotals(),
    })
  }

  for (const post of posts) {
    const postDate = getSocialPostDate(post)
    if (!postDate) continue
    const day = calendarDay(postDate.date, timeZone)
    if (day < previousStart || day > end) continue
    const period = day >= start ? "current" : "previous"
    const offset = day - (period === "current" ? start : previousStart)
    const point = result.points[Math.floor(offset / bucketDays)]
    if (!point) continue
    addPost(point[period], post)
    addPost(result[period], post)
    if (postDate.isFallback) result.undatedPostCount++
  }

  for (const point of result.points) {
    averageEngagement(point.current)
    averageEngagement(point.previous)
  }
  averageEngagement(result.current)
  averageEngagement(result.previous)
  return result
}