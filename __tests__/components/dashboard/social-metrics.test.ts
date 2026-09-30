import { buildSocialPerformanceReport } from "@/app/components/dashboard/social-metrics"
import { getLatestSocialSnapshots, parseSocialMetric, parseSocialTimestamp } from "@/app/components/dashboard/social-trends"
import { performancePost, startDate, endDate } from "./social-fixtures"

describe("social metric parsing", () => {
  it.each([null, undefined, "", "  ", "NaN", "Infinity", NaN, Infinity, -Infinity, -1, "-2", false, true, [], {}, "0xff", "5%"])(
    "does not treat invalid or absent %p as an observed zero", (value) => {
      expect(parseSocialMetric(value)).toBeNull()
    },
  )

  it.each([["0", 0], [0, 0], ["12", 12], [" 12.5 ", 12.5], ["2e2", 200], [".5", 0.5]])(
    "parses %p as %p", (value, expected) => { expect(parseSocialMetric(value)).toBe(expected) },
  )

  it.each(["2026-02-30T12:00:00Z", "2026-09-15T", "2026-09-15T12:00:00Zjunk", "2026-09-15T12:00:00+99:00", "2026-09-15T24:00:00Z"])(
    "rejects malformed ISO dates even when a permissive date parser accepts %s", (value) => {
      expect(parseSocialTimestamp(value)).toBeNull()
    },
  )

  it.each(["2026-09-15T12:00:00.123456+00:00", "2026-09-15 12:00:00+00", "2026-09-15T12:00:00Z", "2026-09-15"])(
    "accepts valid cached publication/synchronization dates %s", (value) => {
      expect(parseSocialTimestamp(value)).toBeInstanceOf(Date)
    },
  )
})

describe("buildSocialPerformanceReport", () => {
  it("normalizes numeric strings and exposes missing metrics without concatenation or false rate zeros", () => {
    const result = buildSocialPerformanceReport([
      { ...performancePost(), id: "observed", views: "100", likes: "10", reach: "80", shares: "3",
        comments: "2", impressions: "120", engagement_rate: "8" },
      { ...performancePost(), id: "missing", views: "50", likes: -1, reach: null, shares: NaN,
        comments: "", impressions: Infinity, engagement_rate: undefined },
    ], startDate, endDate)
    expect(result.kpis).toEqual({
      totalViews: 150, totalLikes: 10, totalReach: 80, totalShares: 3, totalComments: 2,
      totalImpressions: 120, postCount: 2, avgEngagementRate: 0.08,
    })
    expect(result.data[0]).toMatchObject({ id: "observed", views: 100, engagement_rate: 8, reportedEngagementRate: 0.08 })
    expect(result.data[1]).toMatchObject({
      id: "missing", likes: null, reach: null, shares: null, comments: null,
      impressions: null, engagement_rate: null, reportedEngagementRate: null,
    })
    expect(result.metadata).toMatchObject({
      postCount: 2, engagementRatePostCount: 1,
      missingMetricCounts: { views: 0, likes: 1, reach: 1, shares: 1, comments: 1, impressions: 1, engagement_rate: 1 },
    })
    expect(result.trends.current.engagement).toBe(8)
    expect(result.trends.current.views).toBe(result.kpis.totalViews)
  })

  it("distinguishes zero rates from unavailable rates and describes the ambiguous legacy convention", () => {
    const result = buildSocialPerformanceReport([
      { ...performancePost(), id: "missing", engagement_rate: null },
      performancePost({ id: "zero", engagement_rate: 0 }),
      { ...performancePost(), id: "invalid", engagement_rate: "invalid" },
    ], startDate, endDate)
    expect(result.kpis.avgEngagementRate).toBe(0)
    expect(result.data[0].id).toBe("zero")
    expect(result.metadata.engagementRatePostCount).toBe(1)
    expect(result.metadata.missingMetricCounts.engagement_rate).toBe(2)
    expect(result.metadata.engagementRateConvention).toBe("legacy_ratio_or_percent")
    expect(result.metadata.engagementRateExplanation).toContain("does not identify units or provider formulas")
    const missing = buildSocialPerformanceReport([{ ...performancePost(), engagement_rate: null }], startDate, endDate)
    expect(missing.kpis.avgEngagementRate).toBeNull()
    expect(missing.trends.current.engagement).toBeNull()
    const legacy = buildSocialPerformanceReport([
      { ...performancePost(), engagement_rate: "0.5" }, { ...performancePost(), engagement_rate: "50" },
    ], startDate, endDate)
    expect(legacy.kpis.avgEngagementRate).toBe(0.5)
  })

  it("reports a genuinely empty cohort without inferring observed rates or freshness", () => {
    const result = buildSocialPerformanceReport([], startDate, endDate)
    expect(result.data).toEqual([])
    expect(result.networks).toEqual([])
    expect(result.kpis).toMatchObject({ postCount: 0, totalViews: 0, avgEngagementRate: null })
    expect(result.metadata).toMatchObject({
      postCount: 0, latestSnapshotCount: 0, excludedUndatedPosts: 0, oldestFetchedAt: null, newestFetchedAt: null,
      missingFetchedAtCount: 0, postsWithAccountMetrics: 0, postsWithoutAccountMetrics: 0,
    })
  })

  it("deduplicates by external post and site, not content, and selects newest timestamp then row ID", () => {
    const old = performancePost({ id: "old", content_id: "shared-content", outstand_post_id: "external-post",
      views: 9999, fetched_at: "2026-09-20T00:00:00Z" })
    const latest = { ...old, id: "a", views: 200, fetched_at: "2026-09-21T00:00:00Z" }
    const tieWinner = { ...latest, id: "z", views: 300 }
    const invalid = { ...latest, id: "zz", views: 9999, fetched_at: "not-a-date" }
    const crosspost = { ...latest, id: "crosspost", outstand_post_id: "another-external-post", views: 50 }
    const anotherSite = { ...latest, id: "another-site", site_id: "site-2", views: 25 }
    const rows = [old, invalid, latest, crosspost, anotherSite, tieWinner]
    const result = buildSocialPerformanceReport(rows, startDate, endDate)
    expect(result.kpis).toMatchObject({ totalViews: 375, postCount: 3 })
    expect(result.metadata).toMatchObject({ latestSnapshotCount: 3, duplicateSnapshotCount: 3 })
    expect(result.data.map((post) => post.id)).toEqual(["z", "crosspost", "another-site"])
    expect(buildSocialPerformanceReport([...rows].reverse(), startDate, endDate)).toEqual(result)
    expect(rows[0]).toBe(old)
    expect(old.views).toBe(9999)
  })

  it("uses IDs deterministically when all sync dates are invalid and never deduplicates unidentified posts", () => {
    const first = performancePost({ id: "a", fetched_at: "", outstand_post_id: "external-post" })
    const second = { ...first, id: "b", fetched_at: "invalid" }
    const unidentified = { ...first, id: "missing-a", outstand_post_id: "" }
    const other = { ...unidentified, id: "missing-b" }
    expect(getLatestSocialSnapshots([first, second]).map((post) => post.id)).toEqual(["b"])
    expect(getLatestSocialSnapshots([second, first]).map((post) => post.id)).toEqual(["b"])
    expect(getLatestSocialSnapshots([unidentified, other])).toHaveLength(2)
  })

  it("deduplicates before applying publication ranges and counts excluded undated posts globally", () => {
    const old = performancePost({ id: "old", outstand_post_id: "same-post", fetched_at: "2026-09-01T00:00:00Z" })
    const latest = { ...old, id: "latest", fetched_at: "2026-09-02T00:00:00Z", content: null }
    const result = buildSocialPerformanceReport([
      old, latest,
      performancePost({ content: { published_at: "not-a-date" } }),
      performancePost({ content: { published_at: "2026-02-30T12:00:00Z" } }),
      performancePost({ content: null, fetched_at: "2026-01-01T00:00:00Z" }),
      performancePost({ views: 40, content: { published_at: "2026-08-20T12:00:00" } }),
    ], startDate, endDate)
    expect(result.kpis.postCount).toBe(0)
    expect(result.metadata).toMatchObject({ latestSnapshotCount: 5, duplicateSnapshotCount: 1, excludedUndatedPosts: 4, undatedPostCount: 4 })
    expect(result.trends.undatedPostCount).toBe(4)
    expect(result.trends.previous).toMatchObject({ views: 40, postCount: 1 })
  })

  it("uses the reporting timezone and inclusive day bounds across daylight saving for both KPI and trends", () => {
    const result = buildSocialPerformanceReport([
      performancePost({ views: 1, content: { published_at: "2026-03-08T04:59:59.999Z" } }),
      performancePost({ views: 2, content: { published_at: "2026-03-08T05:00:00Z" } }),
      performancePost({ views: 3, content: { published_at: "2026-03-09T03:59:59.999Z" } }),
      performancePost({ views: 4, content: { published_at: "2026-03-09T04:00:00Z" } }),
    ], new Date("2026-03-08T12:00:00-04:00"), new Date("2026-03-08T12:00:00-04:00"), "America/New_York")
    expect(result.kpis).toMatchObject({ totalViews: 5, postCount: 2 })
    expect(result.trends.current.views).toBe(5)
    expect(result.trends.previous).toMatchObject({ views: 1, postCount: 1 })
    expect(result.trends.points[0]).toMatchObject({ date: "2026-03-08", previousDate: "2026-03-07" })
  })

  it("reports oldest/newest sync times only for selected latest snapshots and flags unknown sync dates", () => {
    const result = buildSocialPerformanceReport([
      performancePost({ fetched_at: "2026-09-25T02:00:00+02:00" }),
      performancePost({ fetched_at: "2026-09-28T13:00:00Z" }),
      performancePost({ fetched_at: "invalid" }),
      performancePost({ fetched_at: "2026-10-02T00:00:00Z", content: { published_at: "2026-08-15T00:00:00Z" } }),
    ], startDate, endDate, "UTC")
    expect(result.metadata).toMatchObject({
      postCount: 3, oldestFetchedAt: "2026-09-25T00:00:00.000Z", newestFetchedAt: "2026-09-28T13:00:00.000Z",
      missingFetchedAtCount: 1,
    })
  })

  it("deduplicates identified account rows per post/network and safely normalizes aliases and strings", () => {
    const accounts = [
      { account_id: "account-1", network: " Twitter ", views: "100", likes: "5", comments: "2", reach: "80", fetched_at: "2026-09-01T00:00:00Z" },
      { accountId: "account-1", network: "X", views: "200", likes: "10", comments: "4", reach: "160", fetchedAt: "2026-09-02T00:00:00Z" },
      { id: "account-1", network: "x", views: "9999", fetched_at: "invalid" },
      { id: "account-2", network: "x", views: "20" },
      { id: "account-2", network: "x", views: "9999" },
      { account_id: "account-1", network: "facebook", views: "5" },
      { network: "x", views: "10", likes: null, comments: -1, reach: "bad" },
      { network: "x", views: "10", likes: 0, comments: 0, reach: 0 },
    ]
    const result = buildSocialPerformanceReport([
      performancePost({ views: 1, metrics_by_account: accounts }),
      performancePost({ views: 1, metrics_by_account: [{ account_id: "account-1", network: "x", views: "30" }] }),
      performancePost(),
    ], startDate, endDate)
    expect(result.kpis.totalViews).toBe(102)
    expect(result.networks).toEqual([
      {
        network: "x", views: 270, likes: 10, comments: 4, reach: 160,
        coverage: {
          accountRowCount: 5, identifiedAccountRowCount: 3, unidentifiedAccountRowCount: 2,
          missingMetricCounts: { views: 0, likes: 3, comments: 3, reach: 3 },
        },
      },
      {
        network: "facebook", views: 5, likes: 0, comments: 0, reach: 0,
        coverage: {
          accountRowCount: 1, identifiedAccountRowCount: 1, unidentifiedAccountRowCount: 0,
          missingMetricCounts: { views: 0, likes: 1, comments: 1, reach: 1 },
        },
      },
    ])
    expect(result.metadata).toMatchObject({
      postsWithAccountMetrics: 2, postsWithoutAccountMetrics: 1,
      accountRowCount: 6, unidentifiedAccountRowCount: 2, duplicateAccountRowCount: 3,
    })
    expect(accounts[0].network).toBe(" Twitter ")
    expect(accounts[0].views).toBe("100")
  })

  it("retains unknown identities, ignores malformed account containers, and flags missing network metrics", () => {
    const result = buildSocialPerformanceReport([
      { ...performancePost(), metrics_by_account: [null, "bad", [], { views: "7" }, { network: " ", views: -1 }] },
      { ...performancePost(), metrics_by_account: { views: "100" } },
      { ...performancePost(), metrics_by_account: undefined },
    ], startDate, endDate)
    expect(result.networks).toEqual([{
      network: "unknown", views: 7, likes: 0, reach: 0, comments: 0,
      coverage: {
        accountRowCount: 2, identifiedAccountRowCount: 0, unidentifiedAccountRowCount: 2,
        missingMetricCounts: { views: 1, likes: 2, comments: 2, reach: 2 },
      },
    }])
    expect(result.metadata).toMatchObject({ postsWithAccountMetrics: 1, postsWithoutAccountMetrics: 2, duplicateAccountRowCount: 0 })
  })

  it("retains the first account row when timestamps are equal or missing, but honors an explicit newer time", () => {
    const result = buildSocialPerformanceReport([performancePost({ metrics_by_account: [
      { id: "a", network: "x", views: "10" },
      { id: "a", network: "x", views: "20", fetched_at: "2026-09-02T00:00:00Z" },
      { id: "a", network: "x", views: "30", fetched_at: "2026-09-02T00:00:00Z" },
      { id: "a", network: "x", views: "40", fetched_at: "2026-09-01T00:00:00Z" },
      { id: "b", network: "x", views: "50" },
      { id: "b", network: "x", views: "60" },
    ] })], startDate, endDate)
    expect(result.networks[0].views).toBe(70)
    expect(result.metadata.duplicateAccountRowCount).toBe(4)
  })

  it("rejects invalid ranges/timezones and fails rather than reporting non-finite totals", () => {
    expect(() => buildSocialPerformanceReport([], new Date("invalid"), endDate)).toThrow(RangeError)
    expect(() => buildSocialPerformanceReport([], endDate, startDate)).toThrow(RangeError)
    expect(() => buildSocialPerformanceReport([], startDate, endDate, "Invalid/Zone")).toThrow(RangeError)
    expect(() => buildSocialPerformanceReport([
      performancePost({ views: Number.MAX_VALUE }), performancePost({ views: Number.MAX_VALUE }),
    ], startDate, endDate)).toThrow("Social metric total exceeds")
  })
})