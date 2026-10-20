/** @jest-environment node */
import { NextResponse } from "next/server"
import { POST } from "@/app/api/agent-channels/[siteId]/enabled/route"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { createServiceClient } from "@/lib/supabase/server"

jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
const siteId = "10000000-0000-4000-8000-000000000001"
const actorId = "10000000-0000-4000-8000-000000000002"
const connectionId = "whatsapp-1"
const context = { params: Promise.resolve({ siteId }) }
const channels = { connections: [{ id: connectionId, type: "whatsapp", status: "disabled" }] }
const rpc = jest.fn()
function request(body: unknown = { connectionId, enabled: false }) {
  return new Request(`http://localhost/api/agent-channels/${siteId}/enabled`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: "session=example" }, body: JSON.stringify(body),
  })
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(requireSiteAccess).mockResolvedValue({ userId: actorId, role: "owner", userEmail: null, supabase: {} as never })
  jest.mocked(createServiceClient).mockResolvedValue({ rpc } as never)
  rpc.mockResolvedValue({ data: { success: true, channels }, error: null })
})

it("uses manager authorization and the session actor, never body identity", async () => {
  const response = await POST(request(), context)
  expect(response.status).toBe(200)
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId, { requireManager: true })
  expect(rpc).toHaveBeenCalledWith("set_site_agent_channel_enabled", {
    p_site_id: siteId, p_connection_id: connectionId, p_enabled: false, p_actor_id: actorId,
  })
  expect(response.headers.get("cache-control")).toBe("private, no-store")
  expect(await response.json()).toEqual({ success: true, channels })
})
it.each([401, 403])("does not create service client after access denial %s", async status => {
  jest.mocked(requireSiteAccess).mockResolvedValue({ error: NextResponse.json({ error: "Denied" }, { status }) })
  expect((await POST(request(), context)).status).toBe(status)
  expect(createServiceClient).not.toHaveBeenCalled()
})
it.each([{}, null, { connectionId, enabled: "false" }, { connectionId: "", enabled: false },
  { connectionId, enabled: true, userId: actorId }, { connectionId, enabled: true, addons_count: 100 },
])("rejects malformed or forged input %j", async body => {
  expect((await POST(request(body), context)).status).toBe(400)
  expect(createServiceClient).not.toHaveBeenCalled()
})
it("rejects demo/invalid sites before lookup", async () => {
  expect((await POST(request(), { params: Promise.resolve({ siteId: "demo-site" }) })).status).toBe(400)
  expect(requireSiteAccess).not.toHaveBeenCalled()
})
it("reports cap races through the existing upgrade contract", async () => {
  rpc.mockResolvedValue({ data: { success: false, code: "ACCOUNT_LIMIT" }, error: null })
  const response = await POST(request({ connectionId, enabled: true }), context)
  expect(response.status).toBe(409)
  expect(await response.json()).toMatchObject({ error: { code: "ACCOUNT_LIMIT" } })
})
it.each(["PGRST202", "42883", "40001"])("fails closed for unavailable migration/concurrency %s", async code => {
  rpc.mockResolvedValue({ error: { code, message: "private provider data" } })
  const response = await POST(request(), context)
  expect(response.status).toBe(503)
  expect(JSON.stringify(await response.json())).not.toContain("private provider data")
})
it.each([null, { success: true, channels: { connections: [] } }, { success: true, channels: { connections: [{ id: connectionId }, { id: connectionId }] } }])(
  "rejects unconfirmed or duplicate canonical responses %j", async data => {
    rpc.mockResolvedValue({ data, error: null })
    expect((await POST(request(), context)).status).toBe(503)
  },
)