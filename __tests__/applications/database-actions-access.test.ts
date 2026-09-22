/** @jest-environment node */

import { createClient as createMainClient } from "@/lib/supabase/server"
import { createClient as createRepositoriesClient } from "@supabase/supabase-js"
import { fetchTableData } from "@/app/applications/actions"

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}))

const schema = "app_7f146ebd26a84d478ce5f17d"
const siteId = "624c8625-1217-4042-b265-2ea078f66612"

function mainClient(role: string | null) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
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
    data: { site_id: siteId, schema },
    error: null,
  })

  const rpc = jest.fn().mockResolvedValue({
    data: { data: [{ id: "row-1" }], count: 1 },
    error: null,
  })

  return {
    from: jest.fn(() => tenantQuery),
    schema: jest.fn(() => ({ rpc })),
    rpc,
  }
}

describe("application database actions access", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "error").mockImplementation(() => undefined)
    process.env.NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL =
      "https://repositories.example.test"
    process.env.REPOSITORIES_SUPABASE_SECRET_KEY = "service-key"
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("allows a site owner to read rows from the resolved tenant schema", async () => {
    const repositories = repositoriesClient()
    ;(createMainClient as jest.Mock).mockResolvedValue(mainClient("owner"))
    ;(createRepositoriesClient as jest.Mock).mockReturnValue(repositories)

    const result = await fetchTableData({
      schema,
      table: "orders",
      page: 1,
      pageSize: 25,
      primaryKey: "id",
    })

    expect(result).toEqual({ data: [{ id: "row-1" }], count: 1 })
    expect(repositories.rpc).toHaveBeenCalledWith("select_schema_table", {
      schema_name: schema,
      table_name: "orders",
      query_filters: [],
      query_sorts: [],
      page_num: 1,
      page_size: 25,
    })
  })

  it("rejects a non-manager before reading tenant rows", async () => {
    const repositories = repositoriesClient()
    ;(createMainClient as jest.Mock).mockResolvedValue(mainClient("marketing"))
    ;(createRepositoriesClient as jest.Mock).mockReturnValue(repositories)

    const result = await fetchTableData({
      schema,
      table: "orders",
      page: 1,
      pageSize: 25,
      primaryKey: "id",
    })

    expect(result).toEqual({ error: "Forbidden" })
    expect(repositories.rpc).not.toHaveBeenCalled()
  })
})
