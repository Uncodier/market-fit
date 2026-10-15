/** @jest-environment node */
import { randomBytes, randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { GET, PUT } from "@/app/api/marketplace/integrations/route"
import { createServiceClient } from "@/lib/supabase/server"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { encryptMarketplaceCredentials, decryptMarketplaceCredentials } from "@/lib/marketplace/encryption"

jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn(), isSiteManagerRole: (role: string) => role === "owner" || role === "admin" }))
const synthetic = () => randomBytes(24).toString("hex")
const siteId = randomUUID(), locationId = randomUUID(), integrationId = randomUUID(), secretId = randomUUID(), actor = randomUUID()
const row = { id: integrationId, site_id: siteId, provider: "rappi", environment: "sandbox", country: "MX",
  external_store_id: "store-7", origin_location_id: locationId, secret_id: secretId, enabled: true, manual_ready: false, created_by_user_id: actor }
const baseInput = { siteId, provider: row.provider, environment: row.environment, country: row.country,
  external_store_id: row.external_store_id, origin_location_id: locationId, enabled: true }
function put(input: object, origin?: string) {
  return new Request("https://app.example.test/api/marketplace/integrations", {
    method: "PUT", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(input),
  })
}
function query(data: unknown) {
  const result = { data, error: null }
  const q = { select: jest.fn(), eq: jest.fn(), is: jest.fn(), like: jest.fn(), order: jest.fn(), maybeSingle: jest.fn(async () => result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)) }
  for (const method of [q.select, q.eq, q.is, q.like, q.order]) method.mockReturnValue(q)
  return q
}

describe("marketplace integration routes", () => {
  let key: string | undefined, origin: string | undefined
  const permission = jest.fn()
  beforeEach(() => {
    jest.clearAllMocks()
    key = process.env.ENCRYPTION_KEY; origin = process.env.NEXT_PUBLIC_APP_URL
    process.env.ENCRYPTION_KEY = synthetic(); delete process.env.NEXT_PUBLIC_APP_URL
    permission.mockResolvedValue({ data: true, error: null })
    jest.mocked(requireSiteAccess).mockResolvedValue({ role: "admin", userId: actor, userEmail: null, supabase: { rpc: permission } })
  })
  afterEach(() => {
    if (key === undefined) delete process.env.ENCRYPTION_KEY; else process.env.ENCRYPTION_KEY = key
    if (origin === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = origin
  })
  function database(options: { existing?: boolean; location?: boolean; credentials?: { client_id: string; client_secret: string; webhook_secret: string }; rpcError?: { code: string; message: string } } = {}) {
    const from = jest.fn((table: string) => query(table === "locations" ? (options.location === false ? null : { id: locationId })
      : table === "marketplace_integrations" ? (options.existing ? row : null)
      : { encrypted_value: encryptMarketplaceCredentials(options.credentials!) }))
    const rpc = jest.fn(async (_name: string, parameters: { p_config: Record<string, unknown>; p_secret_id: string; p_actor_user_id: string; p_encrypted_credentials: string | null }) => ({ data: { ...row, ...parameters.p_config }, error: options.rpcError || null }))
    const service = { from, rpc }
    jest.mocked(createServiceClient).mockResolvedValue(service)
    return service
  }
  it.each([401, 403])("rejects unauthorized writes (%s) before creating a service client", async status => {
    jest.mocked(requireSiteAccess).mockResolvedValue({ error: NextResponse.json({ error: "Denied" }, { status }) })
    expect((await PUT(put(baseInput))).status).toBe(status)
    expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId, { requireManager: true })
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  it("requires update permission and rejects cross-origin writes", async () => {
    permission.mockResolvedValue({ data: false, error: null })
    expect((await PUT(put(baseInput))).status).toBe(403)
    expect(permission).toHaveBeenCalledWith("user_can", { p_site_id: siteId, p_command: "update" })
    expect(createServiceClient).not.toHaveBeenCalled()
    expect((await PUT(put(baseInput, "https://foreign.example.test"))).status).toBe(403)
  })
  it("rejects cross-tenant locations and non-owned integration IDs", async () => {
    const service = database({ location: false })
    expect((await PUT(put(baseInput))).status).toBe(400)
    expect(service.rpc).not.toHaveBeenCalled()
    database()
    expect((await PUT(put({ ...baseInput, integrationId }))).status).toBe(404)
  })
  it("atomically creates integration and native encrypted credentials without returning any sensitive values", async () => {
    const credentials = { client_id: synthetic(), client_secret: synthetic(), webhook_secret: synthetic() }
    const service = database()
    const response = await PUT(put({ ...baseInput, ...credentials }))
    expect(response.status).toBe(200)
    expect(createServiceClient).toHaveBeenCalledWith(true)
    const [name, params] = service.rpc.mock.calls[0]
    expect(name).toBe("save_marketplace_integration")
    expect(params.p_actor_user_id).toBe(actor)
    expect(params.p_config.manual_ready).toBe(false)
    expect(decryptMarketplaceCredentials(params.p_encrypted_credentials!)).toEqual(credentials)
    const serialized = await response.text()
    for (const sensitive of [...Object.values(credentials), secretId, params.p_secret_id, params.p_encrypted_credentials]) expect(serialized).not.toContain(sensitive)
    expect(service.from.mock.calls.every(([table]) => table !== "site_secrets")).toBe(true)
  })
  it("preserves omitted credentials when replacing one value, and sends NULL for noncredential edits", async () => {
    const previous = { client_id: synthetic(), client_secret: synthetic(), webhook_secret: synthetic() }
    const nextSecret = synthetic()
    const service = database({ existing: true, credentials: previous })
    expect((await PUT(put({ ...baseInput, integrationId, client_secret: nextSecret }))).status).toBe(200)
    expect(decryptMarketplaceCredentials(service.rpc.mock.calls[0][1].p_encrypted_credentials!)).toEqual({ ...previous, client_secret: nextSecret })
    expect(service.rpc.mock.calls[0][1].p_secret_id).toBe(secretId)
    const noncredential = database({ existing: true })
    expect((await PUT(put({ ...baseInput, integrationId, enabled: false }))).status).toBe(200)
    expect(noncredential.rpc.mock.calls[0][1].p_encrypted_credentials).toBeNull()
    expect(noncredential.from.mock.calls.some(([table]) => table === "site_secrets")).toBe(false)
  })
  it("fails closed on absent credentials, empty updates and missing encryption key", async () => {
    const credentials = { client_id: synthetic(), client_secret: synthetic(), webhook_secret: synthetic() }
    const service = database()
    expect((await PUT(put(baseInput))).status).toBe(400)
    expect((await PUT(put({ ...baseInput, ...credentials, client_secret: "" }))).status).toBe(400)
    delete process.env.ENCRYPTION_KEY
    const response = await PUT(put({ ...baseInput, ...credentials }))
    expect(response.status).toBe(500)
    for (const sensitive of Object.values(credentials)) expect(await response.clone().text()).not.toContain(sensitive)
    expect(service.rpc).not.toHaveBeenCalled()
  })
  it("hides internal database errors and rejects immutable identity changes", async () => {
    const secret = synthetic()
    database({ existing: true, rpcError: { code: "internal", message: secret } })
    const response = await PUT(put({ ...baseInput, integrationId }))
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain(secret)
    expect((await PUT(put({ ...baseInput, integrationId, environment: "production" }))).status).toBe(409)
  })
  it("GET checks membership before service access and only returns native credential presence", async () => {
    const request = new Request(`https://app.example.test/api/marketplace/integrations?siteId=${siteId}`)
    jest.mocked(requireSiteAccess).mockResolvedValueOnce({ error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) })
    expect((await GET(request)).status).toBe(401)
    expect(createServiceClient).not.toHaveBeenCalled()
    const secret = synthetic()
    const from = jest.fn((table: string) => query(table === "marketplace_integrations" ? [{ ...row, client_secret: secret }]
      : table === "locations" ? [{ id: locationId, name: "Kitchen" }]
      : [{ id: secretId, provider: "rappi", use_case: `marketplace:${integrationId}` }]))
    jest.mocked(createServiceClient).mockResolvedValue({ from })
    delete process.env.ENCRYPTION_KEY
    const response = await GET(request)
    expect(response.headers.get("cache-control")).toContain("no-store")
    const serialized = await response.text()
    expect(serialized).not.toContain(secret)
    expect(serialized).not.toContain(secretId)
    expect(JSON.parse(serialized).integrations[0].has_credentials).toEqual({ client_id: true, client_secret: true, webhook_secret: true })
    expect(JSON.parse(serialized).can_manage).toBe(true)
  })
})