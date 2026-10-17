/** @jest-environment node */

import { revalidatePath } from "next/cache"
import { requireAccountingAccess } from "@/app/accounting/access"
import { updateSubscriptionAmount, updateSubscriptionEndDate } from "@/app/subscriptions/update-details"

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/app/accounting/access", () => ({ requireAccountingAccess: jest.fn() }))

const siteId = "11111111-1111-4111-8111-111111111111"
const subscriptionId = "22222222-2222-4222-8222-222222222222"
const version = "2026-10-16T12:00:00.000Z"

function setup(start_date = "2026-10-20T00:00:00Z") {
  const read = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { start_date, updated_at: version }, error: null }),
  }
  const saved = { amount: 250, end_date: "2026-12-20", updated_at: "2026-10-16T12:00:01.000Z" }
  const write = {
    update: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: saved, error: null }),
  }
  const from = jest.fn().mockReturnValueOnce(read).mockReturnValueOnce(write)
  jest.mocked(requireAccountingAccess).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof requireAccountingAccess>>)
  return { read, write, from, saved }
}

describe("subscription amount and end date updates", () => {
  beforeEach(() => jest.resetAllMocks())

  it.each([0, 0.01, 125.5, 999999999999])("saves the recurring amount %s without changing invoices or other fields", async (amount) => {
    const { read, write, from, saved } = setup()
    expect(await updateSubscriptionAmount(siteId, subscriptionId, amount)).toEqual({ data: saved })
    expect(requireAccountingAccess).toHaveBeenCalledWith(siteId, "update")
    expect(from.mock.calls).toEqual([["subscriptions"], ["subscriptions"]])
    for (const query of [read, write]) {
      expect(query.eq).toHaveBeenCalledWith("site_id", siteId)
      expect(query.eq).toHaveBeenCalledWith("id", subscriptionId)
    }
    expect(write.eq).toHaveBeenCalledWith("updated_at", version)
    expect(write.update).toHaveBeenCalledWith({ amount, updated_at: expect.any(String) })
    expect(revalidatePath).toHaveBeenCalledWith("/subscriptions")
    expect(revalidatePath).toHaveBeenCalledWith(`/subscriptions/${subscriptionId}`)
  })

  it.each([-1, NaN, Infinity, 1000000000000, 1.001])("rejects invalid amount %s before database access", async (amount) => {
    expect(await updateSubscriptionAmount(siteId, subscriptionId, amount)).toHaveProperty("error")
    expect(requireAccountingAccess).not.toHaveBeenCalled()
  })

  it.each(["2026-10-20", "2028-02-29", "2026-12-20", null, ""])("saves or clears the end date %s without changing billing", async (endDate) => {
    const { write, from, saved } = setup()
    expect(await updateSubscriptionEndDate(siteId, subscriptionId, endDate)).toEqual({ data: saved })
    expect(write.update).toHaveBeenCalledWith({ end_date: endDate || null, updated_at: expect.any(String) })
    expect(from.mock.calls).toEqual([["subscriptions"], ["subscriptions"]])
    expect(write.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(write.eq).toHaveBeenCalledWith("id", subscriptionId)
    expect(write.eq).toHaveBeenCalledWith("updated_at", version)
  })

  it.each(["2026-02-30", "2026-10-20T00:00:00Z", "0000-01-01"])("rejects invalid end dates %s before database access", async (endDate) => {
    expect(await updateSubscriptionEndDate(siteId, subscriptionId, endDate)).toHaveProperty("error")
    expect(requireAccountingAccess).not.toHaveBeenCalled()
  })

  it("rejects end dates before the UTC start day", async () => {
    const { write } = setup("2026-10-19T23:00:00-05:00")
    expect(await updateSubscriptionEndDate(siteId, subscriptionId, "2026-10-19")).toEqual({ error: "End date cannot be before start date" })
    expect(write.update).not.toHaveBeenCalled()
  })

  it("allows clearing a date when the historical start date is missing", async () => {
    const { write } = setup("")
    await updateSubscriptionEndDate(siteId, subscriptionId, null)
    expect(write.update).toHaveBeenCalledWith({ end_date: null, updated_at: expect.any(String) })
  })

  it("fails closed for unverified start dates when configuring an end date", async () => {
    const { write } = setup("invalid date")
    expect(await updateSubscriptionEndDate(siteId, subscriptionId, "2026-12-20")).toEqual({ error: "Unable to verify the subscription start date" })
    expect(write.update).not.toHaveBeenCalled()
  })

  it("rejects invalid tenant or subscription IDs", async () => {
    expect(await updateSubscriptionAmount("other-site", subscriptionId, 125)).toHaveProperty("error")
    expect(await updateSubscriptionEndDate(siteId, "other-subscription", null)).toHaveProperty("error")
    expect(requireAccountingAccess).not.toHaveBeenCalled()
  })

  it("denies edits when accounting authorization fails", async () => {
    const { from } = setup()
    jest.mocked(requireAccountingAccess).mockRejectedValueOnce(new Error("Private access failure"))
    expect(await updateSubscriptionAmount(siteId, subscriptionId, 125)).toEqual({ error: "Not authorized to edit subscriptions in this site" })
    expect(from).not.toHaveBeenCalled()
  })

  it("does not edit a subscription outside the authorized site", async () => {
    const { read, write } = setup()
    read.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect(await updateSubscriptionAmount(siteId, subscriptionId, 125)).toEqual({ error: "Subscription not found" })
    expect(write.update).not.toHaveBeenCalled()
  })

  it("requires a version and rejects concurrent changes", async () => {
    const { read, write } = setup()
    read.maybeSingle.mockResolvedValueOnce({ data: { start_date: "2026-10-20", updated_at: "" }, error: null })
    expect(await updateSubscriptionEndDate(siteId, subscriptionId, null)).toHaveProperty("error", "Unable to verify the subscription. Reload and retry.")
    expect(write.update).not.toHaveBeenCalled()
    const retry = setup()
    retry.write.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect(await updateSubscriptionAmount(siteId, subscriptionId, 125)).toEqual({ error: "Subscription changed while editing. Reload and retry." })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("increments updated_at even when the stored version is ahead of the clock", async () => {
    const { read, write } = setup()
    read.maybeSingle.mockResolvedValueOnce({ data: { start_date: "2026-10-20", updated_at: "2099-01-01T00:00:00Z" }, error: null })
    await updateSubscriptionAmount(siteId, subscriptionId, 125)
    expect(write.update).toHaveBeenCalledWith({ amount: 125, updated_at: "2099-01-01T00:00:00.001Z" })
  })

  it("does not leak database errors", async () => {
    const { write } = setup()
    write.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "Private database details" } })
    expect(await updateSubscriptionAmount(siteId, subscriptionId, 125)).toEqual({ error: "Unable to save subscription details" })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})