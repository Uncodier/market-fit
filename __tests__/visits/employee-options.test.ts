import { listVisitEmployees } from "@/app/visits/actions"
import { validateVisitResource } from "@/app/visits/visit-server"
import { createClient } from "@/lib/supabase/server"
import { employeeMembers } from "@/__tests__/fixtures/site-members"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

function mockClient() {
  const queries: Array<{ table: string; filters: Record<string, unknown> }> = []
  const from = jest.fn((table: string) => {
    const filters: Record<string, unknown> = {}
    queries.push({ table, filters })
    const resolve = () => {
      const rows = table === "site_members" ? employeeMembers
        .filter(member => Object.entries(filters).every(([key, value]) => member[key as keyof typeof member] === value))
        : table === "profiles" ? [{ id: "active-user", name: "Active Employee" }] : []
      return { data: rows, error: null }
    }
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn(),
      not: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(async () => ({ ...resolve(), data: resolve().data[0] || null })),
      then: (fulfilled: (result: ReturnType<typeof resolve>) => unknown) => Promise.resolve(resolve()).then(fulfilled),
    }
    query.eq.mockImplementation((key: string, value: unknown) => { filters[key] = value; return query })
    return query
  })
  const supabase = { from, auth: { getUser: async () => ({ data: { user: { id: "active-user" } } }) } }
  return { supabase, queries }
}

it("filters employee options by site, active status and both activation flags", async () => {
  const { supabase, queries } = mockClient()
  jest.mocked(createClient).mockResolvedValue(supabase as never)
  await expect(listVisitEmployees("site-one")).resolves.toEqual({ data: [{ id: "active-user", name: "Active Employee" }] })
  expect(queries.find(query => query.table === "site_members")?.filters).toEqual({
    site_id: "site-one", status: "active", license_suspended: false, manually_disabled: false,
  })
})

it.each(["disabled-user", "suspended-user", "pending-user", "rejected-user"])(
  "rejects an ineligible employee selected from stale options: %s", async userId => {
    const { supabase } = mockClient()
    const result = await validateVisitResource(supabase as never, "site-one", {
      resource_type: "employee", assignee_user_id: userId,
      catalog_item_id: null, location_id: null,
    })
    expect(result).toEqual({ error: "Invalid employee" })
  },
)
