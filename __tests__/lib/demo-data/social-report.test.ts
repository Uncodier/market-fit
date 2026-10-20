import * as registry from "@/lib/demo-data"
import { attachDemoSocial } from "@/lib/demo-data/social-seed"
import { getDemoSocialPerformance, getDemoSocialCommenters } from "@/lib/demo-data/social-report"
import { buildSocialPerformanceReport } from "@/app/components/dashboard/social-metrics"
import type { SocialPerformanceSnapshotInput } from "@/app/components/dashboard/social-metrics-types"
import type { DemoReportRow } from "@/lib/demo-data/report-types"
import { subDays, addDays } from "date-fns"

jest.mock("@/lib/demo-data", () => {
  const actual = jest.requireActual<typeof registry>("@/lib/demo-data")
  return { ...actual, getDemoData: jest.fn(actual.getDemoData) }
})

const end = new Date()
const start = subDays(end, 29)

beforeEach(() => { (fetch as jest.Mock).mockReset() })
afterEach(() => { jest.restoreAllMocks() })

describe.each(registry.availableDemos)("Social sample records: $id", ({ id }) => {
  it("populates engagement, networks/audience and top posts without network requests", async () => {
    const performance = await getDemoSocialPerformance(id, start, end)
    const commenters = await getDemoSocialCommenters(id, start, end)
    expect(performance.kpis.totalViews).toBeGreaterThan(0)
    expect(performance.kpis.totalReach).toBeGreaterThan(0)
    expect(performance.kpis.totalComments).toBeGreaterThan(0)
    expect(performance.kpis.avgEngagementRate).toBeGreaterThan(0)
    expect(performance.trends.current.postCount).toBeGreaterThan(0)
    expect(performance.trends.previous.postCount).toBeGreaterThan(0)
    expect(performance.trends.previous.views).toBeGreaterThan(0)
    expect(performance.trends.points).toHaveLength(30)
    expect(performance.trends.points.reduce((sum, point) => sum + point.current.views, 0)).toBe(performance.kpis.totalViews)
    expect(performance.trends.points.reduce((sum, point) => sum + point.previous.views, 0)).toBe(performance.trends.previous.views)
    expect(performance.data.length).toBeGreaterThan(0)
    expect(performance.data.every(post => post.content?.status === "published" && post.content.title && post.content.published_at)).toBe(true)
    expect(performance.data.reduce((sum, post) => sum + (post.views || 0), 0)).toBe(performance.kpis.totalViews)
    expect(performance.networks.map(row => row.network).sort()).toEqual(["facebook", "instagram", "linkedin", "x"])
    expect(performance.networks.reduce((sum, network) => sum + network.views, 0)).toBe(performance.kpis.totalViews)
    expect(performance.metadata.postsWithoutAccountMetrics).toBe(0)
    expect(performance.metadata.duplicateSnapshotCount).toBeGreaterThan(0)
    expect(commenters.data.length).toBeGreaterThan(0)
    expect(commenters.data.length).toBeLessThanOrEqual(5)
    expect(commenters.data.every(author => author.id.startsWith("author:") && author.name && author.count > 0)).toBe(true)
    expect(commenters.metadata.messageCount).toBeGreaterThan(0)
    expect(commenters.metadata.latestMessageAt).toBeDefined()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("uses selected dates exactly and returns honest empty and long-range results", async () => {
    const day = await getDemoSocialPerformance(id, end, end)
    expect(day.trends.points).toHaveLength(1)
    expect(day.kpis.postCount).toBeGreaterThan(0)
    for (const [from, to] of [[addDays(start, 1000), addDays(end, 1000)], [new Date("2001-01-01"), new Date("2001-01-30")]]) {
      const empty = await getDemoSocialPerformance(id, from, to)
      const commenters = await getDemoSocialCommenters(id, from, to)
      expect(empty.data).toEqual([])
      expect(empty.networks).toEqual([])
      expect(empty.kpis.totalViews).toBe(0)
      expect(empty.kpis.avgEngagementRate).toBeNull()
      expect(commenters.data).toEqual([])
      expect(commenters.metadata).toEqual({ messageCount: 0 })
    }
    const yearly = await getDemoSocialPerformance(id, subDays(end, 365), end)
    expect(yearly.trends.points.length).toBeLessThanOrEqual(60)
    expect(yearly.trends.previous.postCount).toBeGreaterThan(0)
    expect((await getDemoSocialCommenters(id, subDays(end, 365), end)).metadata.messageCount).toBeGreaterThan(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("keeps seed refreshes idempotent and linked without changing unrelated records", async () => {
    const input = (await registry.getDemoData(id))! as Record<string, DemoReportRow[]>
    const before = JSON.stringify(input)
    const prefix = `${id}-social-`
    const seeded = attachDemoSocial(input, end)
    const refreshed = attachDemoSocial(seeded, end)
    expect(refreshed).toEqual(seeded)
    expect(JSON.stringify(input)).toBe(before)
    for (const table of Object.keys(input)) {
      if (!["content", "content_performance", "messages", "conversations"].includes(table)) expect(seeded[table]).toBe(input[table])
      else {
        const existing = input[table].filter(row => !row.id.startsWith(prefix))
        expect(seeded[table].filter(row => !row.id.startsWith(prefix))).toEqual(existing)
      }
    }
    const content = new Map(seeded.content.map(row => [row.id, row]))
    for (const snapshot of seeded.content_performance.filter(row => row.id.startsWith(prefix))) {
      expect(snapshot.site_id).toBe(id)
      expect(content.get(String(snapshot.content_id))?.status).toBe("published")
      expect(content.get(String(snapshot.content_id))?.published_at).toBeDefined()
      expect(snapshot.metrics_by_account).toEqual(expect.arrayContaining([expect.objectContaining({ account_id: expect.any(String), network: expect.any(String) })]))
    }
    const conversations = new Map(seeded.conversations.map(row => [row.id, row]))
    for (const message of seeded.messages.filter(row => row.id.startsWith(prefix))) {
      const metadata = message.custom_data as Record<string, unknown>
      expect(content.has(String(metadata.content_id))).toBe(true)
      expect(conversations.get(message.conversation_id!)?.site_id).toBe(id)
      expect(conversations.get(message.conversation_id!)?.channel).toBe(metadata.network)
      expect(metadata.author_id).toBeDefined()
      expect(seeded.content_performance.some(row => row.outstand_post_id === metadata.outstand_post_id)).toBe(true)
    }
  })
})

it("rejects unknown demo lookalikes, real sites, invalid dates, zones and oversized ranges locally", async () => {
  for (const id of ["demo-unknown", "demo-habituall-extra", "real-site", ""]) {
    await expect(getDemoSocialPerformance(id, start, end)).rejects.toThrow("Unknown demo site")
    await expect(getDemoSocialCommenters(id, start, end)).rejects.toThrow("Unknown demo site")
  }
  for (const loader of [getDemoSocialPerformance, getDemoSocialCommenters]) {
    const id = registry.availableDemos[0].id
    await expect(loader(id, new Date(NaN), end)).rejects.toThrow()
    await expect(loader(id, end, start)).rejects.toThrow()
    await expect(loader(id, start, end, "not-a-zone")).rejects.toThrow()
    await expect(loader(id, subDays(end, 366), end)).rejects.toThrow("too large")
  }
  expect(fetch).not.toHaveBeenCalled()
})

it("leaves input without a site unchanged", () => {
  const input = { content: [] }
  expect(attachDemoSocial(input)).toBe(input)
})

it("matches pure publication builders and scopes commenter timestamps, roles and tenant joins", async () => {
  const id = registry.availableDemos[0].id
  const publishedAt = "2026-01-02T00:30:00Z"
  const snapshot: SocialPerformanceSnapshotInput = {
    id: "snapshot", site_id: id, content_id: "content", outstand_post_id: "post", fetched_at: "2026-01-03T12:00:00Z",
    views: 100, likes: 10, comments: 5, reach: 70, shares: 2, impressions: 120, engagement_rate: 0.2,
    metrics_by_account: [{ account_id: "account", network: "twitter", views: 100, likes: 10, comments: 5, reach: 70 }],
    content: { title: "Timezone boundary", status: "published", published_at: publishedAt },
  }
  const message = (messageId: string, fields: Record<string, unknown> = {}) => ({
    id: messageId, created_at: publishedAt, site_id: id, conversation_id: "conversation", role: "visitor",
    custom_data: { outstand_post_id: "post", author_id: "customer", author_name: "Sample Customer" }, ...fields,
  })
  const fixture = {
    content: [{ id: "content", site_id: id, created_at: publishedAt, ...snapshot.content }],
    content_performance: [{ ...snapshot, created_at: publishedAt }, { ...snapshot, id: "foreign-snapshot", site_id: "other-site", created_at: publishedAt }],
    conversations: [{ id: "conversation", site_id: id, channel: "instagram", created_at: publishedAt },
      { id: "foreign-conversation", site_id: "other-site", channel: "instagram", created_at: publishedAt }],
    messages: [message("included"), message("assistant", { role: "assistant" }), message("no-post", { custom_data: { author_id: "customer" } }),
      message("foreign", { site_id: "other-site" }), message("foreign-join", { conversation_id: "foreign-conversation" }),
      message("undated", { created_at: "invalid" }), message("out-of-range", { created_at: "2026-01-02T12:00:00Z" }),
      message("via-join", { site_id: undefined })],
  }
  jest.mocked(registry.getDemoData).mockResolvedValueOnce(fixture as Awaited<ReturnType<typeof registry.getDemoData>>)
  const from = new Date("2026-01-01T08:00:00Z")
  const to = new Date("2026-01-02T07:59:59Z")
  const result = await getDemoSocialPerformance(id, from, to, "America/Los_Angeles")
  expect(result).toEqual(buildSocialPerformanceReport([snapshot], from, to, "America/Los_Angeles"))
  expect(result.kpis.postCount).toBe(1)
  jest.mocked(registry.getDemoData).mockResolvedValueOnce(fixture as Awaited<ReturnType<typeof registry.getDemoData>>)
  const commenters = await getDemoSocialCommenters(id, from, to, "America/Los_Angeles")
  expect(commenters.data).toEqual([{ id: "author:instagram:customer", name: "Sample Customer", avatar: null, count: 2 }])
  expect(commenters.metadata).toEqual({ messageCount: 2, latestMessageAt: publishedAt.replace("Z", ".000Z") })
  jest.mocked(registry.getDemoData).mockResolvedValueOnce(fixture as Awaited<ReturnType<typeof registry.getDemoData>>)
  const utc = await getDemoSocialPerformance(id, new Date("2026-01-01T00:00:00Z"), new Date("2026-01-01T23:59:59Z"), "UTC")
  expect(utc.kpis.postCount).toBe(0)
  expect(fetch).not.toHaveBeenCalled()
})