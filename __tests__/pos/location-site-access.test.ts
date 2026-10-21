/** @jest-environment node */
import { requirePosSiteAccess } from "@/app/pos/actions/site-access"
import { createClient } from "@/lib/supabase/server"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
const rpc = jest.fn(), getUser = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: "staff" } }, error: null })
  rpc.mockImplementation(async name => ({ data: name === "current_user_site_role" ? "collaborator" : false, error: null }))
  jest.mocked(createClient).mockResolvedValue({ rpc, auth: { getUser } } as never)
})

it("authorizes POS snapshots for unrestricted members using the real session", async () => {
  expect(await requirePosSiteAccess("site")).toHaveProperty("role", "collaborator")
  expect(createClient).toHaveBeenCalledWith(true)
  expect(rpc).toHaveBeenLastCalledWith("current_user_has_site_location_restrictions", { p_site_id: "site" })
})

it.each([true, null, undefined, "false"])("denies POS scope %p before callers use snapshots/replay", async state => {
  rpc.mockImplementation(async name => ({ data: name === "current_user_site_role" ? "collaborator" : state, error: null }))
  expect(await requirePosSiteAccess("site")).toHaveProperty("error")
})

it("rechecks newly restricted membership rather than retaining prior authorization", async () => {
  expect((await requirePosSiteAccess("site")).error).toBeUndefined()
  rpc.mockImplementation(async name => ({ data: name === "current_user_site_role" ? "collaborator" : true, error: null }))
  expect((await requirePosSiteAccess("site")).error).toBeDefined()
  expect(rpc).toHaveBeenCalledTimes(4)
})

it("does not let a demo-looking ID bypass restrictions for a real client", async () => {
  rpc.mockImplementation(async name => ({ data: name === "current_user_site_role" ? "owner" : true, error: null }))
  expect((await requirePosSiteAccess("demo-forged")).error).toBeDefined()
  expect(rpc).toHaveBeenLastCalledWith("current_user_has_site_location_restrictions", { p_site_id: "demo-forged" })
})