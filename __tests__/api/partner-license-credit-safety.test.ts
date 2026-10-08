/** @jest-environment node */
import { randomUUID } from "node:crypto"
import type { NextRequest } from "next/server"
const mockAccess = jest.fn()
const mockRpc = jest.fn()
jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: (...args: unknown[]) => mockAccess(...args) }))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: async () => ({ rpc: mockRpc }) }))
import { POST } from "@/app/api/partner-license/apply/route"

describe("partner license changes preserve classified credit balances", () => {
  const site = randomUUID(), actor = randomUUID(), license = randomUUID()
  const request = () => new Request("https://app.example.test/api/partner-license/apply", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ site_id: site, license_key: license }),
  }) as NextRequest
  beforeEach(() => { jest.clearAllMocks(); mockAccess.mockResolvedValue({ userId: actor, role: "owner" }); mockRpc.mockResolvedValue({ data: { success: true, plan: "foundry" }, error: null }) })

  it("requires manager authorization before service-role writes", async () => {
    mockAccess.mockResolvedValue({ error: Response.json({ error: "Forbidden" }, { status: 403 }) })
    expect((await POST(request())).status).toBe(403)
    expect(mockAccess).toHaveBeenCalledWith(expect.anything(), site, { requireManager: true })
    expect(mockRpc).not.toHaveBeenCalled()
  })
  it("atomically claims the license without client prices, plans or credit balances", async () => {
    expect((await POST(request())).status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith("apply_site_partner_license", { p_license_key: license, p_site_id: site, p_actor_id: actor })
  })
  it("rejects transferring an already bound license to another site", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "PARTNER_LICENSE_LINKED" } })
    expect((await POST(request())).status).toBe(409)
  })

  it.each([["42501", "Denied", 403], ["22023", "Not active", 400], ["P0001", "PARTNER_STRIPE_CONFLICT", 409], ["P0001", "PARTNER_BILLING_MISSING", 409], ["PGRST202", "Missing function", 503]])("maps %s safely without raw provider errors", async (code, message, status) => {
    mockRpc.mockResolvedValue({ data: null, error: { code, message } })
    expect((await POST(request())).status).toBe(status)
  })

  it("fails closed when the RPC does not confirm a recognized paid plan", async () => {
    mockRpc.mockResolvedValue({ data: { success: true, plan: "forged" }, error: null })
    expect((await POST(request())).status).toBe(503)
  })
})