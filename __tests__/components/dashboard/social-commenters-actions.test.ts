/** @jest-environment node */
import { createClient } from "@/lib/supabase/server"
import { getContentCommentConversations, getTopCommentersData } from "@/app/components/dashboard/social-actions"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const SITE_ID = "10000000-0000-4000-8000-000000000001"
const CONTENT_ID = "20000000-0000-4000-8000-000000000001"
const mockPage = jest.fn()
const query = {
  select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), not: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lt: jest.fn().mockReturnThis(), or: jest.fn(),
  then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mockPage().then(resolve, reject),
}
const client = { auth: { getUser: jest.fn() }, rpc: jest.fn(), from: jest.fn(() => query) }
const startDate = new Date("2026-09-15T12:00:00-04:00")
const endDate = new Date("2026-09-16T12:00:00-04:00")
const page = (data: unknown[]) => ({ data, error: null })
const message = (index: number, custom_data: Record<string, unknown> = {}) => ({
  id: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  created_at: "2026-09-15T12:00:00Z", visitor_id: null, lead_id: null,
  custom_data: { author_id: "123", author_name: "Ada", source: "comment", outstand_post_id: "post-1", ...custom_data },
  conversations: { site_id: SITE_ID, channel: "instagram" },
})

beforeEach(() => {
  jest.clearAllMocks()
  mockPage.mockReset().mockResolvedValue(page([]))
  jest.mocked(createClient).mockReset().mockResolvedValue(client as Awaited<ReturnType<typeof createClient>>)
  client.auth.getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
  client.rpc.mockReset().mockResolvedValue({ data: "marketing", error: null })
})

describe("top commenters action", () => {
  it("normalizes authors while preserving site, roles, explicit fields and timezone boundaries", async () => {
    mockPage.mockResolvedValueOnce(page([
      message(2),
      { ...message(1, { author_name: "Reader" }), conversations: { channel: "facebook", site_id: SITE_ID } },
    ]))
    const result = await getTopCommentersData(SITE_ID, startDate, endDate, "America/New_York")
    expect(result.data.map(({ id }) => id)).toEqual(["author:instagram:123", "author:facebook:123"])
    expect(createClient).toHaveBeenCalledWith(true)
    expect(client.auth.getUser).toHaveBeenCalledTimes(1)
    expect(client.rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: SITE_ID })
    expect(query.select).toHaveBeenCalledWith("id, created_at, custom_data, visitor_id, lead_id, conversations!inner(site_id, channel)")
    expect(query.eq).toHaveBeenCalledWith("conversations.site_id", SITE_ID)
    expect(query.not).toHaveBeenCalledWith("custom_data->>outstand_post_id", "is", null)
    expect(query.in).toHaveBeenCalledWith("role", ["visitor", "user"])
    expect(query.gte).toHaveBeenCalledWith("created_at", "2026-09-15T04:00:00.000Z")
    expect(query.lte).toHaveBeenCalledWith("created_at", "2026-09-17T03:59:59.999Z")
    expect(query.order).toHaveBeenCalledWith("id", { ascending: false })
    expect(query.limit).toHaveBeenCalledWith(1000)
    expect(result.metadata).toEqual({ messageCount: 2, latestMessageAt: "2026-09-15T12:00:00.000Z" })
  })

  it("reads beyond 2000 messages and continues short server-limited pages until empty", async () => {
    const rows = Array.from({ length: 2003 }, (_, i) => message(2003 - i))
    // Simulate a PostgREST cap below our requested page size on every page.
    for (let offset = 0; offset < rows.length; offset += 700) mockPage.mockResolvedValueOnce(page(rows.slice(offset, offset + 700)))
    const result = await getTopCommentersData(SITE_ID, startDate, endDate, "UTC")
    expect(result.data[0].count).toBe(2003)
    expect(result.metadata?.messageCount).toBe(2003)
    expect(mockPage).toHaveBeenCalledTimes(4)
    expect(query.lt.mock.calls).toEqual([["id", rows[699].id], ["id", rows[1399].id], ["id", rows[2002].id]])
  })

  it("keeps metadata message count distinct from identified or replay-deduplicated comments", async () => {
    const replay = { platform_comment_id: "provider-comment", author_id: "123" }
    mockPage.mockResolvedValueOnce(page([
      { ...message(3, replay), created_at: "2026-09-15T13:00:00Z" },
      { ...message(2, replay), created_at: "2026-09-16T01:00:00Z" },
      { ...message(1), custom_data: { outstand_post_id: "post-1" }, created_at: "invalid" },
    ]))
    const result = await getTopCommentersData(SITE_ID, startDate, endDate, "UTC")
    expect(result.data[0].count).toBe(1)
    expect(result.metadata).toEqual({ messageCount: 3, latestMessageAt: "2026-09-16T01:00:00.000Z" })
  })

  it("distinguishes empty data from a database failure and never exposes raw errors", async () => {
    expect(await getTopCommentersData(SITE_ID, startDate, endDate)).toEqual({ data: [], metadata: { messageCount: 0 } })
    mockPage.mockResolvedValueOnce({ data: null, error: { message: "private database schema" } })
    expect(await getTopCommentersData(SITE_ID, startDate, endDate)).toEqual({ error: "Unable to load top commenters", data: [] })
  })

  it("discards all partial results when a later page rejects", async () => {
    mockPage.mockResolvedValueOnce(page([message(2)])).mockRejectedValueOnce(new Error("private transport failure"))
    expect(await getTopCommentersData(SITE_ID, startDate, endDate)).toEqual({ error: "Unable to load top commenters", data: [] })
  })

  it("fails closed at the 20,000-message bound instead of returning partial rankings", async () => {
    for (let index = 0; index < 20; index++) {
      mockPage.mockResolvedValueOnce(page(Array.from({ length: 1000 }, (_, i) => message(20_001 - index * 1000 - i))))
    }
    mockPage.mockResolvedValueOnce(page([message(1)]))
    expect(await getTopCommentersData(SITE_ID, startDate, endDate)).toEqual({ error: "Social data exceeds the 20,000-row limit", data: [] })
    expect(query.limit).toHaveBeenLastCalledWith(1)
    expect(mockPage).toHaveBeenCalledTimes(21)
  })

  it.each([
    [new Date(NaN), endDate, "UTC", "Invalid date range"],
    [endDate, startDate, "UTC", "Invalid date range"],
    [startDate, endDate, "invalid/zone", "Invalid time zone"],
    [new Date("2024-01-01T00:00:00Z"), new Date("2025-01-01T00:00:00Z"), "UTC", "Date range cannot exceed 366 calendar days"],
  ])("rejects malformed range before message queries %#", async (start, end, zone, error) => {
    expect(await getTopCommentersData(SITE_ID, start, end, zone)).toEqual({ error, data: [] })
    expect(createClient).not.toHaveBeenCalled()
  })
})

const thread = (index: number, conversationId = `thread-${index}`, createdAt = "2026-09-15T12:00:00Z") => ({
  id: `message-${String(index).padStart(3, "0")}`, conversation_id: conversationId,
  content: `  Preview ${index}  `, created_at: createdAt, custom_data: {},
  conversations: { id: conversationId, title: `Thread ${index}`, channel: "instagram", last_message_at: createdAt },
})

describe("content comment conversations", () => {
  it("uses two safe equality queries and merges newest previews with thread deduplication", async () => {
    const old = thread(1, "shared", "2026-09-15T01:00:00Z")
    const newest = thread(2, "shared", "2026-09-16T12:00:00Z")
    const other = thread(3, "other", "2026-09-16T01:00:00Z")
    mockPage.mockResolvedValueOnce(page([old, other])).mockResolvedValueOnce(page([newest, other]))
    const result = await getContentCommentConversations(SITE_ID, CONTENT_ID, "urn:li:share:123")
    expect(query.eq).toHaveBeenCalledWith("custom_data->>content_id", CONTENT_ID)
    expect(query.eq).toHaveBeenCalledWith("custom_data->>outstand_post_id", "urn:li:share:123")
    expect(query.eq.mock.calls.filter(([field]) => field === "conversations.site_id")).toEqual([
      ["conversations.site_id", SITE_ID], ["conversations.site_id", SITE_ID],
    ])
    expect(query.eq.mock.calls.filter(([field]) => field === "conversations.is_archived")).toHaveLength(2)
    expect(query.or).not.toHaveBeenCalled()
    expect(query.limit).toHaveBeenCalledWith(50)
    expect(result.data.map(({ id }) => id)).toEqual(["shared", "other"])
    expect(result.data[0]).toMatchObject({ preview: "Preview 2", last_message_at: newest.created_at })
  })

  it("starts both safe reads before either settles", async () => {
    let release: (result: ReturnType<typeof page>) => void = () => {}
    const pending = new Promise<ReturnType<typeof page>>((resolve) => { release = resolve })
    mockPage.mockReturnValueOnce(pending).mockResolvedValueOnce(page([]))
    const result = getContentCommentConversations(SITE_ID, CONTENT_ID, "provider-id")
    for (let i = 0; i < 8; i++) await Promise.resolve()
    expect(mockPage).toHaveBeenCalledTimes(2)
    release(page([]))
    expect(await result).toEqual({ data: [] })
  })

  it("returns at most the newest 50 merged unique threads", async () => {
    const rows = Array.from({ length: 100 }, (_, i) => thread(i, `thread-${i}`, new Date(Date.UTC(2026, 8, 15, 0, i)).toISOString()))
    mockPage.mockResolvedValueOnce(page(rows.slice(0, 50))).mockResolvedValueOnce(page(rows.slice(50)))
    const result = await getContentCommentConversations(SITE_ID, CONTENT_ID, "provider-id")
    expect(result.data).toHaveLength(50)
    expect(result.data[0].id).toBe("thread-99")
    expect(result.data[49].id).toBe("thread-50")
  })

  it.each(["post,conversations.site_id.eq.other", "post\"value", "x".repeat(513), ""])("rejects invalid provider filter input %#", async (id) => {
    expect(await getContentCommentConversations(SITE_ID, CONTENT_ID, id)).toEqual({ error: "Invalid post ID", data: [] })
    expect(client.from).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it("rejects invalid optional content IDs rather than dropping that filter", async () => {
    expect(await getContentCommentConversations(SITE_ID, "invalid", "valid-post")).toEqual({ error: "Invalid content ID", data: [] })
    expect(client.from).not.toHaveBeenCalled()
  })

  it("authorizes missing ID requests while preserving an empty result", async () => {
    expect(await getContentCommentConversations(SITE_ID)).toEqual({ data: [] })
    expect(client.rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: SITE_ID })
    expect(client.from).not.toHaveBeenCalled()
  })

  it("discards the other predicate's data when one query fails", async () => {
    mockPage.mockResolvedValueOnce(page([thread(1)]))
      .mockResolvedValueOnce({ data: null, error: { message: "private SQL" } })
    expect(await getContentCommentConversations(SITE_ID, CONTENT_ID, "valid-post")).toEqual({ error: "Unable to load comment conversations", data: [] })
  })
})