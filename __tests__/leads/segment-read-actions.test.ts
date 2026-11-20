import { getLeads, searchLeadsWithCount } from "@/app/leads/read-actions"
import { createClient } from "@/lib/supabase/server"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const siteId = "10000000-0000-4000-8000-000000000001"
const segmentId = "20000000-0000-4000-8000-000000000001"

function userScopedClient() {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    then: (resolve: (result: unknown) => void) => resolve({ data: [], count: 0, error: null }),
  }
  const from = jest.fn(() => query)
  jest.mocked(createClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createClient>>)
  return { from, query }
}

beforeEach(() => jest.clearAllMocks())

it("adds a segment equality filter without removing the site filter from list or search", async () => {
  const { from, query } = userScopedClient()
  await expect(getLeads(siteId, segmentId)).resolves.toEqual({ leads: [] })
  await expect(searchLeadsWithCount(siteId, "manufacturing", 200, 0, segmentId)).resolves.toEqual({ leads: [], totalCount: 0 })
  expect(from.mock.calls).toHaveLength(2)
  expect(from).toHaveBeenCalledWith("leads")
  expect(query.eq.mock.calls).toEqual([
    ["site_id", siteId], ["segment_id", segmentId],
    ["site_id", siteId], ["segment_id", segmentId],
  ])
  expect(query.range).toHaveBeenCalledWith(0, 199)
})

it("fails closed for malformed segment ids without running a broad list or search", async () => {
  await expect(getLeads(siteId, "")).resolves.toEqual({ leads: [] })
  await expect(searchLeadsWithCount(siteId, "manufacturing", 200, 0, "invalid")).resolves.toEqual({ leads: [], totalCount: 0 })
  expect(createClient).not.toHaveBeenCalled()
})