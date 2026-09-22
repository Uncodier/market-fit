/** @jest-environment node */

import { createClient as createMainClient } from "@/lib/supabase/server"
import { createClient as createRepositoriesClient } from "@supabase/supabase-js"
import { GET as getTables } from "@/app/api/applications/tables/route"
import { GET as getTenants } from "@/app/api/applications/tenants/route"

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}))

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}))

jest.mock("@/app/lib/api-keys-config", () => ({
  getApiKeyFromRequest: jest.fn(() => null),
  isValidApiKey: jest.fn(() => false),
}))

const schema = "app_7f146ebd26a84d478ce5f17d"
const siteId = "624c8625-1217-4042-b265-2ea078f66612"

function tablesRequest() {
  return new Request(
    `https://example.test/api/applications/tables?schema=${schema}`,
    { headers: { cookie: "sb-access-token=test" } }
  )
}

function tenantRequest() {
  return new Request(
    "https://example.test/api/applications/tenants" +
      "?tenantId=00000000-0000-4000-8000-000000000001",
    { headers: { cookie: "sb-access-token=test" } }
  )
}

function mainClient(role: string | null, user: unknown = { id: "user-1" }) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    rpc: jest.fn().mockResolvedValue({
      data: role,
      error: null,
    }),
  }
}

function repositoriesClient() {
  const tenantQuery: any = {}
  tenantQuery.select = jest.fn(() => tenantQuery)
  tenantQuery.eq = jest.fn(() => tenantQuery)
  tenantQuery.maybeSingle = jest.fn().mockResolvedValue({
    data: {
      tenant_id: "00000000-0000-4000-8000-000000000001",
      site_id: siteId,
      schema,
    },
    error: null,
  })

  return {
    from: jest.fn(() => tenantQuery),
    rpc: jest.fn((name: string) =>
      Promise.resolve({
        data: name === "introspect_schema_tables"
          ? [{ name: "orders", columns: [] }]
          : { orders: 3 },
        error: null,
      })
    ),
  }
}

describe("application database access", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL =
      "https://repositories.example.test"
    process.env.REPOSITORIES_SUPABASE_SECRET_KEY = "service-key"
  })

  it("allows an active site administrator to inspect tenant tables", async () => {
    const main = mainClient("admin")
    const repositories = repositoriesClient()
    ;(createMainClient as jest.Mock).mockResolvedValue(main)
    ;(createRepositoriesClient as jest.Mock).mockReturnValue(repositories)

    const response = await getTables(tablesRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(main.rpc).toHaveBeenCalledWith("current_user_site_role", {
      p_site_id: siteId,
    })
    expect(repositories.rpc).toHaveBeenCalledWith(
      "introspect_schema_tables",
      { schema_name: schema }
    )
    expect(body).toEqual([
      expect.objectContaining({ name: "orders", schema, count: 3 }),
    ])
  })

  it("rejects a non-manager before introspecting tenant data", async () => {
    const repositories = repositoriesClient()
    ;(createMainClient as jest.Mock).mockResolvedValue(mainClient("marketing"))
    ;(createRepositoriesClient as jest.Mock).mockReturnValue(repositories)

    const response = await getTables(tablesRequest())

    expect(response.status).toBe(403)
    expect(repositories.rpc).not.toHaveBeenCalled()
  })

  it("rejects an unauthenticated request before using service-role access", async () => {
    ;(createMainClient as jest.Mock).mockResolvedValue(mainClient(null, null))

    const response = await getTables(tablesRequest())

    expect(response.status).toBe(401)
    expect(createRepositoriesClient).not.toHaveBeenCalled()
  })

  it("allows an administrator to resolve a tenant schema", async () => {
    ;(createMainClient as jest.Mock).mockResolvedValue(mainClient("admin"))
    ;(createRepositoriesClient as jest.Mock).mockReturnValue(
      repositoriesClient()
    )

    const response = await getTenants(tenantRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ schema })
  })

  it("rejects a non-manager resolving a tenant schema", async () => {
    ;(createMainClient as jest.Mock).mockResolvedValue(mainClient("marketing"))
    ;(createRepositoriesClient as jest.Mock).mockReturnValue(
      repositoriesClient()
    )

    const response = await getTenants(tenantRequest())

    expect(response.status).toBe(403)
  })
})
