import type { SocialTrendsData } from "./social-trends"

/** Compatibility type for cached snapshot consumers outside the report. */
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

export type SocialCountMetric = "likes" | "comments" | "shares" | "views" | "impressions" | "reach"
export type SocialMetric = SocialCountMetric | "engagement_rate"
export type SocialNetworkMetric = "views" | "likes" | "comments" | "reach"

/** Database JSON and legacy numeric strings must be validated before aggregation. */
export type SocialPerformanceSnapshotInput = Omit<ContentPerformanceRow, SocialMetric | "metrics_by_account"> &
  Partial<Record<SocialMetric, unknown>> & { metrics_by_account?: unknown }

export type SocialPerformancePost = Omit<ContentPerformanceRow, SocialMetric | "metrics_by_account"> &
  Record<SocialMetric, number | null> & {
    reportedEngagementRate: number | null
    metrics_by_account: Record<string, unknown>[]
  }

export type SocialNetworkCoverage = {
  accountRowCount: number
  identifiedAccountRowCount: number
  unidentifiedAccountRowCount: number
  missingMetricCounts: Record<SocialNetworkMetric, number>
}

export type SocialNetworkPerformance = Record<SocialNetworkMetric, number> & {
  network: string
  coverage: SocialNetworkCoverage
}

export type SocialPerformanceMetadata = {
  /** Current publication cohort; freshness describes its latest cached snapshots. */
  postCount: number
  oldestFetchedAt: string | null
  newestFetchedAt: string | null
  missingFetchedAtCount: number
  missingMetricCounts: Record<SocialMetric, number>
  engagementRatePostCount: number
  postsWithAccountMetrics: number
  postsWithoutAccountMetrics: number
  accountRowCount: number
  unidentifiedAccountRowCount: number
  duplicateAccountRowCount: number
  /** Global cached snapshot coverage: undated posts cannot be assigned to a cohort. */
  latestSnapshotCount: number
  duplicateSnapshotCount: number
  undatedPostCount: number
  excludedUndatedPosts: number
  engagementRateConvention: "legacy_ratio_or_percent"
  engagementRateExplanation: string
}

export type SocialPerformanceReport = {
  data: SocialPerformancePost[]
  kpis: {
    totalLikes: number
    totalComments: number
    totalShares: number
    totalViews: number
    totalReach: number
    totalImpressions: number
    avgEngagementRate: number | null
    postCount: number
  }
  networks: SocialNetworkPerformance[]
  trends: SocialTrendsData
  metadata: SocialPerformanceMetadata
}