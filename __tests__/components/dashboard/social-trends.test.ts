import { buildSocialTrends } from "@/app/components/dashboard/social-trends"
import { performancePost, startDate, endDate } from "./social-fixtures"

describe("buildSocialTrends", () => {
  it("aligns publication cohorts with the preceding equal-length range, regardless of sync date", () => {
    const result = buildSocialTrends([
      performancePost({ content: { published_at: "2026-09-01T00:00:00" } }),
      performancePost({ views: 250, content: { published_at: "2026-09-30T23:59:59.999" } }),
      performancePost({ views: 40, content: { published_at: "2026-08-02T00:00:00" } }),
      performancePost({ views: 60, content: { published_at: "2026-08-31T23:59:59.999" } }),
      performancePost({ views: 9999, content: { published_at: "2026-08-01T23:59:59" } }),
      performancePost({ views: 9999, content: { published_at: "2026-10-01T00:00:00" } }),
    ], startDate, endDate)

    expect(result.points).toHaveLength(30)
    expect(result.current).toMatchObject({ views: 350, postCount: 2 })
    expect(result.previous).toMatchObject({ views: 100, postCount: 2 })
    expect(result.points[0]).toMatchObject({
      date: "2026-09-01", previousDate: "2026-08-02", current: { views: 100 }, previous: { views: 40 },
    })
    expect(result.points[29]).toMatchObject({
      date: "2026-09-30", previousDate: "2026-08-31", current: { views: 250 }, previous: { views: 60 },
    })
  })

  it("sums counts, averages normalized engagement per post, and does not invent empty-period rates", () => {
    const result = buildSocialTrends([
      performancePost({ engagement_rate: 0.06 }),
      performancePost({ engagement_rate: 8, views: 200 }),
    ], startDate, endDate)

    expect(result.current).toEqual({ views: 300, reach: 160, likes: 20, comments: 4, shares: 2, engagement: 7, postCount: 2 })
    expect(result.points[14].current.engagement).toBe(7)
    expect(result.points[0].current).toMatchObject({ views: 0, engagement: null, postCount: 0 })
    expect(result.previous.engagement).toBeNull()
  })

  it("uses and reports sync-date fallbacks without fabricating publication dates", () => {
    const result = buildSocialTrends([
      performancePost({ content: null }),
      performancePost({ content: { published_at: "invalid" }, fetched_at: "2026-08-10T12:00:00" }),
      performancePost({ content: null, fetched_at: "invalid" }),
      performancePost({ content: null, fetched_at: "2026-01-01T12:00:00" }),
    ], startDate, endDate)

    expect(result.undatedPostCount).toBe(2)
    expect(result.points[27].current.postCount).toBe(1)
    expect(result.previous.postCount).toBe(1)
  })

  it("creates bounded equal-sized buckets and preserves a partial last bucket", () => {
    const result = buildSocialTrends([
      performancePost({ content: { published_at: "2026-04-30T23:59:59" } }),
    ], new Date("2026-01-01T00:00:00"), new Date("2026-04-30T12:00:00"))

    expect(result.bucketDays).toBe(7)
    expect(result.points).toHaveLength(18)
    expect(result.points[17]).toMatchObject({ date: "2026-04-30", endDate: "2026-04-30", current: { postCount: 1 } })
    const longRange = buildSocialTrends([], new Date("2020-01-01T00:00:00"), endDate)
    expect(longRange.points.length).toBeLessThanOrEqual(60)
  })

  it("handles single days, leap days, and daylight-saving boundaries as calendar days", () => {
    const singleDay = buildSocialTrends([], startDate, startDate)
    expect(singleDay.points[0]).toMatchObject({ date: "2026-09-01", previousDate: "2026-08-31" })
    const leapRange = buildSocialTrends([], new Date("2024-03-01T00:00:00"), new Date("2024-03-02T23:59:59"))
    expect(leapRange.points.map((point) => point.previousDate)).toEqual(["2024-02-28", "2024-02-29"])
    const dstRange = buildSocialTrends([], new Date("2026-03-07T00:00:00"), new Date("2026-03-09T23:59:59"))
    expect(dstRange.points.map((point) => point.date)).toEqual(["2026-03-07", "2026-03-08", "2026-03-09"])
  })

  it("handles empty data, invalid ranges, and non-finite metrics safely", () => {
    expect(buildSocialTrends([], startDate, endDate).current.postCount).toBe(0)
    expect(buildSocialTrends([], endDate, startDate).points).toEqual([])
    expect(buildSocialTrends([], new Date("invalid"), endDate).points).toEqual([])
    const result = buildSocialTrends([performancePost({ views: NaN, likes: Infinity, shares: -1 })], startDate, endDate)
    expect(result.current).toMatchObject({ views: 0, likes: 0, shares: 0 })
  })

  it("buckets offset-bearing dates in the reporting timezone across daylight saving", () => {
    const result = buildSocialTrends([
      performancePost({ content: { published_at: "2026-03-09T03:59:59Z" } }),
      performancePost({ content: { published_at: "2026-03-09T04:00:00Z" } }),
    ], new Date("2026-03-08T00:00:00-05:00"), new Date("2026-03-08T23:59:59-04:00"), "America/New_York")
    expect(result.points).toHaveLength(1)
    expect(result.points[0]).toMatchObject({ date: "2026-03-08", previousDate: "2026-03-07", current: { postCount: 1 } })
  })
})