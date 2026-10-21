/** @jest-environment node */
import { requireUnrestrictedLocationAccess } from "@/lib/auth/location-boundary.server"
import { readLocationRestrictionState, canAccessUnscopedSite } from "@/lib/permissions/location-boundary"
import { createClient } from "@/lib/supabase/server"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const rpc = jest.fn()
const getUser = jest.fn()
const client = { rpc, auth: { getUser } }

beforeEach(() => {
  jest.clearAllMocks()
  rpc.mockResolvedValue({ data: false, error: null })
  getUser.mockResolvedValue({ data: { user: { id: "actor" } }, error: null })
  jest.mocked(createClient).mockResolvedValue(client as never)
})

it("uses a fresh authenticated user client for the global private boundary", async () => {
  expect(await requireUnrestrictedLocationAccess()).toEqual({ supabase: client, user: { id: "actor" } })
  expect(createClient).toHaveBeenCalledWith(true)
  expect(rpc).toHaveBeenCalledWith("current_user_has_location_restrictions", {})
})

it.each([true, null, undefined, "false", [], {}])("denies non-affirmative unrestricted state %p", async data => {
  rpc.mockResolvedValue({ data, error: null })
  expect((await requireUnrestrictedLocationAccess()).error?.status).toBe(403)
  expect(await canAccessUnscopedSite(client, "site")).toBe(false)
})

it.each(["42501", "PGRST202", "42883", "57014"])("denies RPC failure %s without a permissive fallback", async code => {
  rpc.mockResolvedValue({ data: false, error: { code } })
  expect(await readLocationRestrictionState(client)).toBeNull()
  expect((await requireUnrestrictedLocationAccess()).error?.status).toBe(403)
})

it("denies thrown lookup errors and missing request context", async () => {
  rpc.mockRejectedValueOnce(new Error("timeout"))
  expect(await readLocationRestrictionState(client)).toBeNull()
  jest.mocked(createClient).mockRejectedValueOnce(new Error("cookies unavailable"))
  expect((await requireUnrestrictedLocationAccess()).error?.status).toBe(403)
})

it.each([null, { id: "guest", is_anonymous: true }])("does not grant private workspace access to guest %p", async user => {
  getUser.mockResolvedValue({ data: { user }, error: null })
  expect((await requireUnrestrictedLocationAccess()).error?.status).toBe(401)
  expect(rpc).not.toHaveBeenCalled()
})

it("does not memoize restrictions across permission edits", async () => {
  expect(await canAccessUnscopedSite(client, "site")).toBe(true)
  rpc.mockResolvedValueOnce({ data: true, error: null })
  expect(await canAccessUnscopedSite(client, "site")).toBe(false)
  expect(rpc).toHaveBeenCalledTimes(2)
  expect(rpc).toHaveBeenLastCalledWith("current_user_has_site_location_restrictions", { p_site_id: "site" })
})