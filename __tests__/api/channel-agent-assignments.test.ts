/** @jest-environment node */
import { NextResponse } from "next/server"
import { GET, PATCH } from "@/app/api/agent-channels/[siteId]/assignments/route"
import { requireSiteAccess } from "@/lib/auth/api-site-access"

jest.mock("@/lib/auth/api-site-access", () => ({
  ...jest.requireActual("@/lib/auth/api-site-access"), requireSiteAccess: jest.fn(),
}))

const id = (n: number) => `10000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`
const site = id(1), actor = id(2), support = id(10), later = id(11), inactive = id(12), sales = id(13), deleted = id(14)
const context = { params: Promise.resolve({ siteId: site }) }
const table = "channel_agent_assignments"
const time = (n: number) => `2026-11-20T09:00:00.${n.toString().padStart(6, "0")}+00:00`
const agent = (agentId: string, role: string | null, status: string, created: number, updated: number, provider: string | null) => ({
  id: agentId, name: `Agent ${agentId}`, role, status, created_at: time(created), updated_at: time(updated), provider_agent: provider,
})
const agentRows = [agent(support, "Customer Support", "active", 100, 400, "voice-x"),
  agent(later, "Customer Support", "active", 200, 300, "voice-y"),
  agent(inactive, "Customer Support", "inactive", 300, 500, "voice-z"), agent(sales, null, "active", 500, 600, null)]
const assigned = { connectionId: "sms-a", agentId: deleted, revision: 3 }
const cleared = { connectionId: "website", agentId: null, revision: 2 }
type Result = { data?: unknown; error?: { code: string; message?: string } | null; count?: number }
let results: Record<string, Result>
const calls = jest.fn()
let maxRows: number
const from = jest.fn((name: string) => ({
  select: (fields: string, options?: unknown) => {
    calls(name, "select", fields, options)
    let offset = 0, end = Infinity
    const query = {
      eq(field: string, value: string) { calls(name, "eq", field, value); return this },
      order(field: string) { calls(name, "order", field); return this },
      range(start: number, to: number) { offset = start; end = to; return this },
      abortSignal() { return this },
      maybeSingle: () => Promise.resolve(results[name]),
      then(resolve: (result: Result) => void) {
        const result = results[name]
        resolve(Array.isArray(result.data)
          ? { ...result, count: result.count ?? result.data.length, data: result.data.slice(offset, Math.min(end + 1, offset + maxRows)) }
          : result)
      },
    }
    return query
  },
}))
const rpc = jest.fn()
const access = (role = "owner") => jest.mocked(requireSiteAccess).mockResolvedValue({
  role, userEmail: null, userId: actor, supabase: { rpc, from },
})
function get() { return GET(new Request(`http://localhost/api/agent-channels/${site}/assignments`), context) }
const input = { connectionId: "sms-a", agentId: sales, expectedRevision: 3 }
function patch(body: unknown = input) {
  const req = new Request(`http://localhost/api/agent-channels/${site}/assignments`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  })
  return PATCH(req, context)
}

const schemaEnv = process.env.NEXT_PUBLIC_APPS_TENANT_SCHEMA
beforeEach(() => {
  jest.clearAllMocks(); maxRows = 1000
  process.env.NEXT_PUBLIC_APPS_TENANT_SCHEMA = "public"
  results = {
    agents: { data: agentRows }, settings: { data: { connections: [
      { id: "sms-a", type: "sms", zavu_sender_id: "same" },
      { id: "voice-a", type: "voice", zavu_sender_id: "same", metadata: { zavu_agent_id: "voice-z", secret: "never-serialize" } },
      { id: "unmapped", type: "voice" }, { id: "dup" }, { id: "dup" }, { type: "email" }, { id: " " },
    ] } }, [table]: { data: [assigned, cleared] },
  }
  access()
  rpc.mockImplementation((name: string) => name === "current_user_has_location_restrictions"
    ? { data: false, error: null } : { data: { connectionId: input.connectionId, agentId: input.agentId, revision: 4 }, error: null })
})
afterEach(() => {
  if (schemaEnv == null) delete process.env.NEXT_PUBLIC_APPS_TENANT_SCHEMA
  else process.env.NEXT_PUBLIC_APPS_TENANT_SCHEMA = schemaEnv
})

it("returns every distinct site agent and explicit/cleared rows separately from actual legacy defaults and recorded Voice", async () => {
  maxRows = 2 // Simulate an enforced PostgREST row cap, not just a full first page.
  const response = await get()
  expect(response.status).toBe(200)
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  expect(await response.json()).toEqual({
    agents: agentRows.map(({ id, name, role, status }) => ({ id, name, role, status })),
    connections: [['website', 'website'], ['sms-a', 'sms'], ['voice-a', 'voice'], ['unmapped', 'voice']].map(([id, type]) => ({
      id, type, label: '', account: '', status: 'unknown',
    })),
    connectionIds: ["website", "sms-a", "voice-a", "unmapped"], assignments: [assigned, cleared],
    defaultAgentId: later, voiceDefaultAgentId: inactive, voiceAgentIdsByConnection: { "voice-a": inactive, unmapped: null }, canManage: true,
  })
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), site, { requireManager: false })
  for (const name of ["settings", table, "agents"]) expect(calls).toHaveBeenCalledWith(name, "eq", "site_id", site)
  expect(calls).toHaveBeenCalledWith("agents", "select", "id,name,role,status,created_at,updated_at,provider_agent:configuration->zavu->agent_id,agent_origin:configuration->>agentOrigin", { count: "exact" })
  expect(calls).toHaveBeenCalledWith("settings", "select", "connections:channels->connections,websiteChat:channels->website->enable_chat", undefined)
})

it('projects account labels and activation without raw metadata; an independent Support agent is never the site default', async () => {
  const custom = { ...agent(id(22), 'Customer Support', 'active', 800, 900, null), agent_origin: 'independent' }
  results.agents.data = [...agentRows, custom]
  results.settings.data = { websiteChat: false, connections: [
    { id: 'number-a', name: 'Sales', type: 'whatsapp', status: 'connected', metadata: { phone_number: '+15555550120', secret: 'do-not-expose' } },
    { id: 'inbox', type: 'email', status: 'connected', enabled: false, metadata: { from_address: 'sales@example.test', secret: 'do-not-expose' } },
    { id: 'starting', type: 'telegram', status: 'connected', metadata: { bot_username: 'support', activation_pending: true } },
  ] }
  const body = await (await get()).json()
  expect(body).toMatchObject({ defaultAgentId: later, voiceDefaultAgentId: inactive, agents: expect.arrayContaining([expect.objectContaining({ id: custom.id })]) })
  expect(body.connections).toEqual([
    { id: 'website', type: 'website', label: '', account: '', status: 'inactive' },
    { id: 'number-a', type: 'whatsapp', label: 'Sales', account: '+1 (555) 555-0120', status: 'active' },
    { id: 'inbox', type: 'email', label: '', account: 'sales@example.test', status: 'inactive' },
    { id: 'starting', type: 'telegram', label: '', account: '@support', status: 'pending' },
  ])
  expect(JSON.stringify(body)).not.toContain('do-not-expose')
})
it("ordinary members can view but not manage; ambiguous registrations and default ties are not guessed", async () => {
  access("collaborator")
  results.agents.data = [...agentRows, agent(id(20), "Customer Support", "active", 200, 500, "voice-z")]
  expect(await (await get()).json()).toMatchObject({ canManage: false, voiceDefaultAgentId: null, defaultAgentId: null,
    voiceAgentIdsByConnection: { "voice-a": null } })
})
it.each([
  { code: "PGRST205", message: "Could not find the table 'public.channel_agent_assignments' in the schema cache" },
  { code: "42P01", message: 'relation "public.channel_agent_assignments" does not exist' },
])("returns defaults before the assignment migration only for its precise missing relation: $code", async error => {
  results[table] = { error }
  const response = await get()
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ canManage: false, assignmentsAvailable: false, defaultAgentId: later,
    voiceDefaultAgentId: inactive, voiceAgentIdsByConnection: { "voice-a": inactive }, assignments: [], connectionIds: expect.arrayContaining(["website"]) })
})
it.each([
  [table, { code: "PGRST205", message: "Could not find the table 'public.agents' in the schema cache" }, 503],
  [table, { code: "42P01", message: 'relation "private.other" does not exist' }, 503],
  [table, { code: "42501", message: "private denial" }, 403], [table, { code: "08000" }, 503],
  ["settings", { code: "42501" }, 403], ["agents", { code: "PGRST205" }, 503],
] as const)("does not downgrade %s errors to an empty/default result", async (name, error, status) => {
  results[name] = { error }
  const response = await get()
  expect(response.status).toBe(status)
  const json = await response.json()
  expect(Object.keys(json)).toEqual(["error"])
  expect(JSON.stringify(json)).not.toContain("private")
})
it("rejects truncation and reserved collisions rather than mislabeling agents", async () => {
  results.agents.count = 200
  expect((await get()).status).toBe(503)
  delete results.agents.count
  results.settings.data = { connections: [{ id: "website" }] }
  expect((await get()).status).toBe(409)
})
it.each([401, 403])("propagates auth failure before any data access: %i", async status => {
  jest.mocked(requireSiteAccess).mockResolvedValue({ error: NextResponse.json({ error: "Denied" }, { status }) })
  expect((await get()).status).toBe(status)
  expect((await patch()).status).toBe(status)
  expect(from).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled()
})
it("rejects demo IDs, globally restricted actors, and alternate schemas instead of mixing inventories", async () => {
  expect((await GET(new Request("http://localhost"), { params: Promise.resolve({ siteId: "demo-a" }) })).status).toBe(400)
  expect(requireSiteAccess).not.toHaveBeenCalled()
  rpc.mockReturnValueOnce({ data: true, error: null }); expect((await get()).status).toBe(403)
  rpc.mockReturnValueOnce({ error: { code: "08000" } }); expect((await patch()).status).toBe(503)
  process.env.NEXT_PUBLIC_APPS_TENANT_SCHEMA = "other"
  expect((await get()).status).toBe(503); expect((await patch()).status).toBe(503)
  expect(from).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledTimes(2)
})
it("uses the guarded caller's RPC for only the exact requested fields", async () => {
  const response = await patch()
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ assignment: { connectionId: "sms-a", agentId: sales, revision: 4 } })
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), site, { requireManager: true })
  expect(rpc).toHaveBeenCalledWith("set_channel_agent_assignment", {
    p_site_id: site, p_connection_id: "sms-a", p_agent_id: sales, p_expected_revision: 3,
  })
  expect(from).not.toHaveBeenCalled()
})
it.each([{}, null, { ...input, siteId: site }, { ...input, actorId: actor }, { ...input, agentId: undefined },
  { ...input, expectedRevision: -1 }, { ...input, expectedRevision: "0" }, { ...input, expectedRevision: 2.2 },
  { ...input, connectionId: " sms-a" }, { ...input, connectionId: "x\n" }, { ...input, agentId: "arbitrary" },
])("rejects malformed or forged inputs: %j", async body => {
  expect((await patch(body)).status).toBe(400)
  expect(rpc).toHaveBeenCalledTimes(1)
})
it("bounds streamed bodies and never confirms an unverified mutation", async () => {
  expect((await patch({ ...input, extra: "x".repeat(4096) })).status).toBe(413)
  rpc.mockReturnValueOnce({ data: false, error: null }).mockReturnValueOnce({ data: cleared, error: null })
  expect((await patch()).status).toBe(503)
})
it.each([["42501", 403], ["PT404", 404], ["PT409", 409], ["PT422", 422], ["PGRST202", 503], ["42P01", 503]] as const)(
  "distinguishes mutation error %s", async (code, status) => {
    rpc.mockReturnValueOnce({ data: false, error: null }).mockReturnValueOnce({ error: { code, message: "private detail" } })
    const response = await patch({ ...input, agentId: null })
    expect(response.status).toBe(status); expect(await response.text()).not.toContain("private detail")
  })