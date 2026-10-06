/** @jest-environment node */

import { createClient as createRepositoriesClient } from "@supabase/supabase-js"
import { createClient as createMainClient, createServiceClient } from "@/lib/supabase/server"
import { isValidApiKey } from "@/app/lib/api-keys-config"
import { GET } from "@/app/api/applications/tenants/route"

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}))
jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }))
jest.mock("@/app/lib/api-keys-config", () => ({
  getApiKeyFromRequest: jest.fn(() => null),
  isValidApiKey: jest.fn(() => false),
}))

const siteId = "00000000-0000-4000-8000-000000000001"
const requirementId = "00000000-0000-4000-8000-000000000002"
const tenantId = "00000000-0000-4000-8000-000000000003"
const foreignSiteId = "00000000-0000-4000-8000-000000000004"
const tenant = { tenant_id: tenantId, site_id: siteId, schema: "app_test", bucket: "app-test" }

function query(data: unknown, error: unknown = null) {
  const result = { data, error }
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.in.mockReturnValue(builder)
  return builder
}

function setup({
  role = "admin" as string | null,
  user = { id: "test-user" } as { id: string } | null,
  authError = null as unknown,
  requirement = { site_id: siteId } as { site_id: string } | null,
  requirementError = null as unknown,
  tenantData = null as typeof tenant | null,
  tenantError = null as unknown,
} = {}) {
  const requirementQuery = query(requirement, requirementError)
  const tenantQuery = query(tenantData, tenantError)
  const main = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: authError }) },
    rpc: jest.fn().mockResolvedValue({ data: role, error: null }),
    from: jest.fn((table: string) => {
      if (!table) throw new Error("A table name is required")
      return requirementQuery
    }),
  }
  const repositories = { from: jest.fn(() => tenantQuery) }
  ;(createMainClient as jest.Mock).mockResolvedValue(main)
  ;(createServiceClient as jest.Mock).mockResolvedValue(main)
  ;(createRepositoriesClient as jest.Mock).mockReturnValue(repositories)
  return { main, repositories, requirementQuery, tenantQuery }
}

function request(search = `requirementId=${requirementId}`) {
  return new Request(`https://example.test/api/applications/tenants?${search}`)
}

describe("application tenant lookup", () => {
  const originalUrl = process.env.NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL
  const originalKey = process.env.REPOSITORIES_SUPABASE_SECRET_KEY

  beforeEach(() => {
    jest.clearAllMocks()
    ;(isValidApiKey as jest.Mock).mockReturnValue(false)
    process.env.NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL = "https://repositories.example.test"
    process.env.REPOSITORIES_SUPABASE_SECRET_KEY = "test-key"
  })

  afterAll(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL
    else process.env.NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL = originalUrl
    if (originalKey === undefined) delete process.env.REPOSITORIES_SUPABASE_SECRET_KEY
    else process.env.REPOSITORIES_SUPABASE_SECRET_KEY = originalKey
  })

  it.each(["owner", "admin"])("returns an absent optional tenant for an authorized %s", async (role) => {
    const { main, requirementQuery, tenantQuery } = setup({ role })
    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ tenant_id: null, schema: null, bucket: null })
    expect(requirementQuery.eq).toHaveBeenCalledWith("id", requirementId)
    expect(main.rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: siteId })
    expect(tenantQuery.eq).toHaveBeenCalledWith("requirement_id", requirementId)
    expect(main.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      (createRepositoriesClient as jest.Mock).mock.invocationCallOrder[0]
    )
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(createMainClient).toHaveBeenCalledWith(true)
  })

  it("keeps the existing populated requirement tenant DTO", async () => {
    setup({ tenantData: tenant })
    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ tenant_id: tenantId, schema: "app_test", bucket: "app-test" })
  })

  it("does not convert a missing concrete tenant into optional success", async () => {
    setup()
    const response = await GET(request(`tenantId=${tenantId}`))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "Tenant not found" })
  })

  it.each(["requirementId", "tenantId"])("does not mask a %s repository failure as absence", async (parameter) => {
    setup({ tenantError: { code: "42501", message: "private provider details" } })
    const response = await GET(request(`${parameter}=${parameter === "tenantId" ? tenantId : requirementId}`))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Failed to fetch tenant" })
  })

  it("preserves requirement query errors before repository access", async () => {
    setup({ requirementError: { message: "private provider details" } })
    const response = await GET(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Failed to fetch requirement" })
    expect(createRepositoriesClient).not.toHaveBeenCalled()
  })

  it("rejects inconsistent tenant ownership instead of returning foreign data", async () => {
    setup({ tenantData: { ...tenant, site_id: foreignSiteId } })
    const response = await GET(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Tenant site mismatch" })
  })

  it.each([null, "collaborator", "marketing"])("denies a non-manager role %s even when the tenant is absent", async (role) => {
    setup({ role })
    const response = await GET(request())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
    expect(createRepositoriesClient).not.toHaveBeenCalled()
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("does not treat a missing or RLS-hidden requirement as an absent optional tenant", async () => {
    const { main } = setup({ requirement: null })
    const response = await GET(request())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "Requirement not found" })
    expect(main.rpc).not.toHaveBeenCalled()
    expect(createRepositoriesClient).not.toHaveBeenCalled()
  })

  it.each([
    { user: null, authError: null },
    { user: { id: "test-user" }, authError: { message: "invalid session" } },
  ])("rejects an invalid identity before any data access: %j", async (identity) => {
    const { main } = setup(identity)
    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(main.from).not.toHaveBeenCalled()
    expect(createRepositoriesClient).not.toHaveBeenCalled()
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it.each([
    "", "requirementId=not-a-uuid", "requirementId=", "tenantId=invalid", "siteId=demo-test",
    "robotInstanceId=invalid", `requirementId=${requirementId}&requirementId=${requirementId}`,
    `tenantId=${tenantId}&requirementId=${requirementId}`,
    `requirementId=${requirementId}&siteId=${siteId}`,
    `siteId=${siteId}&sort=invalid`, `siteId=${siteId}&sort=newest&sort=oldest`,
  ])("rejects malformed or ambiguous input without data access: %s", async (search) => {
    setup()
    const response = await GET(request(search))

    expect(response.status).toBe(400)
    expect(createMainClient).not.toHaveBeenCalled()
    expect(createRepositoriesClient).not.toHaveBeenCalled()
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it("does not hide missing repository configuration as an absent optional tenant", async () => {
    setup()
    delete process.env.REPOSITORIES_SUPABASE_SECRET_KEY
    const response = await GET(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Repositories database not configured" })
  })

  it("does not disguise a site-role RPC failure as authorization denial", async () => {
    const { main } = setup()
    main.rpc.mockResolvedValue({ data: null, error: { message: "private provider details" } })
    const response = await GET(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Failed to verify site access" })
    expect(createRepositoriesClient).not.toHaveBeenCalled()
  })

  it.each(["Failed to fetch robot instance", "Failed to fetch requirement statuses"])(
    "preserves robot list backend failures: %s", async (message) => {
      const { main } = setup()
      const instanceQuery = query({ site_id: siteId }, message.endsWith("instance") ? { code: "42501" } : null)
      const statusQuery = query(null, { code: "42501" })
      main.from.mockImplementation((table) => table === "remote_instances" ? instanceQuery : statusQuery)
      const response = await GET(request(`robotInstanceId=${tenantId}`))

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({ error: message })
    }
  )

  it("keeps an authorized robot with no linked requirements as an empty list", async () => {
    const { main } = setup()
    main.from.mockImplementation((table) => table === "remote_instances" ? query({ site_id: siteId }) : query([]))
    const response = await GET(request(`siteId=${siteId}&robotInstanceId=${tenantId}`))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ tenants: [] })
  })

  it("returns sanitized failures for unexpected repository exceptions", async () => {
    const { tenantQuery } = setup()
    tenantQuery.maybeSingle.mockRejectedValue(new Error("private provider details"))
    const response = await GET(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" })
  })

  it("preserves authenticated server-to-server lookup with a trusted API key", async () => {
    const { main } = setup()
    ;(isValidApiKey as jest.Mock).mockReturnValue(true)
    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(createServiceClient).toHaveBeenCalledTimes(1)
    expect(createServiceClient).toHaveBeenCalledWith(true)
    expect(createMainClient).not.toHaveBeenCalled()
    expect(main.auth.getUser).not.toHaveBeenCalled()
    expect(main.rpc).not.toHaveBeenCalled()
  })
})