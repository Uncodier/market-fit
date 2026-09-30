/** @jest-environment node */

import { revalidatePath } from "next/cache"
import { deleteSubscription } from "@/app/subscriptions/delete-subscription"
import { createClient } from "@/lib/supabase/server"

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const SITE_ID = "11111111-1111-4111-8111-111111111111"
const SUBSCRIPTION_ID = "22222222-2222-4222-8222-222222222222"
const OTHER_SITE_ID = "33333333-3333-4333-8333-333333333333"

function setup(status = "cancelled", siteId = SITE_ID) {
  const row = { id: SUBSCRIPTION_ID, site_id: siteId, status }
  const filters = new Map<string, string>()
  const query = {
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn(),
    select: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(async (): Promise<{
      data: { id: string } | null
      error: { message: string } | null
    }> => ({
      data: Object.entries(row).every(([column, value]) => filters.get(column) === value)
        ? { id: row.id }
        : null,
      error: null,
    })),
  }
  query.eq.mockImplementation((column: string, value: string) => {
    filters.set(column, value)
    return query
  })
  const supabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
    rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
    from: jest.fn().mockReturnValue(query),
  }
  jest.mocked(createClient).mockResolvedValue(supabase)
  return { supabase, query, row }
}

describe("deleteSubscription", () => {
  beforeEach(() => jest.clearAllMocks())

  it("deletes only a cancelled subscription in an authorized site using the user's client", async () => {
    const { supabase, query } = setup()

    expect(await deleteSubscription(SITE_ID, SUBSCRIPTION_ID)).toEqual({ success: true })
    expect(createClient).toHaveBeenCalledWith(true)
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith("user_can", {
      p_site_id: SITE_ID, p_command: "delete",
    })
    expect(supabase.from).toHaveBeenCalledTimes(1)
    expect(supabase.from).toHaveBeenCalledWith("subscriptions")
    expect(query.delete).toHaveBeenCalledTimes(1)
    expect(query.eq.mock.calls).toEqual([
      ["site_id", SITE_ID], ["id", SUBSCRIPTION_ID], ["status", "cancelled"],
    ])
    expect(query.select).toHaveBeenCalledWith("id")
    expect(revalidatePath).toHaveBeenCalledWith("/subscriptions")
    expect(revalidatePath).toHaveBeenCalledWith(`/subscriptions/${SUBSCRIPTION_ID}`)
    expect(revalidatePath).toHaveBeenCalledWith("/sales")
  })

  it.each([
    ["invalid", SUBSCRIPTION_ID],
    [SITE_ID, "invalid"],
    ["demo-site", SUBSCRIPTION_ID],
    [null, SUBSCRIPTION_ID],
    [SITE_ID, { id: SUBSCRIPTION_ID }],
  ])("rejects malformed identifiers without accessing the database (%p, %p)", async (site, subscription) => {
    expect(await deleteSubscription(site as string, subscription as string)).toEqual({
      error: "Invalid subscription request",
    })
    expect(createClient).not.toHaveBeenCalled()
  })

  it.each([
    { data: { user: null }, error: null },
    { data: { user: { id: "user-1" } }, error: { message: "Expired token" } },
  ])("requires a valid authenticated identity", async (authResult) => {
    const { supabase } = setup()
    supabase.auth.getUser.mockResolvedValue(authResult)

    expect(await deleteSubscription(SITE_ID, SUBSCRIPTION_ID)).toEqual({ error: "Not authenticated" })
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it.each([
    { data: false, error: null },
    { data: null, error: null },
    { data: true, error: { message: "Permission lookup failed" } },
  ])("fails closed without delete permission, including non-members and read-only roles", async (permissionResult) => {
    const { supabase } = setup()
    supabase.rpc.mockResolvedValue(permissionResult)

    expect(await deleteSubscription(SITE_ID, SUBSCRIPTION_ID)).toEqual({
      error: "Not authorized to delete subscriptions",
    })
    expect(supabase.from).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it.each(["active", "paused", "expired"])("does not delete a %s subscription", async (status) => {
    setup(status)

    expect(await deleteSubscription(SITE_ID, SUBSCRIPTION_ID)).toEqual({
      error: "Subscription not found or no longer cancelled",
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("does not delete a subscription from another site even with permission on the requested site", async () => {
    setup("cancelled", OTHER_SITE_ID)

    expect(await deleteSubscription(SITE_ID, SUBSCRIPTION_ID)).toEqual({
      error: "Subscription not found or no longer cancelled",
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("checks the persisted status at deletion time rather than trusting the UI's cancelled state", async () => {
    const { supabase, row } = setup()
    supabase.rpc.mockImplementation(async () => {
      row.status = "active"
      return { data: true, error: null }
    })

    expect(await deleteSubscription(SITE_ID, SUBSCRIPTION_ID)).toEqual({
      error: "Subscription not found or no longer cancelled",
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("does not report a successful deletion for a missing, RLS-hidden, or already deleted row", async () => {
    const { query } = setup()
    query.maybeSingle.mockResolvedValue({ data: null, error: null })

    expect(await deleteSubscription(SITE_ID, SUBSCRIPTION_ID)).toEqual({
      error: "Subscription not found or no longer cancelled",
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("returns a safe error when the database refuses the deletion", async () => {
    const { query } = setup()
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: "Internal constraint details" } })

    expect(await deleteSubscription(SITE_ID, SUBSCRIPTION_ID)).toEqual({ error: "Failed to delete subscription" })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("handles unexpected transport failures without leaking internal errors", async () => {
    setup()
    jest.mocked(createClient).mockRejectedValue(new Error("Internal connection details"))

    expect(await deleteSubscription(SITE_ID, SUBSCRIPTION_ID)).toEqual({ error: "Failed to delete subscription" })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})