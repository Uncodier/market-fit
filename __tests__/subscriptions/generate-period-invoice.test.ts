/** @jest-environment node */

import { revalidatePath } from "next/cache"
import { requireAccountingAccess } from "@/app/accounting/access"
import { generateSubscriptionPeriodInvoice } from "@/app/subscriptions/generate-period-invoice"
import { getSubscriptionBillingDate } from "@/app/subscriptions/billing-period"

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/app/accounting/access", () => ({ requireAccountingAccess: jest.fn() }))

const siteId = "11111111-1111-4111-8111-111111111111"
const subscriptionId = "22222222-2222-4222-8222-222222222222"
const input = { siteId, subscriptionId, billingDate: "2026-10-20" }
const subscription = {
  id: subscriptionId, status: "active", amount: "125.50", lead_id: "lead-1", buyer_user_id: "buyer-1",
  next_billing_date: "2026-10-20T00:00:00Z", due_date: "2026-11-03",
  catalog_item: { name: "Growth plan", kind: "service", currency: "EUR" },
}

function setup(overrides = {}) {
  const read = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { ...subscription, ...overrides }, error: null }),
  }
  const lookup = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  }
  const write = {
    insert: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: "invoice-1" }, error: null }),
  }
  const from = jest.fn().mockReturnValueOnce(read).mockReturnValueOnce(lookup).mockReturnValueOnce(write).mockReturnValue(lookup)
  const auth = { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) }
  jest.mocked(requireAccountingAccess).mockResolvedValue({ from, auth } as unknown as Awaited<ReturnType<typeof requireAccountingAccess>>)
  return { read, lookup, write, from, auth }
}

describe("subscription period invoice generation", () => {
  beforeEach(() => jest.resetAllMocks())

  it("generates the first cycle using server-owned amount, currency, and dates without advancing billing", async () => {
    const { read, lookup, write, from } = setup()
    expect(await generateSubscriptionPeriodInvoice(input)).toEqual({ data: { id: "invoice-1" } })
    expect(requireAccountingAccess).toHaveBeenCalledWith(siteId, "insert")
    expect(read.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(read.eq).toHaveBeenCalledWith("id", subscriptionId)
    expect(lookup.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(lookup.eq).toHaveBeenCalledWith("subscription_id", subscriptionId)
    expect(lookup.eq).toHaveBeenCalledWith("sale_date", input.billingDate)
    expect(write.insert).toHaveBeenCalledWith({
      id: expect.stringMatching(/^[0-9a-f-]{14}5[0-9a-f-]+$/),
      title: "Growth plan invoice · 2026-10-20", product_name: "Growth plan", product_type: "service",
      amount: 125.5, amount_due: 125.5, currency: "EUR", status: "pending", lead_id: "lead-1", buyer_user_id: "buyer-1",
      sale_date: "2026-10-20", due_date: "2026-11-03", payment_method: null, source: "retail", channel: "manual",
      site_id: siteId, user_id: "user-1", subscription_id: subscriptionId,
    })
    expect(from.mock.calls).toEqual([["subscriptions"], ["sales"], ["sales"]])
    expect(revalidatePath).toHaveBeenCalledWith(`/subscriptions/${subscriptionId}`)
    expect(revalidatePath).toHaveBeenCalledWith("/sales")
  })

  it("uses UTC calendar days for legacy timestamp anchors", async () => {
    const { write } = setup({ next_billing_date: "2026-10-19T23:00:00-05:00" })
    await generateSubscriptionPeriodInvoice(input)
    expect(write.insert).toHaveBeenCalledWith(expect.objectContaining({ sale_date: "2026-10-20", due_date: "2026-11-03" }))
  })

  it("retains an optional missing due date and defaults missing catalog currency to USD", async () => {
    const { write } = setup({ due_date: null, catalog_item: null })
    await generateSubscriptionPeriodInvoice(input)
    expect(write.insert).toHaveBeenCalledWith(expect.objectContaining({ due_date: null, currency: "USD" }))
  })

  it.each(["pending", "completed"])("reuses an existing %s invoice without creating another", async (status) => {
    const { lookup, write } = setup()
    lookup.maybeSingle.mockResolvedValueOnce({ data: { id: "manual-invoice", status }, error: null })
    expect(await generateSubscriptionPeriodInvoice(input)).toEqual({ data: { id: "manual-invoice" }, existing: true })
    expect(write.insert).not.toHaveBeenCalled()
  })

  it.each(["cancelled", "refunded"])("does not silently replace a %s invoice", async (status) => {
    const { lookup, write } = setup()
    lookup.maybeSingle.mockResolvedValueOnce({ data: { id: "manual-invoice", status }, error: null })
    expect(await generateSubscriptionPeriodInvoice(input)).toHaveProperty("error", expect.stringContaining("New invoice"))
    expect(write.insert).not.toHaveBeenCalled()
  })

  it("keeps the invoice identity stable across retries and distinct between cycles", async () => {
    const first = setup()
    await generateSubscriptionPeriodInvoice(input)
    const id = first.write.insert.mock.calls[0][0].id
    const retry = setup()
    await generateSubscriptionPeriodInvoice(input)
    expect(retry.write.insert.mock.calls[0][0].id).toBe(id)
    const next = setup({ next_billing_date: "2026-11-20T00:00:00Z" })
    await generateSubscriptionPeriodInvoice({ ...input, billingDate: "2026-11-20" })
    expect(next.write.insert.mock.calls[0][0].id).not.toBe(id)
  })

  it("recovers a simultaneous or ambiguously acknowledged insert without creating another", async () => {
    const { write, lookup } = setup()
    write.single.mockResolvedValueOnce({ data: null, error: { code: "23505" } })
    lookup.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "recovered-invoice", status: "pending" }, error: null })
    expect(await generateSubscriptionPeriodInvoice(input)).toEqual({ data: { id: "recovered-invoice" }, existing: true })
    expect(write.insert).toHaveBeenCalledTimes(1)
  })

  it.each([0, -10, "NaN", "Infinity"])("rejects invalid stored amounts (%s)", async (amount) => {
    const { write } = setup({ amount })
    expect(await generateSubscriptionPeriodInvoice(input)).toHaveProperty("error")
    expect(write.insert).not.toHaveBeenCalled()
  })

  it.each(["paused", "cancelled", "expired"])("rejects %s subscriptions", async (status) => {
    const { write } = setup({ status })
    expect(await generateSubscriptionPeriodInvoice(input)).toHaveProperty("error")
    expect(write.insert).not.toHaveBeenCalled()
  })

  it("rejects a changed or missing billing anchor", async () => {
    const { write } = setup({ next_billing_date: null })
    expect(await generateSubscriptionPeriodInvoice(input)).toHaveProperty("error", "The billing period changed. Reload and retry.")
    expect(write.insert).not.toHaveBeenCalled()
  })

  it.each([{ siteId: "other-site" }, { subscriptionId: "other-subscription" }, { billingDate: "2026-02-30" }])("rejects invalid input before authorization (%j)", async (overrides) => {
    expect(await generateSubscriptionPeriodInvoice({ ...input, ...overrides })).toHaveProperty("error")
    expect(requireAccountingAccess).not.toHaveBeenCalled()
  })

  it("denies unauthorized and cross-tenant access", async () => {
    const { from } = setup()
    jest.mocked(requireAccountingAccess).mockRejectedValueOnce(new Error("Not authorized"))
    expect(await generateSubscriptionPeriodInvoice(input)).toHaveProperty("error")
    expect(from).not.toHaveBeenCalled()
    const { read, write } = setup()
    read.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect(await generateSubscriptionPeriodInvoice(input)).toEqual({ error: "Subscription not found" })
    expect(write.insert).not.toHaveBeenCalled()
  })

  it("fails closed if existing invoices cannot be verified", async () => {
    const { lookup, write } = setup()
    lookup.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "Private details" } })
    expect(await generateSubscriptionPeriodInvoice(input)).toEqual({ error: "Unable to verify invoices for this period" })
    expect(write.insert).not.toHaveBeenCalled()
  })

  it("requires an authenticated user even with an accounting client", async () => {
    const { auth, from } = setup()
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    expect(await generateSubscriptionPeriodInvoice(input)).toEqual({ error: "Authentication required" })
    expect(from).not.toHaveBeenCalled()
  })

  it("rejects invalid catalog currency before inserting", async () => {
    const { write } = setup({ catalog_item: { ...subscription.catalog_item, currency: "invalid" } })
    expect(await generateSubscriptionPeriodInvoice(input)).toEqual({ error: "The subscription plan has an invalid currency" })
    expect(write.insert).not.toHaveBeenCalled()
  })

  it("reports unconfirmed inserts without exposing database details", async () => {
    const { write } = setup()
    write.single.mockResolvedValueOnce({ data: null, error: { message: "Private details" } })
    expect(await generateSubscriptionPeriodInvoice(input)).toEqual({ error: "Unable to confirm the period invoice. Retry to check the same period." })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe("subscription billing calendar dates", () => {
  it.each([undefined, null, "", "2026-02-30", "bad date"])("rejects missing or invalid anchors (%s)", (value) => {
    expect(getSubscriptionBillingDate(value)).toBeNull()
  })
  it("keeps date-only values unchanged", () => expect(getSubscriptionBillingDate("2028-02-29")).toBe("2028-02-29"))
})