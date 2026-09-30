/** @jest-environment node */
import { createClient } from "@/lib/supabase/server"
import {
  getContentCommentConversations, getContentPerformanceForItem, getSocialPerformanceData,
  getSocialPerformanceSnapshots, getTopCommentersData,
} from "@/app/components/dashboard/social-actions"
import { SOCIAL_SNAPSHOT_FIELDS } from "@/app/components/dashboard/social-queries"
import { performancePost, startDate, endDate } from "./social-fixtures"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const SITE_ID = "10000000-0000-4000-8000-000000000001"
const OTHER_SITE = "10000000-0000-4000-8000-000000000002"
const CONTENT_ID = "20000000-0000-4000-8000-000000000001"
const mockPage = jest.fn()
const query = {
  select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(), lt: jest.fn().mockReturnThis(), not: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), lte: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
  then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mockPage().then(resolve, reject),
}
const client = { auth: { getUser: jest.fn() }, rpc: jest.fn(), from: jest.fn(() => query) }
const snapshot = (index: number, overrides: Parameters<typeof performancePost>[0] = {}) => performancePost({
  id: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  site_id: SITE_ID, outstand_post_id: `provider-${index}`, ...overrides,
})
const page = (data: unknown[]) => ({ data, error: null })

beforeEach(() => {
  jest.clearAllMocks()
  mockPage.mockReset().mockResolvedValue(page([]))
  jest.mocked(createClient).mockReset().mockResolvedValue(client as Awaited<ReturnType<typeof createClient>>)
  client.auth.getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
  client.rpc.mockReset().mockResolvedValue({ data: "collaborator", error: null })
})

const actions = [
  ["snapshots", (site: string) => getSocialPerformanceSnapshots(site)],
  ["report", (site: string) => getSocialPerformanceData(site, startDate, endDate, "UTC")],
  ["item", (site: string) => getContentPerformanceForItem(site, CONTENT_ID)],
  ["threads", (site: string) => getContentCommentConversations(site, CONTENT_ID)],
  ["commenters", (site: string) => getTopCommentersData(site, startDate, endDate, "UTC")],
] as const

describe.each(actions)("%s action boundary", (_, action) => {
  it("denies unauthenticated callers without querying data or membership", async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await action(SITE_ID)).toMatchObject({ error: "Unauthorized" })
    expect(client.from).not.toHaveBeenCalled()
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it("rejects auth errors even when a user is present", async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: { message: "private token" } })
    expect(await action(SITE_ID)).toMatchObject({ error: "Unauthorized" })
    expect(client.from).not.toHaveBeenCalled()
  })

  it("checks the requested site membership and denies cross-site access", async () => {
    client.rpc.mockImplementation(async (_name, args) => ({ data: args.p_site_id === SITE_ID ? "owner" : null, error: null }))
    expect(await action(OTHER_SITE)).toMatchObject({ error: "Forbidden" })
    expect(createClient).toHaveBeenCalledWith(true)
    expect(client.rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: OTHER_SITE })
    expect(client.from).not.toHaveBeenCalled()
  })

  it("fails closed on membership lookup errors", async () => {
    client.rpc.mockResolvedValue({ data: "owner", error: { message: "private schema" } })
    expect(await action(SITE_ID)).toMatchObject({ error: "Forbidden" })
    expect(client.from).not.toHaveBeenCalled()
  })

  it.each(["site-1", "demo-site", "", `${SITE_ID},id.not.is.null`, "00000000-0000-0000-0000-000000000000"])("rejects invalid site %s before client creation", async (site) => {
    expect(await action(site)).toMatchObject({ error: "Invalid site ID" })
    expect(createClient).not.toHaveBeenCalled()
  })

  it("sanitizes thrown authentication failures", async () => {
    client.auth.getUser.mockRejectedValue(new Error("private auth infrastructure"))
    const result = await action(SITE_ID)
    expect(result.error).toMatch(/^Unable to load /)
    expect(JSON.stringify(result)).not.toContain("private")
    expect(client.from).not.toHaveBeenCalled()
  })
})

describe("social performance reads", () => {
  it("returns current and previous cohorts from one explicitly selected RLS-scoped cache", async () => {
    mockPage.mockResolvedValueOnce(page([
      snapshot(2, { views: 300 }),
      snapshot(1, { views: 50, content: { published_at: "2026-08-15T12:00:00Z" } }),
    ]))
    const result = await getSocialPerformanceData(SITE_ID, startDate, endDate, "UTC")
    expect(createClient).toHaveBeenCalledWith(true)
    expect(client.auth.getUser).toHaveBeenCalledTimes(1)
    expect(client.rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: SITE_ID })
    expect(query.eq).toHaveBeenCalledWith("site_id", SITE_ID)
    expect(query.select).toHaveBeenCalledWith(SOCIAL_SNAPSHOT_FIELDS)
    expect(SOCIAL_SNAPSHOT_FIELDS).not.toContain("*")
    expect(result.kpis).toMatchObject({ totalViews: 300, postCount: 1 })
    expect(result.data).toHaveLength(1)
    expect(result.trends?.current.views).toBe(300)
    expect(result.trends?.previous.views).toBe(50)
  })

  it("continues even short pages until empty and retains unknown-date coverage", async () => {
    const first = snapshot(3), second = snapshot(2, { content: { published_at: null } })
    const previous = snapshot(1, { content: { published_at: "2026-08-20T12:00:00Z" } })
    mockPage.mockResolvedValueOnce(page([first])).mockResolvedValueOnce(page([second]))
      .mockResolvedValueOnce(page([previous]))
    const result = await getSocialPerformanceData(SITE_ID, startDate, endDate, "UTC")
    expect(mockPage).toHaveBeenCalledTimes(4)
    expect(query.limit).toHaveBeenCalledWith(1000)
    expect(query.lt.mock.calls).toEqual([["id", first.id], ["id", second.id], ["id", previous.id]])
    expect(result.kpis?.postCount).toBe(1)
    expect(result.trends?.previous.postCount).toBe(1)
    expect(result.metadata?.undatedPostCount).toBe(1)
    expect(query.gte).not.toHaveBeenCalled()
  })

  it("reads more than 1000 rows without mutable timestamp cursors", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => snapshot(1001 - i))
    mockPage.mockResolvedValueOnce(page(rows.slice(0, 1000))).mockImplementationOnce(async () => {
      rows[1000].fetched_at = "2026-10-01T00:00:00Z"
      return page([rows[1000]])
    })
    const result = await getSocialPerformanceSnapshots(SITE_ID)
    expect(result.data).toHaveLength(1001)
    expect(new Set(result.data.map(({ id }) => id)).size).toBe(1001)
    expect(result.data[0].id).toBe(rows[1000].id)
    expect(query.order).toHaveBeenCalledWith("id", { ascending: false })
    expect(query.order).not.toHaveBeenCalledWith("fetched_at", expect.anything())
  })

  it("indexes the newest snapshot per content and post, with deterministic ID ties", async () => {
    const old = snapshot(5, { content_id: CONTENT_ID, outstand_post_id: "shared", fetched_at: "2026-01-01T00:00:00Z" })
    const newest = snapshot(4, { content_id: CONTENT_ID, outstand_post_id: "shared", fetched_at: "2026-10-01T00:00:00Z" })
    const tied = snapshot(3, { content_id: CONTENT_ID, outstand_post_id: "shared", fetched_at: newest.fetched_at })
    mockPage.mockResolvedValueOnce(page([old, newest, tied, snapshot(2, { fetched_at: "invalid" })]))
    const result = await getSocialPerformanceSnapshots(SITE_ID)
    expect(result.byContentId[CONTENT_ID]).toEqual(newest)
    expect(result.byPostId.shared).toEqual(newest)
    expect(result.data.map(({ id }) => id)).toEqual([newest.id, tied.id, old.id, snapshot(2).id])
  })

  it("discards partial rows and sanitizes a later database failure", async () => {
    mockPage.mockResolvedValueOnce(page([snapshot(2)]))
      .mockResolvedValueOnce({ data: null, error: { message: "private database details" } })
    expect(await getSocialPerformanceSnapshots(SITE_ID)).toEqual({
      error: "Unable to load social performance snapshots", data: [], byContentId: {}, byPostId: {},
    })
  })

  it("does not treat impossible cached dates as the latest snapshot", async () => {
    const impossible = snapshot(2, { content_id: CONTENT_ID, outstand_post_id: "shared", fetched_at: "2026-02-30T00:00:00Z" })
    const valid = snapshot(1, { content_id: CONTENT_ID, outstand_post_id: "shared", fetched_at: "2026-02-01T00:00:00Z" })
    mockPage.mockResolvedValueOnce(page([impossible, valid]))
    const result = await getSocialPerformanceSnapshots(SITE_ID)
    expect(result.byContentId[CONTENT_ID]).toEqual(valid)
    expect(result.byPostId.shared).toEqual(valid)
  })

  it("fails rather than looping or returning partial data on a repeated cursor", async () => {
    mockPage.mockResolvedValue(page([snapshot(2)]))
    expect(await getSocialPerformanceSnapshots(SITE_ID)).toMatchObject({ error: "Unable to load social performance snapshots", data: [] })
    expect(mockPage).toHaveBeenCalledTimes(2)
  })

  it.each([20_000, 20_001])("probes the 20,000-row cap without silently truncating %i rows", async (count) => {
    const rows = Array.from({ length: count }, (_, i) => snapshot(count - i))
    for (let offset = 0; offset < count; offset += 1000) mockPage.mockResolvedValueOnce(page(rows.slice(offset, offset + 1000)))
    const result = await getSocialPerformanceSnapshots(SITE_ID)
    expect(query.limit).toHaveBeenLastCalledWith(1)
    expect(mockPage).toHaveBeenCalledTimes(21)
    if (count === 20_000) expect(result.data).toHaveLength(count)
    else expect(result).toMatchObject({ error: "Social data exceeds the 20,000-row limit", data: [] })
  })

  it("keeps normalized engagement KPIs and trend averages consistent", async () => {
    mockPage.mockResolvedValueOnce(page([snapshot(2, { engagement_rate: 0.06 }), snapshot(1, { engagement_rate: 8 })]))
    const result = await getSocialPerformanceData(SITE_ID, startDate, endDate, "UTC")
    expect(result.kpis?.avgEngagementRate).toBeCloseTo(0.07)
    expect(result.trends?.current.engagement).toBeCloseTo(7)
  })

  it("uses the supplied timezone for cohorts and comparison buckets", async () => {
    mockPage.mockResolvedValueOnce(page([
      snapshot(2, { content: { published_at: "2026-09-16T03:59:59Z" } }),
      snapshot(1, { content: { published_at: "2026-09-16T04:00:00Z" } }),
    ]))
    const result = await getSocialPerformanceData(SITE_ID, new Date("2026-09-15T00:00:00-04:00"), new Date("2026-09-15T23:59:59-04:00"), "America/New_York")
    expect(result.kpis?.postCount).toBe(1)
    expect(result.trends?.points).toHaveLength(1)
    expect(result.trends?.points[0]).toMatchObject({ date: "2026-09-15", previousDate: "2026-09-14" })
  })
})

describe("range validation before queries", () => {
  it.each([
    [new Date(NaN), endDate, "UTC", "Invalid date range"],
    [startDate, new Date(NaN), "UTC", "Invalid date range"],
    ["2026-09-01" as unknown as Date, endDate, "UTC", "Invalid date range"],
    [endDate, startDate, "UTC", "Invalid date range"],
    [startDate, endDate, "Not/A_Time_Zone", "Invalid time zone"],
    [startDate, endDate, "", "Invalid time zone"],
    [new Date("2024-01-01T12:00:00Z"), new Date("2025-01-01T12:00:00Z"), "UTC", "Date range cannot exceed 366 calendar days"],
  ])("rejects invalid range or timezone %#", async (start, end, zone, error) => {
    expect(await getSocialPerformanceData(SITE_ID, start, end, zone)).toEqual({ error })
    expect(createClient).not.toHaveBeenCalled()
  })

  it("accepts exactly 366 calendar days across a leap year and DST", async () => {
    const result = await getSocialPerformanceData(SITE_ID, new Date("2024-01-01T12:00:00Z"), new Date("2024-12-31T12:00:00Z"), "America/New_York")
    expect(result.error).toBeUndefined()
    expect(client.from).toHaveBeenCalled()
  })
})

describe("content item snapshot", () => {
  it("uses an ordered array limit instead of maybeSingle for multi-post content", async () => {
    const latest = snapshot(2, { content_id: CONTENT_ID })
    mockPage.mockResolvedValueOnce(page([latest]))
    expect(await getContentPerformanceForItem(SITE_ID, CONTENT_ID, "fallback")).toEqual({ data: latest })
    expect(query.eq).toHaveBeenCalledWith("content_id", CONTENT_ID)
    expect(query.eq).toHaveBeenCalledWith("site_id", SITE_ID)
    expect(query.order.mock.calls).toEqual([
      ["fetched_at", { ascending: false, nullsFirst: false }], ["id", { ascending: false }],
    ])
    expect(query.limit).toHaveBeenCalledWith(1)
    expect(query.maybeSingle).not.toHaveBeenCalled()
    expect(mockPage).toHaveBeenCalledTimes(1)
  })

  it("falls back to the provider match only when content has no snapshot", async () => {
    const latest = snapshot(2)
    mockPage.mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([latest]))
    expect(await getContentPerformanceForItem(SITE_ID, CONTENT_ID, "urn:li:share:123")).toEqual({ data: latest })
    expect(query.eq).toHaveBeenCalledWith("outstand_post_id", "urn:li:share:123")
  })

  it.each(["bad-id", "", `${CONTENT_ID} `])("rejects a supplied invalid content ID %s", async (id) => {
    expect(await getContentPerformanceForItem(SITE_ID, id, "valid-post")).toEqual({ error: "Invalid content ID", data: null })
    expect(createClient).not.toHaveBeenCalled()
  })

  it.each(["", "x".repeat(513), "foo,site_id.eq.other", "post\nvalue", "post\"value"])("rejects invalid provider IDs %#", async (id) => {
    expect(await getContentPerformanceForItem(SITE_ID, CONTENT_ID, id)).toEqual({ error: "Invalid post ID", data: null })
    expect(createClient).not.toHaveBeenCalled()
  })

  it("preserves missing optional ID empty results after authorization", async () => {
    expect(await getContentPerformanceForItem(SITE_ID)).toEqual({ data: null })
    expect(client.rpc).toHaveBeenCalled()
    expect(client.from).not.toHaveBeenCalled()
  })

  it("sanitizes item database errors without trying fallback", async () => {
    mockPage.mockResolvedValueOnce({ data: null, error: { message: "private schema" } })
    expect(await getContentPerformanceForItem(SITE_ID, CONTENT_ID, "fallback")).toEqual({ error: "Unable to load content performance", data: null })
    expect(mockPage).toHaveBeenCalledTimes(1)
  })
})