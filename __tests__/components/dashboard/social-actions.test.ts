import { createClient } from "@/lib/supabase/server"
import { getSocialPerformanceData, getSocialPerformanceSnapshots } from "@/app/components/dashboard/social-actions"
import { performancePost, startDate, endDate } from "./social-fixtures"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const mockPage = jest.fn()
const query = {
  select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(), lt: jest.fn().mockReturnThis(),
  then: (resolve: (value: unknown) => unknown) => mockPage().then(resolve),
}
const client = { auth: { getUser: jest.fn() }, from: jest.fn(() => query) }

beforeEach(() => {
  jest.clearAllMocks()
  mockPage.mockReset()
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  client.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
})

describe("social performance actions", () => {
  it("returns current KPIs and both trend periods from the same user-scoped data", async () => {
    mockPage.mockResolvedValue({ data: [
      performancePost({ views: 300 }),
      performancePost({ views: 50, content: { published_at: "2026-08-15T12:00:00" } }),
    ], error: null })

    const result = await getSocialPerformanceData("site-1", startDate, endDate)
    expect(client.from).toHaveBeenCalledWith("content_performance")
    expect(query.eq).toHaveBeenCalledWith("site_id", "site-1")
    expect(result.kpis).toMatchObject({ totalViews: 300, postCount: 1 })
    expect(result.data).toHaveLength(1)
    expect(result.trends?.current.views).toBe(300)
    expect(result.trends?.previous.views).toBe(50)
  })

  it("fetches subsequent pages instead of truncating older comparison posts at 1000 rows", async () => {
    mockPage
      .mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, index) => performancePost({ id: `post-${index}` })), error: null })
      .mockResolvedValueOnce({ data: [performancePost({ id: "older-post", content: { published_at: "2026-08-20T12:00:00" } })], error: null })

    const result = await getSocialPerformanceData("site-1", startDate, endDate)
    expect(query.limit).toHaveBeenCalledWith(1000)
    expect(query.lt).toHaveBeenCalledWith("id", "post-999")
    expect(query.order).toHaveBeenCalledWith("id", { ascending: false })
    expect(result.kpis?.postCount).toBe(1000)
    expect(result.trends?.previous.postCount).toBe(1)
  })

  it("does not query data for unauthenticated users", async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: null } })
    expect(await getSocialPerformanceData("site-1", startDate, endDate)).toEqual({ error: "Unauthorized" })
    expect(client.from).not.toHaveBeenCalled()
  })

  it("keeps KPI and trend engagement averages consistent across provider formats", async () => {
    mockPage.mockResolvedValue({ data: [performancePost({ engagement_rate: 0.06 }), performancePost({ engagement_rate: 8 })], error: null })
    const result = await getSocialPerformanceData("site-1", startDate, endDate)
    expect(result.kpis?.avgEngagementRate).toBeCloseTo(0.07)
    expect(result.trends?.current.engagement).toBeCloseTo(7)
  })

  it("uses the browser reporting timezone for both KPIs and comparison buckets", async () => {
    mockPage.mockResolvedValue({ data: [
      performancePost({ content: { published_at: "2026-09-16T03:59:59Z" } }),
      performancePost({ content: { published_at: "2026-09-16T04:00:00Z" } }),
    ], error: null })
    const result = await getSocialPerformanceData("site-1", new Date("2026-09-15T00:00:00-04:00"), new Date("2026-09-15T23:59:59-04:00"), "America/New_York")
    expect(result.kpis?.postCount).toBe(1)
    expect(result.trends?.points).toHaveLength(1)
    expect(result.trends?.points[0]).toMatchObject({ date: "2026-09-15", previousDate: "2026-09-14" })
  })

  it("uses an immutable ID cursor even when unread snapshots refresh between pages", async () => {
    const posts = Array.from({ length: 1001 }, (_, index) => performancePost({
      id: String(1001 - index).padStart(4, "0"), outstand_post_id: `post-${index}`,
    }))
    mockPage.mockImplementationOnce(async () => ({ data: posts.slice(0, 1000), error: null }))
      .mockImplementationOnce(async () => {
        posts[1000].fetched_at = "2026-10-01T00:00:00Z"
        const cursor = query.lt.mock.calls[0][1]
        return { data: posts.filter((post) => post.id < cursor), error: null }
      })
    const result = await getSocialPerformanceSnapshots("site-1")
    expect(result.data).toHaveLength(1001)
    expect(new Set(result.data.map((post) => post.id)).size).toBe(1001)
    expect(query.order).not.toHaveBeenCalledWith("fetched_at", expect.anything())
  })

  it("discards partial results when a later page fails", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {})
    mockPage
      .mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => performancePost()), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "Database unavailable" } })
    const result = await getSocialPerformanceSnapshots("site-1")
    expect(result).toEqual({ error: "Database unavailable", data: [], byContentId: {}, byPostId: {} })
    log.mockRestore()
  })
})