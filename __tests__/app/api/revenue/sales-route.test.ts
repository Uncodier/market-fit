/** @jest-environment node */

import { GET } from "@/app/api/sales/route"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { createClient } from "@/lib/supabase/server"
import { readThroughAnalyticsResponseCache } from "@/lib/redis/analytics-response-cache"
import { salesTestClient } from "./sales-test-client"

jest.mock("@/lib/auth/api-analytics-access", () => ({ requireAnalyticsAccess: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/redis/analytics-response-cache", () => ({ readThroughAnalyticsResponseCache: jest.fn(({ load }) => load()) }))

const siteId = "00000000-0000-4000-8000-000000000001"
const request = (extra = {}) => new Request(`http://localhost/api/sales?${new URLSearchParams({ siteId, startDate: "2025-02-01", endDate: "2025-02-02", ...extra })}`)
const create = createClient as jest.Mock
const auth = requireAnalyticsAccess as jest.Mock

describe("raw sales route compatibility and safeguards", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    auth.mockResolvedValue({ siteId, userId: "viewer" })
    create.mockResolvedValue(salesTestClient({}))
  })

  it("authorizes before any cache lookup or database access", async () => {
    auth.mockResolvedValue({ error: Response.json({ error: "Forbidden" }, { status: 403 }) })
    expect((await GET(request())).status).toBe(403)
    expect(readThroughAnalyticsResponseCache).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it("keeps completed/created_at semantics and includes date-only end evenings", async () => {
    const client = salesTestClient({ sales: [
      { id: "late", status: "completed", created_at: "2025-02-02T23:59:59Z", amount: 5 },
      { id: "next", status: "completed", created_at: "2025-02-03T00:00:00Z", amount: 10 },
      { id: "pending", status: "pending", created_at: "2025-02-01T00:00:00Z", amount: 20 },
    ].map((row) => ({ ...row, site_id: siteId, currency: "USD" })) })
    create.mockResolvedValue(client)
    const response = await GET(request())
    expect((await response.json()).map((row: any) => row.id)).toEqual(["late"])
    expect(readThroughAnalyticsResponseCache).toHaveBeenCalledWith(expect.objectContaining({ namespace: "sales-v2:viewer", siteId }))
    expect(client.calls.some((call) => call.method === "select" && call.args[0] === "*")).toBe(false)
  })

  it("fails when the safety ceiling would truncate totals", async () => {
    create.mockResolvedValue(salesTestClient({ sales: ["a", "b"].map((id) => ({ id, site_id: siteId, status: "completed", created_at: "2025-02-01T00:00:00Z", amount: 1 })) }))
    const response = await GET(request({ limit: "1" }))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("shorter period") })
  })

  it.each(["0", "-1", "2.5", "50001", "nonsense"])("validates limit %s before database access", async (limit) => {
    expect((await GET(request({ limit }))).status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it("preserves timestamp range precision and future dates rather than rewriting the year", async () => {
    const client = salesTestClient({})
    create.mockResolvedValue(client)
    await GET(request({ startDate: "2030-02-01T12:00:00Z", endDate: "2030-02-02T13:00:00Z" }))
    expect(client.calls).toContainEqual({ table: "sales", method: "gte", args: ["created_at", "2030-02-01T12:00:00Z"] })
    expect(client.calls).toContainEqual({ table: "sales", method: "lte", args: ["created_at", "2030-02-02T13:00:00Z"] })
  })
})