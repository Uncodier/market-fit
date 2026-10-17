/** @jest-environment node */

import { revalidatePath } from "next/cache"
import { requireAccountingAccess } from "@/app/accounting/access"
import { updateSubscriptionDueDate, updateSubscriptionNextBillingDate } from "@/app/subscriptions/actions"

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/app/accounting/access", () => ({ requireAccountingAccess: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const siteId = "11111111-1111-4111-8111-111111111111"
const subscriptionId = "22222222-2222-4222-8222-222222222222"
const version = "2026-10-01T12:00:00.000Z"

function setup(current: { next_billing_date: string | null; due_date: string | null } = {
  next_billing_date: "2026-10-20T00:00:00.000Z", due_date: "2026-11-03",
}) {
  const read = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { ...current, updated_at: version }, error: null }),
  }
  const saved = { ...current, updated_at: "2026-10-16T12:00:00.000Z" }
  const write = {
    update: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: saved, error: null }),
  }
  const from = jest.fn().mockReturnValueOnce(read).mockReturnValueOnce(write)
  jest.mocked(requireAccountingAccess).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof requireAccountingAccess>>)
  return { read, write, from, saved }
}

describe("subscription date updates", () => {
  beforeEach(() => jest.resetAllMocks())

  it("reschedules billing and due date together while preserving net terms", async () => {
    const { read, write, from, saved } = setup()
    const result = await updateSubscriptionNextBillingDate(siteId, subscriptionId, "2026-11-20")

    expect(requireAccountingAccess).toHaveBeenCalledWith(siteId, "update")
    expect(from.mock.calls).toEqual([["subscriptions"], ["subscriptions"]])
    for (const query of [read, write]) {
      expect(query.eq).toHaveBeenCalledWith("site_id", siteId)
      expect(query.eq).toHaveBeenCalledWith("id", subscriptionId)
    }
    expect(write.eq).toHaveBeenCalledWith("updated_at", version)
    expect(write.update).toHaveBeenCalledWith({
      next_billing_date: "2026-11-20T00:00:00.000Z", due_date: "2026-12-04", updated_at: expect.any(String),
    })
    expect(result).toEqual({ success: true, data: saved })
    expect(revalidatePath).toHaveBeenCalledWith("/subscriptions")
    expect(revalidatePath).toHaveBeenCalledWith(`/subscriptions/${subscriptionId}`)
  })

  it.each([
    ["2026-10-20T23:00:00-05:00", "2026-10-19", "2026-11-21", "2026-11-19"],
    ["2028-01-31T00:00:00Z", "2028-02-14", "2028-02-29", "2028-03-14"],
  ])("preserves UTC calendar offsets from %s", async (billing, due, next, expected) => {
    const { write } = setup({ next_billing_date: billing, due_date: due })
    await updateSubscriptionNextBillingDate(siteId, subscriptionId, next)
    expect(write.update).toHaveBeenCalledWith(expect.objectContaining({ due_date: expected }))
  })

  it("does not invent a due date when configuring a missing billing date", async () => {
    const { write } = setup({ next_billing_date: null, due_date: null })
    await updateSubscriptionNextBillingDate(siteId, subscriptionId, "2026-11-20")
    expect(write.update).toHaveBeenCalledWith(expect.objectContaining({ due_date: null }))
  })

  it.each(["2026-10-10", null, ""])("edits or clears due date (%s) without changing billing", async (value) => {
    const { write } = setup()
    await updateSubscriptionDueDate(siteId, subscriptionId, value)
    expect(write.update).toHaveBeenCalledWith({ due_date: value || null, updated_at: expect.any(String) })
  })

  it.each(["", "2026-02-30", "2026-11-20T00:00:00Z", "0000-01-01"])("rejects invalid billing dates (%s) before database access", async (value) => {
    expect(await updateSubscriptionNextBillingDate(siteId, subscriptionId, value)).toEqual({ error: "Enter a valid next billing date (YYYY-MM-DD)" })
    expect(requireAccountingAccess).not.toHaveBeenCalled()
  })

  it("rejects invalid due dates and invalid tenant/subscription IDs", async () => {
    expect(await updateSubscriptionDueDate(siteId, subscriptionId, "2026-02-30")).toHaveProperty("error")
    expect(await updateSubscriptionDueDate("other-site", subscriptionId, null)).toHaveProperty("error")
    expect(await updateSubscriptionNextBillingDate(siteId, "other-subscription", "2026-11-20")).toHaveProperty("error")
    expect(requireAccountingAccess).not.toHaveBeenCalled()
  })

  it("requires a billing anchor for due dates but still allows clearing", async () => {
    const { write } = setup({ next_billing_date: null, due_date: null })
    expect(await updateSubscriptionDueDate(siteId, subscriptionId, "2026-11-20")).toEqual({ error: "A next billing date is required to configure a due date" })
    expect(write.update).not.toHaveBeenCalled()
    setup({ next_billing_date: null, due_date: null })
    expect(await updateSubscriptionDueDate(siteId, subscriptionId, null)).toHaveProperty("success", true)
  })

  it.each(["Authentication required", "Not authorized for this accounting operation"])("denies updates when access fails: %s", async (error) => {
    const { from } = setup()
    jest.mocked(requireAccountingAccess).mockRejectedValueOnce(new Error(error))
    expect(await updateSubscriptionNextBillingDate(siteId, subscriptionId, "2026-11-20")).toEqual({ error })
    expect(from).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("does not write when the subscription is outside the authorized site", async () => {
    const { read, write } = setup()
    read.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect(await updateSubscriptionNextBillingDate(siteId, subscriptionId, "2026-11-20")).toEqual({ error: "Subscription not found" })
    expect(write.update).not.toHaveBeenCalled()
  })

  it("reports concurrent edits without revalidating or claiming success", async () => {
    const { write } = setup()
    write.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect(await updateSubscriptionDueDate(siteId, subscriptionId, null)).toEqual({ error: "Subscription changed while editing. Reload and retry." })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("does not expose database errors", async () => {
    const { write } = setup()
    write.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "Internal database details" } })
    expect(await updateSubscriptionNextBillingDate(siteId, subscriptionId, "2026-11-20")).toEqual({ error: "Unable to save subscription date" })
  })
})