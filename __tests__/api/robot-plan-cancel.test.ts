/** @jest-environment node */
import { POST } from "@/app/api/robots/plan/cancel/route"
import { createClient } from "@/lib/supabase/server"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
const planId = "00000000-0000-4000-8000-000000000001"
const instanceId = "00000000-0000-4000-8000-000000000002"
const siteId = "00000000-0000-4000-8000-000000000003"
const receipt = { plan_id: planId, instance_id: instanceId, status: "cancelled", steps_cancelled: 2 }
const auth = { getUser: jest.fn() }
const query = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() }
const rpc = jest.fn(), from = jest.fn()
function request(body: unknown = { plan_id: planId, instance_id: instanceId }, headers = {}) {
  return new Request("http://localhost:3000/api/robots/plan/cancel", {
    method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000", ...headers },
    body: JSON.stringify(body),
  })
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createClient).mockResolvedValue({ auth, from, rpc })
  auth.getUser.mockResolvedValue({ data: { user: { id: "verified" } }, error: null })
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query)
  query.maybeSingle.mockResolvedValue({ data: { id: planId, instance_id: instanceId, site_id: siteId }, error: null })
  from.mockReturnValue(query)
  rpc.mockImplementation(async name => ({ data: name === "current_user_site_role" ? "owner" : name === "user_can" ? true : receipt, error: null }))
})
it.each(["owner", "admin"])("cancels as %s using one scoped atomic RPC", async role => {
  rpc.mockImplementation(async name => ({ data: name === "current_user_site_role" ? role : name === "user_can" ? true : receipt, error: null }))
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ success: true, data: receipt })
  expect(createClient).toHaveBeenCalledWith(true)
  expect(query.eq).toHaveBeenCalledWith("instance_id", instanceId)
  expect(rpc).toHaveBeenCalledWith("cancel_quiescent_instance_plan", { p_plan_id: planId, p_instance_id: instanceId })
  expect(response.headers.get("cache-control")).toBe("no-store, private")
})
it.each([null, { id: "anonymous", is_anonymous: true }])("rejects an unverified user", async user => {
  auth.getUser.mockResolvedValue({ data: { user }, error: null })
  expect((await POST(request())).status).toBe(401)
  expect(from).not.toHaveBeenCalled()
})
it.each([null, "collaborator", "marketing"])("rejects role %s without mutation", async role => {
  rpc.mockResolvedValue({ data: role, error: null })
  expect((await POST(request())).status).toBe(403)
  expect(rpc).not.toHaveBeenCalledWith("cancel_quiescent_instance_plan", expect.anything())
})
it("rejects denied capability and RLS-invisible or mismatched plans", async () => {
  rpc.mockImplementation(async name => ({ data: name === "current_user_site_role" ? "owner" : false, error: null }))
  expect((await POST(request())).status).toBe(403)
  query.maybeSingle.mockResolvedValue({ data: null, error: null })
  expect((await POST(request())).status).toBe(404)
  query.maybeSingle.mockResolvedValue({ data: { id: planId, instance_id: siteId, site_id: siteId }, error: null })
  expect((await POST(request())).status).toBe(404)
})
it.each([
  { plan_id: "bad", instance_id: instanceId },
  { plan_id: planId, instance_id: instanceId, site_id: siteId },
  { plan_id: planId },
])("validates strict inputs", async body => {
  expect((await POST(request(body))).status).toBe(400)
  expect(createClient).not.toHaveBeenCalled()
})
it("bounds bodies, rejects cross-origin and wrong content type", async () => {
  expect((await POST(request(undefined, { origin: "https://attacker.example" }))).status).toBe(403)
  expect((await POST(request(undefined, { "content-type": "text/plain" }))).status).toBe(415)
  expect((await POST(request({ padding: "x".repeat(5000) }))).status).toBe(413)
})
it.each([["PT409",409], ["23514",409], ["PGRST202",503], ["57014",503], ["PT403",403], ["PT404",404]])("sanitizes SQL failure %s without fallback", async (code, status) => {
  rpc.mockImplementation(async name => name === "cancel_quiescent_instance_plan"
    ? { data: null, error: { code, message: "private SQL credential" } }
    : { data: name === "current_user_site_role" ? "owner" : true, error: null })
  const response = await POST(request())
  expect(response.status).toBe(status)
  expect(await response.text()).not.toContain("private")
  expect(from).toHaveBeenCalledTimes(1)
})
it.each([null, { ...receipt, plan_id: siteId }, { ...receipt, steps_cancelled: -1 }])("requires matching cancellation receipt", async data => {
  rpc.mockImplementation(async name => ({ data: name === "current_user_site_role" ? "owner" : name === "user_can" ? true : data, error: null }))
  expect((await POST(request())).status).toBe(502)
})