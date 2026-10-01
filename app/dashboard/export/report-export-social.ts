import { fields, observed, record, type ExportSchema } from "./report-export-projection"

const metrics = ["likes", "comments", "shares", "views", "impressions", "reach", "engagement_rate"]
const missingMetrics = fields(...metrics)
const networkMetrics = ["views", "likes", "comments", "reach"]
const trendMetrics = ["views", "reach", "comments", "likes", "shares", "engagement"]
const trendTotals: ExportSchema = {
  ...fields(...trendMetrics, "postCount", "engagementPostCount"), missingMetricCounts: missingMetrics,
}
const metadata: ExportSchema = {
  ...fields("postCount", "oldestFetchedAt", "newestFetchedAt", "missingFetchedAtCount", "engagementRatePostCount",
    "postsWithAccountMetrics", "postsWithoutAccountMetrics", "accountRowCount", "unidentifiedAccountRowCount",
    "duplicateAccountRowCount", "latestSnapshotCount", "duplicateSnapshotCount", "undatedPostCount",
    "excludedUndatedPosts", "engagementRateConvention", "engagementRateExplanation"),
  missingMetricCounts: missingMetrics,
}
const kpiMetrics: Record<string, string> = {
  totalLikes: "likes", totalComments: "comments", totalShares: "shares", totalViews: "views",
  totalReach: "reach", totalImpressions: "impressions", avgEngagementRate: "engagement_rate",
}

export function socialSchema(section: string): ExportSchema {
  if (section === "posts") return {
    metadata,
    data: [{ ...fields(...metrics, "reportedEngagementRate", "fetched_at"),
      content: fields("title", "status", "published_at") }],
  }
  if (section === "networks") return {
    metadata, kpis: fields("totalComments"),
    networks: [{ ...fields("network", ...networkMetrics), coverage: {
      ...fields("accountRowCount", "identifiedAccountRowCount", "unidentifiedAccountRowCount"),
      missingMetricCounts: fields(...networkMetrics),
    } }],
  }
  return {
    metadata, kpis: fields(...Object.keys(kpiMetrics), "postCount"),
    trends: { current: trendTotals, previous: trendTotals, ...fields("bucketDays", "undatedPostCount"),
      points: [{ ...fields("date", "endDate", "previousDate", "previousEndDate"), current: trendTotals, previous: trendTotals }] },
  }
}

function trendCoverage(input: unknown): unknown {
  if (input == null) return input
  const source = record(input)
  const missing = record(source.missingMetricCounts)
  return { ...source, ...Object.fromEntries(trendMetrics.map(key => [key,
    observed(source[key], missing[key === "engagement" ? "engagement_rate" : key], source.postCount)])) }
}

/** Observed aggregate zero with no metric coverage is unavailable, not measured zero. */
export function socialData(input: unknown): unknown {
  const source = record(input)
  const coverage = record(source.metadata)
  const missing = record(coverage.missingMetricCounts)
  const kpis = record(source.kpis)
  const trends = record(source.trends)
  return {
    ...source,
    kpis: { ...kpis, ...Object.fromEntries(Object.entries(kpiMetrics).map(([key, metric]) => [key,
      observed(kpis[key], missing[metric], coverage.postCount)])) },
    networks: Array.isArray(source.networks) ? source.networks.map(input => {
      const row = record(input)
      const coverage = record(row.coverage)
      const missing = record(coverage.missingMetricCounts)
      return { ...row, ...Object.fromEntries(networkMetrics.map(key => [key,
        observed(row[key], missing[key], coverage.accountRowCount)])) }
    }) : source.networks,
    trends: source.trends == null ? source.trends : {
      ...trends, current: trendCoverage(trends.current), previous: trendCoverage(trends.previous),
      points: Array.isArray(trends.points) ? trends.points.map(input => {
        const point = record(input)
        return { ...point, current: trendCoverage(point.current), previous: trendCoverage(point.previous) }
      }) : trends.points,
    },
  }
}

export const commenterSchema: ExportSchema = [fields("name", "count")]