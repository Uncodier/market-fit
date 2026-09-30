"use client"

import { Button } from "@/app/components/ui/button"
import { ReportDetails } from "./report-layout"

export type SocialCoverage = {
  postCount: number
  excludedUndatedPosts: number
  oldestFetchedAt: string | null
  newestFetchedAt: string | null
  missingFetchedAtCount: number
  missingMetricCounts: Record<string, number>
  engagementRatePostCount: number
  postsWithAccountMetrics: number
  postsWithoutAccountMetrics: number
  duplicateSnapshotCount: number
  duplicateAccountRowCount: number
  engagementRateExplanation: string
}

export function SocialDataQuality({ metadata, refreshing, refresh }: {
  metadata?: SocialCoverage
  refreshing: boolean
  refresh: () => void
}) {
  if (!metadata) return null
  const formatTime = (value: string | null) => {
    if (!value || !Number.isFinite(Date.parse(value))) return "Not available"
    return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC"
  }
  const missing = Object.entries(metadata.missingMetricCounts).filter(([, count]) => count > 0)
  return (
    <section aria-label="Social data coverage" className="flex min-w-0 flex-col items-start gap-3 border-t pt-3 sm:flex-row sm:justify-between">
      <ReportDetails summary={`Data coverage · ${metadata.postCount.toLocaleString("en-US")} dated posts${missing.length ? " · Incomplete metrics" : ""}`} className="w-full border-t-0 pt-0">
        <p>{metadata.postsWithAccountMetrics.toLocaleString("en-US")} with network detail · {metadata.engagementRatePostCount.toLocaleString("en-US")} with a reported engagement rate</p>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Newest stored sync</dt><dd>{formatTime(metadata.newestFetchedAt)}</dd></div>
          <div><dt className="text-muted-foreground">Oldest stored sync</dt><dd>{formatTime(metadata.oldestFetchedAt)}</dd></div>
        </dl>
        <p>Refreshing reloads stored metrics; it does not trigger a provider synchronization. Totals are accumulated post metrics, not activity within these dates. Reach is summed across posts, not unique people.</p>
        <p>{metadata.engagementRateExplanation}</p>
        {metadata.excludedUndatedPosts > 0 && <p>{metadata.excludedUndatedPosts.toLocaleString("en-US")} posts without a valid publication date were excluded. Sync dates are not publication dates.</p>}
        {metadata.postsWithoutAccountMetrics > 0 && <p>{metadata.postsWithoutAccountMetrics.toLocaleString("en-US")} posts have no network breakdown. Network totals may not reconcile with post totals.</p>}
        {missing.length > 0 && <p role="status">Incomplete metrics: {missing.map(([metric, count]) => `${metric.replace(/_/g, " ")} missing for ${count} posts`).join("; ")}. Totals include reported values only.</p>}
        {metadata.missingFetchedAtCount > 0 && <p>{metadata.missingFetchedAtCount} posts have no valid sync timestamp; their freshness cannot be verified.</p>}
        {metadata.duplicateSnapshotCount + metadata.duplicateAccountRowCount > 0 && <p>Repeated post snapshots or identified account rows were removed before aggregation.</p>}
      </ReportDetails>
      <Button size="sm" variant="outline" className="shrink-0" onClick={refresh} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh report"}</Button>
    </section>
  )
}