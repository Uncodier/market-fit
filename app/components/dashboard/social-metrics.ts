import type {
  SocialCountMetric, SocialMetric, SocialNetworkPerformance, SocialPerformanceMetadata,
  SocialPerformancePost, SocialPerformanceReport, SocialPerformanceSnapshotInput,
} from "./social-metrics-types"
import {
  buildSocialTrends, compareSocialSnapshots, getLatestSocialSnapshots, getSocialDateRange,
  getSocialPostDate, parseSocialEngagementRate, parseSocialMetric, parseSocialTimestamp, sumSocialMetric,
} from "./social-trends"

const countMetrics: SocialCountMetric[] = ["views", "likes", "comments", "reach", "shares", "impressions"]
const networkMetrics = ["views", "likes", "comments", "reach"] as const
const allMetrics: SocialMetric[] = [...countMetrics, "engagement_rate"]

function emptyMissingCounts(): Record<SocialMetric, number> {
  return { views: 0, likes: 0, comments: 0, reach: 0, shares: 0, impressions: 0, engagement_rate: 0 }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function normalizeSocialNetwork(value: unknown): string {
  const network = typeof value === "string" ? value.trim().toLowerCase() : ""
  return network === "twitter" ? "x" : network || "unknown"
}

function accountIdentity(account: Record<string, unknown>): string | null {
  for (const value of [account.account_id, account.accountId, account.id]) {
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return null
}

function accountFetchedAt(account: Record<string, unknown>): number | null {
  return (parseSocialTimestamp(account.fetched_at) ?? parseSocialTimestamp(account.fetchedAt))?.getTime() ?? null
}

/** Account identity is scoped to one external post and network, never across distinct posts. */
function selectAccounts(value: unknown) {
  const rows = Array.isArray(value) ? value.filter(record) : []
  const selected: Record<string, unknown>[] = []
  const index = new Map<string, number>()
  let duplicateCount = 0
  for (const row of rows) {
    const identity = accountIdentity(row)
    const key = identity === null ? null : JSON.stringify([normalizeSocialNetwork(row.network), identity])
    const position = key === null ? undefined : index.get(key)
    if (position === undefined) {
      if (key !== null) index.set(key, selected.length)
      selected.push(row)
      continue
    }
    duplicateCount++
    const time = accountFetchedAt(row)
    const previousTime = accountFetchedAt(selected[position])
    // Without an explicit newer timestamp, retain the first row in the cached JSON array.
    if (time !== null && (previousTime === null || time > previousTime)) selected[position] = row
  }
  return { rows: selected, duplicateCount }
}

function resolvePost(post: SocialPerformanceSnapshotInput, accounts: Record<string, unknown>[]): SocialPerformancePost {
  return {
    id: post.id, site_id: post.site_id, content_id: post.content_id,
    outstand_post_id: post.outstand_post_id, content: post.content, fetched_at: post.fetched_at,
    views: parseSocialMetric(post.views), likes: parseSocialMetric(post.likes),
    comments: parseSocialMetric(post.comments), shares: parseSocialMetric(post.shares),
    reach: parseSocialMetric(post.reach), impressions: parseSocialMetric(post.impressions),
    engagement_rate: parseSocialMetric(post.engagement_rate),
    reportedEngagementRate: parseSocialEngagementRate(post.engagement_rate),
    metrics_by_account: accounts.map((account) => ({
      ...account, network: normalizeSocialNetwork(account.network),
      views: parseSocialMetric(account.views), likes: parseSocialMetric(account.likes),
      comments: parseSocialMetric(account.comments), reach: parseSocialMetric(account.reach),
    })),
  }
}

function addNetworkAccounts(
  accounts: Record<string, unknown>[],
  networks: Map<string, SocialNetworkPerformance>,
  metadata: SocialPerformanceMetadata,
) {
  if (accounts.length > 0) metadata.postsWithAccountMetrics++
  else metadata.postsWithoutAccountMetrics++
  for (const account of accounts) {
    const network = normalizeSocialNetwork(account.network)
    let group = networks.get(network)
    if (!group) {
      group = {
        network, views: 0, likes: 0, comments: 0, reach: 0,
        coverage: {
          accountRowCount: 0, identifiedAccountRowCount: 0, unidentifiedAccountRowCount: 0,
          missingMetricCounts: { views: 0, likes: 0, comments: 0, reach: 0 },
        },
      }
      networks.set(network, group)
    }
    metadata.accountRowCount++
    group.coverage.accountRowCount++
    if (accountIdentity(account) === null) {
      metadata.unidentifiedAccountRowCount++
      group.coverage.unidentifiedAccountRowCount++
    } else group.coverage.identifiedAccountRowCount++
    for (const metric of networkMetrics) {
      const value = parseSocialMetric(account[metric])
      if (value === null) group.coverage.missingMetricCounts[metric]++
      else group[metric] = sumSocialMetric(group[metric], value)
    }
  }
}

function updateFreshness(metadata: SocialPerformanceMetadata, fetchedAt: string) {
  const timestamp = parseSocialTimestamp(fetchedAt)
  if (!timestamp) {
    metadata.missingFetchedAtCount++
    return
  }
  const iso = timestamp.toISOString()
  if (metadata.oldestFetchedAt === null || iso < metadata.oldestFetchedAt) metadata.oldestFetchedAt = iso
  if (metadata.newestFetchedAt === null || iso > metadata.newestFetchedAt) metadata.newestFetchedAt = iso
}

/** Latest cached cumulative totals for publication cohorts, not activity during the selected dates. */
export function buildSocialPerformanceReport(
  rows: readonly SocialPerformanceSnapshotInput[],
  startDate: Date,
  endDate: Date,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): SocialPerformanceReport {
  const { start, end } = getSocialDateRange(startDate, endDate, timeZone)
  const latest = getLatestSocialSnapshots(rows)
  const trends = buildSocialTrends(latest, startDate, endDate, timeZone)
  const current = latest.filter((post) => {
    const timestamp = getSocialPostDate(post)?.date.getTime()
    return timestamp !== undefined && timestamp >= start && timestamp <= end
  })
  const metadata: SocialPerformanceMetadata = {
    postCount: current.length, oldestFetchedAt: null, newestFetchedAt: null, missingFetchedAtCount: 0,
    missingMetricCounts: emptyMissingCounts(), engagementRatePostCount: 0,
    postsWithAccountMetrics: 0, postsWithoutAccountMetrics: 0, accountRowCount: 0,
    unidentifiedAccountRowCount: 0, duplicateAccountRowCount: 0,
    latestSnapshotCount: latest.length, duplicateSnapshotCount: rows.length - latest.length,
    undatedPostCount: trends.undatedPostCount, excludedUndatedPosts: trends.undatedPostCount,
    engagementRateConvention: "legacy_ratio_or_percent",
    engagementRateExplanation: "Legacy compatibility: values greater than 1 are divided by 100; values from 0 to 1 are kept as ratios. Cached data does not identify units or provider formulas. Averages include only observed rates and are unweighted by reach or views.",
  }
  const networks = new Map<string, SocialNetworkPerformance>()
  const data = current.map((post) => {
    const accounts = selectAccounts(post.metrics_by_account)
    metadata.duplicateAccountRowCount += accounts.duplicateCount
    const resolved = resolvePost(post, accounts.rows)
    updateFreshness(metadata, post.fetched_at)
    for (const metric of allMetrics) if (resolved[metric] === null) metadata.missingMetricCounts[metric]++
    if (resolved.reportedEngagementRate !== null) metadata.engagementRatePostCount++
    addNetworkAccounts(resolved.metrics_by_account, networks, metadata)
    return resolved
  }).sort((a, b) => {
    if (a.reportedEngagementRate === null && b.reportedEngagementRate !== null) return 1
    if (a.reportedEngagementRate !== null && b.reportedEngagementRate === null) return -1
    return (b.reportedEngagementRate ?? 0) - (a.reportedEngagementRate ?? 0) || compareSocialSnapshots(a, b)
  })
  return {
    data,
    kpis: {
      totalLikes: trends.current.likes, totalComments: trends.current.comments, totalShares: trends.current.shares,
      totalViews: trends.current.views, totalReach: trends.current.reach,
      totalImpressions: data.reduce((sum, post) => sumSocialMetric(sum, post.impressions ?? 0), 0),
      avgEngagementRate: trends.current.engagement === null ? null : trends.current.engagement / 100,
      postCount: current.length,
    },
    networks: [...networks.values()].sort((a, b) => b.views - a.views || (a.network > b.network ? 1 : -1)),
    trends,
    metadata,
  }
}