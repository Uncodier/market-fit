/** @jest-environment node */
import { revalidatePath } from "next/cache"
import { deleteRequirement } from "@/app/requirements/actions"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUserSiteRole } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("next/headers", () => ({ cookies: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/auth/api-site-access", () => ({
  getCurrentUserSiteRole: jest.fn(),
  isSiteManagerRole: (role: string) => ["owner", "admin"].includes(role),
}))
jest.mock("@/lib/permissions/site-access", () => ({ userCanOnSite: jest.fn() }))

const id = "aaaaaaaa-0000-4000-8000-000000000001"
const siteId = "bbbbbbbb-0000-4000-8000-000000000001"
const auth = jest.fn()
const read = jest.fn()
const remove = jest.fn()
const write = { eq: jest.fn(), select: jest.fn(), maybeSingle: jest.fn() }
const from = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  auth.mockResolvedValue({ data: { user: { id: "owner" } }, error: null })
  read.mockResolvedValue({ data: { id, site_id: siteId }, error: null })
  write.eq.mockReturnValue(write)
  write.select.mockReturnValue(write)
  write.maybeSingle.mockResolvedValue({ data: { id }, error: null })
  remove.mockReturnValue(write)
  from.mockImplementation((table: string) => {
    if (table !== "requirements") throw new Error(`Unexpected child mutation: ${table}`)
    return { select: () => ({ eq: () => ({ maybeSingle: read }) }), delete: remove }
  })
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: auth }, from })
  jest.mocked(getCurrentUserSiteRole).mockResolvedValue("owner")
  jest.mocked(userCanOnSite).mockResolvedValue(true)
})

it.each(["owner", "admin"])("deletes atomically as %s without touching child tables", async role => {
  jest.mocked(getCurrentUserSiteRole).mockResolvedValue(role)
  expect(await deleteRequirement(id.toUpperCase())).toEqual({ success: true })
  expect(createClient).toHaveBeenCalledWith(true)
  expect(getCurrentUserSiteRole).toHaveBeenCalledWith(expect.anything(), siteId)
  expect(userCanOnSite).toHaveBeenCalledWith(expect.anything(), siteId, "delete")
  expect(from.mock.calls).toEqual([["requirements"], ["requirements"]])
  expect(remove).toHaveBeenCalledTimes(1)
  expect(write.eq.mock.calls).toEqual([["id", id], ["site_id", siteId]])
  expect(write.select).toHaveBeenCalledWith("id")
  expect(revalidatePath).toHaveBeenCalledWith("/requirements")
})

it.each(["", "bad-id", "demo-requirement-1"])("rejects invalid IDs before opening a client: %s", async value => {
  expect(await deleteRequirement(value)).toEqual({ error: "Invalid requirement ID." })
  expect(createClient).not.toHaveBeenCalled()
})

it.each([
  { data: { user: null }, error: null },
  { data: { user: { id: "owner" } }, error: { message: "Expired" } },
  { data: { user: { id: "guest", is_anonymous: true } }, error: null },
])("requires a verified non-anonymous user", async result => {
  auth.mockResolvedValue(result)
  expect(await deleteRequirement(id)).toEqual({ error: "Please sign in to delete this requirement." })
  expect(from).not.toHaveBeenCalled()
})

it.each([
  { data: null, error: null },
  { data: null, error: { message: "Private SQL details" } },
  { data: { id: "different-id", site_id: siteId }, error: null },
])("does not mutate missing, inaccessible or unverified requirements", async result => {
  read.mockResolvedValue(result)
  expect(await deleteRequirement(id)).toHaveProperty("error")
  expect(remove).not.toHaveBeenCalled()
  expect(revalidatePath).not.toHaveBeenCalled()
})

it.each(["member", "viewer", null])("denies non-managers: %s", async role => {
  jest.mocked(getCurrentUserSiteRole).mockResolvedValue(role)
  expect(await deleteRequirement(id)).toHaveProperty("error")
  expect(remove).not.toHaveBeenCalled()
})

it("denies a manager without the delete capability", async () => {
  jest.mocked(userCanOnSite).mockResolvedValue(false)
  expect(await deleteRequirement(id)).toHaveProperty("error")
  expect(remove).not.toHaveBeenCalled()
})

it.each(["23503", "23514", "PT403", "42501", "57014"])("handles database rejection %s without leaking details or retrying", async code => {
  write.maybeSingle.mockResolvedValue({ data: null, error: { code, message: "Private SQL details" } })
  const result = await deleteRequirement(id)
  expect(result).toHaveProperty("error")
  expect(JSON.stringify(result)).not.toContain("Private SQL details")
  expect(remove).toHaveBeenCalledTimes(1)
  expect(from.mock.calls).toEqual([["requirements"], ["requirements"]])
  expect(revalidatePath).not.toHaveBeenCalled()
})

it.each([null, { id: "different-id" }])("never reports success without a matching deleted row", async data => {
  write.maybeSingle.mockResolvedValue({ data, error: null })
  expect(await deleteRequirement(id)).toHaveProperty("error")
  expect(revalidatePath).not.toHaveBeenCalled()
})

it("treats a lost response as unconfirmed without retrying", async () => {
  write.maybeSingle.mockRejectedValueOnce(new Error("Private transport details"))
  expect(await deleteRequirement(id)).toEqual({
    error: "Deletion could not be confirmed. Refresh the requirements list before trying again.",
  })
  expect(remove).toHaveBeenCalledTimes(1)
  expect(revalidatePath).not.toHaveBeenCalled()
})