/** @jest-environment node */
import { randomUUID } from "node:crypto"
import type { NextRequest } from "next/server"
const mockAccess = jest.fn()
const mockFrom = jest.fn()
jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: (...args: unknown[]) => mockAccess(...args) }))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: async () => ({ from: mockFrom }) }))
import { POST } from "@/app/api/partner-license/apply/route"

describe("partner license changes preserve classified credit balances", () => {
  const site = randomUUID(), actor = randomUUID(), license = randomUUID()
  const request = () => new Request("https://app.example.test/api/partner-license/apply", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ site_id: site, license_key: license }),
  }) as NextRequest
  beforeEach(() => { jest.clearAllMocks(); mockAccess.mockResolvedValue({ userId: actor, role: "owner" }) })

  it("requires manager authorization before service-role writes", async () => {
    mockAccess.mockResolvedValue({ error: Response.json({ error: "Forbidden" }, { status: 403 }) })
    expect((await POST(request())).status).toBe(403)
    expect(mockAccess).toHaveBeenCalledWith(expect.anything(), site, { requireManager: true })
    expect(mockFrom).not.toHaveBeenCalled()
  })
  it("applies only entitlement fields and never reads or overwrites the aggregate", async () => {
    const updates: Record<string, unknown>[] = []
    const query = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), or: jest.fn().mockReturnThis(),
      update: jest.fn().mockImplementation((payload: Record<string, unknown>): void => { updates.push(payload) }),
      single: jest.fn().mockResolvedValueOnce({ data: { id: license, site_id: null, status: "active", plan_name: "foundry" }, error: null })
        .mockResolvedValueOnce({ data: { id: license }, error: null }),
      then: (resolve: (result: { error: null }) => void) => resolve({ error: null }),
    }
    query.update.mockImplementation((payload: Record<string, unknown>) => { updates.push(payload); return query })
    mockFrom.mockReturnValue(query)
    expect((await POST(request())).status).toBe(200)
    expect(updates).toContainEqual(expect.objectContaining({ plan: "foundry", subscription_status: "active" }))
    for (const payload of updates) expect(payload).not.toHaveProperty("credits_available")
    expect(query.select).not.toHaveBeenCalledWith("credits_available")
  })
  it("rejects transferring an already bound license to another site", async () => {
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: async () => ({
      data: { site_id: randomUUID(), status: "active" }, error: null,
    }) }
    mockFrom.mockReturnValue(query)
    expect((await POST(request())).status).toBe(409)
  })
})