import { createClient } from "@/lib/supabase/server"
import { getTopCommentersData } from "@/app/components/dashboard/social-actions"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const query = {
  select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), not: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), lte: jest.fn().mockReturnThis(),
  limit: jest.fn(),
}
const client = { auth: { getUser: jest.fn() }, from: jest.fn(() => query) }
const startDate = new Date("2026-09-15T12:00:00-04:00")
const endDate = new Date("2026-09-16T12:00:00-04:00")

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  client.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
  query.limit.mockResolvedValue({ data: [], error: null })
})

describe("top commenters action", () => {
  it("normalizes synchronized authors while preserving query scope, roles, limit and timezone boundaries", async () => {
    query.limit.mockResolvedValue({ data: [
      { custom_data: { author_id: "123", author_name: "Ada", source: "comment", outstand_post_id: "post-1" }, conversations: { channel: "instagram" } },
      { custom_data: { from: { id: "123", name: "Reader" } }, conversations: { channel: "facebook" } },
    ], error: null })

    const result = await getTopCommentersData("site-1", startDate, endDate, "America/New_York")
    expect(result.data.map(({ id }) => id)).toEqual(["author:instagram:123", "author:facebook:123"])
    expect(client.auth.getUser).toHaveBeenCalledTimes(1)
    expect(client.from).toHaveBeenCalledWith("messages")
    expect(query.select).toHaveBeenCalledWith("custom_data, visitor_id, lead_id, conversations!inner(site_id, channel)")
    expect(query.eq).toHaveBeenCalledWith("conversations.site_id", "site-1")
    expect(query.not).toHaveBeenCalledWith("custom_data->>outstand_post_id", "is", null)
    expect(query.in).toHaveBeenCalledWith("role", ["visitor", "user"])
    expect(query.gte).toHaveBeenCalledWith("created_at", "2026-09-15T04:00:00.000Z")
    expect(query.lte).toHaveBeenCalledWith("created_at", "2026-09-17T03:59:59.999Z")
    expect(query.limit).toHaveBeenCalledWith(2000)
  })

  it("does not query messages without an authenticated user", async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: null } })
    expect(await getTopCommentersData("site-1", startDate, endDate)).toEqual({ error: "Unauthorized", data: [] })
    expect(client.from).not.toHaveBeenCalled()
  })

  it("distinguishes a database error from an empty result", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {})
    try {
      expect(await getTopCommentersData("site-1", startDate, endDate)).toEqual({ data: [] })
      query.limit.mockResolvedValue({ data: null, error: { message: "Database unavailable" } })
      expect(await getTopCommentersData("site-1", startDate, endDate))
        .toEqual({ error: "Database unavailable", data: [] })
    } finally {
      log.mockRestore()
    }
  })
})