/** @jest-environment node */
import { POST } from "@/app/api/agents/create/route"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"

jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))
jest.mock("@/lib/permissions/site-access", () => ({ userCanOnSite: jest.fn() }))
const access = jest.mocked(requireSiteAccess)
const can = jest.mocked(userCanOnSite)
const siteId = "a8b22222-2222-4222-8222-0123456789ab"
const actor = "b8b22222-2222-4222-8222-0123456789ab"
const fields = { siteId, creationId: "c8b22222-2222-4222-8222-0123456789ab", name: "Customer Support",
  role: "Customer Support", description: "", prompt: "", backstory: "" }
const request = (changes = {}, headers = {}) => new Request("https://app.example.test/api/agents/create", {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ ...fields, ...changes }),
})
type Row = Record<string, unknown> & { id: string; configuration: Record<string, unknown> }
const rows = new Map<string, Row>()
const insert = jest.fn((row: Row) => ({ select: () => ({ single: async () => {
  if (rows.has(row.id)) return { error: { code: "23505" }, data: null }
  rows.set(row.id, row)
  return { error: null, data: { id: row.id } }
} }) }))
const select = jest.fn((columns: string) => {
  const filters = new Map<string, string>()
  const query = {
    eq: (field: string, val: string) => { filters.set(field, val); return query },
    abortSignal: () => query,
    maybeSingle: async () => {
      const row = rows.get(filters.get("id") || "")
      const matches = row && [...filters].every(([key, val]) => (key.startsWith("configuration->>")
        ? row.configuration[key.slice("configuration->>".length)] : row[key]) === val)
      return { error: null, data: matches ? { id: row.id, ...(columns.includes('supervisor') && { supervisor: row.supervisor ?? null }) } : null }
    },
  }
  return query
})
const from = jest.fn(() => ({ insert, select }))

beforeEach(() => {
  jest.clearAllMocks()
  rows.clear()
  access.mockResolvedValue({ userId: actor, role: "collaborator", userEmail: null,
    supabase: { from } as unknown as NonNullable<Awaited<ReturnType<typeof requireSiteAccess>>["supabase"]> })
  can.mockResolvedValue(true)
})

it("creates two independent same-role/name rows, without changing a default or provisioning anything else", async () => {
  const defaultRow = { ...fields, id: "existing", prompt: "Default support prompt", configuration: {} }
  rows.set(defaultRow.id, defaultRow)
  const first = await POST(request())
  const second = await POST(request({ creationId: "f8b22222-2222-4222-8222-0123456789ab" }))
  expect([first.status, second.status]).toEqual([201, 201])
  const { id } = await first.json()
  expect(await second.json()).not.toEqual({ id })
  expect(rows.size).toBe(3)
  expect(rows.get("existing")).toBe(defaultRow)
  expect(rows.get(id)).toMatchObject({ user_id: actor, site_id: siteId, status: "inactive", type: "support",
    role: fields.role, name: fields.name, description: "", prompt: "", backstory: null, tools: {}, activities: {},
    integrations: {}, configuration: { agentOrigin: "independent" } })
  expect(can).toHaveBeenCalledWith({ from }, siteId, "insert")
  expect(from.mock.calls).toEqual([["agents"], ["agents"]])
  expect(select).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it("recovers the exact insert on concurrent retry but refuses changed content for the same draft", async () => {
  const results = await Promise.all([POST(request()), POST(request())])
  expect(results.map(r => r.status).sort()).toEqual([200, 201])
  expect(await results[0].json()).toEqual(await results[1].json())
  expect((await POST(request({ name: "A different payload" }))).status).toBe(409)
  expect(rows.size).toBe(1)
  expect([...rows.values()][0].name).toBe(fields.name)
})

it('stores the selected supervisor on create, recovers the same result and rejects a changed supervisor on retry', async () => {
  const parent = '10000000-0000-4000-8000-000000000001'
  rows.set(parent, { id: parent, site_id: siteId, supervisor: null, configuration: {} })
  const result = await POST(request({ supervisor: parent }))
  expect(result.status).toBe(201)
  const { id } = await result.json()
  expect(rows.get(id)?.supervisor).toBe(parent)
  expect((await POST(request({ supervisor: parent }))).status).toBe(200)
  expect((await POST(request({ supervisor: null }))).status).toBe(409)
  expect(rows.get(id)?.supervisor).toBe(parent)
})

it.each(['foreign', 'cycle', 'missing'])('does not insert an agent under a %s supervisor', async kind => {
  const parent = '10000000-0000-4000-8000-000000000001'
  if (kind !== 'missing') rows.set(parent, { id: parent, site_id: kind === 'foreign' ? actor : siteId,
    supervisor: kind === 'cycle' ? parent : null, configuration: {} })
  expect((await POST(request({ supervisor: parent }))).status).toBe(422)
  expect(insert).not.toHaveBeenCalled()
})

it.each([401, 403])("propagates site auth denial %s without a write", async status => {
  const foreignSite = "f8b22222-2222-4222-8222-0123456789ab"
  const req = request({ siteId: foreignSite })
  access.mockResolvedValueOnce({ error: Response.json({ error: "Denied" }, { status }) } as Awaited<ReturnType<typeof requireSiteAccess>>)
  expect((await POST(req)).status).toBe(status)
  expect(access).toHaveBeenCalledWith(req, foreignSite)
  expect(can).not.toHaveBeenCalled()
  expect(from).not.toHaveBeenCalled()
})

it("does not adopt an unrelated conflicting row, even if its name and role match", async () => {
  const { id } = await (await POST(request())).json()
  rows.set(id, { ...rows.get(id)!, site_id: "another-site", user_id: "another-user" })
  expect((await POST(request())).status).toBe(409)
  expect(rows.get(id)).toMatchObject({ user_id: "another-user", site_id: "another-site" })
})

it("requires insert permission even after a site membership check", async () => {
  can.mockResolvedValueOnce(false)
  expect((await POST(request())).status).toBe(403)
  expect(from).not.toHaveBeenCalled()
})

it.each([{ siteId: "foreign" }, { creationId: "new" }, { userId: actor }, { supervisor: 'Customer Support' }, { name: "   " }, { role: "Administrator" },
  { status: "active" }, { tools: { code: true } }, { configuration: { zavu: {} } }, { prompt: "X".repeat(32_001) }])(
  "rejects malformed or privileged creation fields before writing", async changes => {
    expect((await POST(request(changes))).status).toBe(400)
    expect(from).not.toHaveBeenCalled()
  })

it("rejects cross-origin and oversized requests", async () => {
  expect((await POST(request({}, { Origin: "https://other.test" }))).status).toBe(403)
  expect((await POST(request({}, { "content-length": "400000" }))).status).toBe(413)
  expect(from).not.toHaveBeenCalled()
})