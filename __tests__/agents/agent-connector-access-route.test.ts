/** @jest-environment node */
import { GET } from "@/app/api/connectors/agent-access/route"
import { createClient } from "@/lib/supabase/server"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const site = "11111111-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const agent = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const actor = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
const url = `https://workspace.example/api/connectors/agent-access?site_id=${site}&agent_id=${agent}`
const session = jest.fn()
const rpc = jest.fn()
const agentQuery = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), abortSignal: jest.fn().mockReturnThis(), maybeSingle: jest.fn() }
const accounts = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), abortSignal: jest.fn() }
const from = jest.fn((table: string) => table === "agents" ? agentQuery : accounts)

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: session }, rpc, from })
  session.mockResolvedValue({ data: { user: { id: actor } } })
  rpc.mockResolvedValue({ data: [{ can_view: true, can_manage: true }] })
  agentQuery.maybeSingle.mockResolvedValue({ data: { id: agent, status: "active" } })
  accounts.abortSignal.mockResolvedValue({ data: [], count: 0 })
})

it("rejects duplicate input and cross-site requests before opening a session", async () => {
  expect((await GET(new Request(`${url}&site_id=${site}`))).status).toBe(400)
  expect((await GET(new Request(url, { headers: { "Sec-Fetch-Site": "cross-site" } }))).status).toBe(403)
  expect(createClient).not.toHaveBeenCalled()
})

it("does not query grants without actor-bound manager authorization or a same-site agent", async () => {
  session.mockResolvedValueOnce({ data: { user: null } })
  expect((await GET(new Request(url))).status).toBe(401)
  rpc.mockResolvedValueOnce({ data: [{ can_view: true, can_manage: false }] })
  expect((await GET(new Request(url))).status).toBe(403)
  expect(from).not.toHaveBeenCalled()
  agentQuery.maybeSingle.mockResolvedValueOnce({ data: null })
  expect((await GET(new Request(url))).status).toBe(404)
  expect(from.mock.calls).toEqual([["agents"]])
  expect(agentQuery.eq.mock.calls).toEqual([["site_id", site], ["id", agent]])
})

it("separates live explicit grants, unavailable assignments and eligible unassigned workspace accounts", async () => {
  const base = { toolkit_slug: "gmail", display_name: "Mail", revision: 1, enabled: true, provider_status: "ACTIVE", revocation_pending: false, access_mode: "workspace", ignored: "private" }
  const grant = { enabled: true, expires_at: null, revoked_at: null }
  const row = (index: number) => ({ ...base, id: `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee${index}` })
  accounts.abortSignal.mockResolvedValueOnce({ count: 6, data: [
    { ...row(1), grants: [grant] }, { ...row(2), grants: [] },
    { ...row(3), grants: [{ ...grant, expires_at: "2020-01-01T00:00:00Z" }] },
    { ...row(4), grants: [{ ...grant, revoked_at: "2020-01-01T00:00:00Z" }] },
    { ...row(5), revocation_pending: true, grants: [grant] }, { ...row(6), enabled: false, grants: [] },
  ] })
  const result = await GET(new Request(url))
  expect(result.status).toBe(200)
  expect(result.headers.get("cache-control")).toBe("private, no-store")
  expect(rpc).toHaveBeenCalledWith("connector_site_access", { p_site_id: site, p_user_id: actor })
  expect(accounts.eq.mock.calls).toEqual([["site_id", site], ["grants.agent_id", agent]])
  const dto = (index: number) => ({ id: row(index).id, toolkit_slug: "gmail", display_name: "Mail", revision: 1 })
  expect(await result.json()).toEqual({ active: true, assigned: [{ ...dto(1), available: true }, { ...dto(5), available: false }], available: [dto(2), dto(3), dto(4)] })
})

it("does not treat an incomplete database result as a complete directory", async () => {
  accounts.abortSignal.mockResolvedValueOnce({ data: [], count: 1 })
  expect((await GET(new Request(url))).status).toBe(503)
})