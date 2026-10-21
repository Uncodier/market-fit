/** @jest-environment node */
import { resolveBuyerUserByEmail, findOrCreateLeadForBuyer } from "@/app/commerce/resolve-buyer-lead"
import { resolveBuyerIdentityForSite } from "@/app/commerce/resolve-buyer-qr"
import { getSiteSecret } from "@/app/lib/secrets-service"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdmin } from "@supabase/supabase-js"

jest.mock("server-only", () => ({}))
jest.mock("next/cache", () => ({ unstable_noStore: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }))

const rpc = jest.fn()
const getUser = jest.fn()
const from = jest.fn()
const getUserById = jest.fn()
const listUsers = jest.fn()
const client = { auth: { getUser }, rpc, from }

beforeEach(() => {
  jest.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: "staff" } }, error: null })
  rpc.mockImplementation(async (name: string) => ({
    data: name === "current_user_site_role" ? "owner" : name === "user_can", error: null,
  }))
  ;(createClient as jest.Mock).mockResolvedValue(client)
  ;(createAdmin as jest.Mock).mockReturnValue({ auth: { admin: { getUserById, listUsers } } })
})

const actions = [
  () => resolveBuyerUserByEmail("buyer@example.com", "site"),
  () => findOrCreateLeadForBuyer({ siteId: "site", email: "buyer@example.com", name: "Buyer", buyerUserId: "buyer" }),
  () => resolveBuyerIdentityForSite({ siteId: "site", code: "mf:user:buyer" }),
  () => getSiteSecret("site", "cloudflare", "dns_sync"),
]

it.each(actions)("denies anonymous callers before any private query or service client", async (action) => {
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  const result = await action()
  expect(result === null || (typeof result === "object" && Boolean(result.error))).toBe(true)
  expect(from).not.toHaveBeenCalled()
  expect(createAdmin).not.toHaveBeenCalled()
})

it.each([true, null, "false", { error: { message: "missing RPC" } }])(
  "fails closed for restrictions or unknown restriction state %p", async (restriction) => {
    rpc.mockImplementation(async (name: string) => name === "current_user_site_role"
      ? { data: "admin", error: null }
      : name === "current_user_has_site_location_restrictions"
        ? (typeof restriction === "object" && restriction !== null ? restriction : { data: restriction, error: null })
        : { data: true, error: null })
    for (const action of actions) await action()
    expect(from).not.toHaveBeenCalled()
    expect(createAdmin).not.toHaveBeenCalled()
  },
)

it("denies nonmembers and unknown roles", async () => {
  rpc.mockResolvedValue({ data: "viewer", error: null })
  for (const action of actions) await action()
  expect(createAdmin).not.toHaveBeenCalled()
  expect(from).not.toHaveBeenCalled()
})

it("does not let collaborators decrypt site secrets", async () => {
  rpc.mockImplementation(async (name: string) => ({ data: name === "current_user_site_role" ? "collaborator" : false, error: null }))
  expect(await getSiteSecret("site", "cloudflare", "dns_sync")).toBeNull()
  expect(createAdmin).not.toHaveBeenCalled()
})

it("rejects a forged buyer binding before lead reads or writes", async () => {
  getUserById.mockResolvedValue({ data: { user: { id: "victim", email: "victim@example.com", email_confirmed_at: "2026-01-01" } }, error: null })
  const result = await findOrCreateLeadForBuyer({ siteId: "site", email: "attacker@example.com", name: "Attacker", buyerUserId: "victim" })
  expect(result.error).toBe("Buyer account could not be verified")
  expect(from).not.toHaveBeenCalled()
})

it("resolves the platform buyer only for verified unrestricted staff", async () => {
  listUsers.mockResolvedValue({ data: { users: [{ id: "buyer", email: "buyer@example.com", user_metadata: { name: "Buyer" } }] }, error: null })
  expect(await resolveBuyerUserByEmail("buyer@example.com", "site")).toEqual({
    data: { userId: "buyer", email: "buyer@example.com", name: "Buyer" }, error: null,
  })
  expect(rpc).toHaveBeenCalledWith("current_user_has_site_location_restrictions", { p_site_id: "site" })
})