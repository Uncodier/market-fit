import type { ContentPerformanceRow } from "@/app/components/dashboard/social-actions"

let postSequence = 0

export function performancePost(overrides: Partial<ContentPerformanceRow> = {}): ContentPerformanceRow {
  const index = ++postSequence
  return {
    id: `post-${index}`, site_id: "site-1", content_id: `content-${index}`, outstand_post_id: `outstand-${index}`,
    likes: 10, comments: 2, shares: 1, views: 100, impressions: 120, reach: 80,
    engagement_rate: 0.05, metrics_by_account: [], fetched_at: "2026-09-28T12:00:00",
    content: { title: "Example post", published_at: "2026-09-15T12:00:00", status: "published" },
    ...overrides,
  }
}

export const startDate = new Date("2026-09-01T00:00:00")
export const endDate = new Date("2026-09-30T23:59:59")