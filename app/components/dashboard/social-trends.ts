import { isValid, parseISO } from "date-fns"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"
import type { SocialPerformanceSnapshotInput } from "./social-metrics-types"

export type SocialTrendMetric = "views" | "reach" | "engagement" | "comments" | "likes" | "shares"

export type SocialTrendTotals = Record<Exclude<SocialTrendMetric, "engagement">, number> & {
  engagement: number | null
  postCount: number
  engagementPostCount?: number
  missingMetricCounts?: Record<Exclude<SocialTrendMetric, "engagement"> | "engagement_rate", number>
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
  return {
    views: 0, reach: 0, comments: 0, likes: 0, shares: 0, engagement: null, postCount: 0, engagementPostCount: 0,
    missingMetricCounts: { views: 0, reach: 0, comments: 0, likes: 0, shares: 0, engagement_rate: 0 },
  }
}

export function parseSocialMetric(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null
  if (typeof value === "string" && !/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function parseSocialEngagementRate(value: unknown): number | null {
  const rate = parseSocialMetric(value)
  if (rate === null) return null
  // Legacy compatibility only: units are not identified by the cached schema.
  return rate > 1 ? rate / 100 : rate
}

export function sumSocialMetric(total: number, value: number) {
  const sum = total + value
  if (!Number.isFinite(sum)) throw new RangeError("Social metric total exceeds the supported numeric range")
  return sum
}

/** Legacy display wrapper. Aggregates must use the nullable parser instead. */
export function normalizeSocialEngagementRate(value: unknown) {
  return parseSocialEngagementRate(value) ?? 0
}

export function parseSocialTimestamp(value: unknown): Date | null {
  // parseISO alone accepts trailing junk after Z and out-of-range offset hours.
  const timestamp = /^\d{4}-\d{2}-\d{2}(?:[T ](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3])(?::?[0-5]\d)?)?)?$/
  if (typeof value !== "string" || !timestamp.test(value)) return null
  const date = parseISO(value)
  return isValid(date) ? date : null
}

/** Valid sync times sort before unknown ones; equal timestamps use the stable row ID. */
export function compareSocialSnapshots(
  a: Pick<SocialPerformanceSnapshotInput, "fetched_at" | "id">,
  b: Pick<SocialPerformanceSnapshotInput, "fetched_at" | "id">,
) {
  const aTime = parseSocialTimestamp(a.fetched_at)?.getTime() ?? -Infinity
  const bTime = parseSocialTimestamp(b.fetched_at)?.getTime() ?? -Infinity
  if (aTime !== bTime) return aTime > bTime ? -1 : 1
  return a.id === b.id ? 0 : a.id > b.id ? -1 : 1
}

/** Distinct external posts may share content; only site + external post identify a snapshot series. */
export function getLatestSocialSnapshots<T extends SocialPerformanceSnapshotInput>(rows: readonly T[]): T[] {
  const latest = new Map<string, T>()
  const unidentified: T[] = []
  for (const row of rows) {
    if (!row.outstand_post_id) {
      unidentified.push(row)
      continue
    }
    const key = JSON.stringify([row.site_id, row.outstand_post_id])
    const existing = latest.get(key)
    if (!existing || compareSocialSnapshots(row, existing) < 0) latest.set(key, row)
  }
  return [...latest.values(), ...unidentified].sort(compareSocialSnapshots)
}

const DAY_MS = 86_400_000

function calendarDay(date: Date, timeZone: string) {
  return Date.parse(`${formatInTimeZone(date, timeZone, "yyyy-MM-dd")}T00:00:00Z`) / DAY_MS
}

function dateKey(day: number) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

export function getSocialDateRange(startDate: Date, endDate: Date, timeZone: string) {
  if (!isValid(startDate) || !isValid(endDate) || startDate > endDate) throw new RangeError("Invalid social date range")
  const start = calendarDay(startDate, timeZone)
  const end = calendarDay(endDate, timeZone)
  return {
    start: fromZonedTime(`${dateKey(start)}T00:00:00`, timeZone).getTime(),
    end: fromZonedTime(`${dateKey(end + 1)}T00:00:00`, timeZone).getTime() - 1,
  }
}

function addPost(totals: SocialTrendTotals, post: SocialPerformanceSnapshotInput) {
  for (const metric of countMetrics) {
    const value = parseSocialMetric(post[metric])
    if (value === null) totals.missingMetricCounts![metric]++
    else totals[metric] = sumSocialMetric(totals[metric], value)
  }
  const rate = parseSocialEngagementRate(post.engagement_rate)
  if (rate !== null) {
    totals.engagementPostCount = (totals.engagementPostCount ?? 0) + 1
    // Incremental mean avoids summing large rates and never counts missing observations.
    const weight = 1 / totals.engagementPostCount
    totals.engagement = (totals.engagement ?? 0) * (1 - weight) + rate * 100 * weight
  } else totals.missingMetricCounts!.engagement_rate++
  totals.postCount++
}

export function getSocialPostDate(post: Pick<SocialPerformanceSnapshotInput, "content">) {
  const publishedAt = parseSocialTimestamp(post.content?.published_at)
  return publishedAt ? { date: publishedAt, isFallback: false } : null
}

/** Compare latest post totals, not historical activity or changes between syncs. */
export function buildSocialTrends(
  posts: readonly SocialPerformanceSnapshotInput[],
  startDate: Date,
  endDate: Date,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): SocialTrendsData {
  const result: SocialTrendsData = {
    points: [], current: emptyTotals(), previous: emptyTotals(), bucketDays: 1, undatedPostCount: 0,
  }
  if (!isValid(startDate) || !isValid(endDate) || startDate > endDate) return result

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

  for (const post of getLatestSocialSnapshots(posts)) {
    const postDate = getSocialPostDate(post)
    if (!postDate) {
      result.undatedPostCount++
      continue
    }
    const day = calendarDay(postDate.date, timeZone)
    if (day < previousStart || day > end) continue
    const period = day >= start ? "current" : "previous"
    const offset = day - (period === "current" ? start : previousStart)
    const point = result.points[Math.floor(offset / bucketDays)]
    if (!point) continue
    addPost(point[period], post)
    addPost(result[period], post)
  }

  return result
}