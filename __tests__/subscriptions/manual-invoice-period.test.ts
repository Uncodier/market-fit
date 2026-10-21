/** @jest-environment node */

import { createSubscriptionInvoice } from "@/app/subscriptions/actions"
import { getSubscriptionInvoicePeriod } from "@/app/subscriptions/billing-period"
import { createClient } from "@/lib/supabase/server"

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const siteId = "11111111-1111-4111-8111-111111111111"
const subscriptionId = "22222222-2222-4222-8222-222222222222"
const input = { siteId, subscriptionId, amount: 125, invoiceDate: "2026-10-06" }

function setup(nextBillingDate: string | null = "2026-09-30T23:00:00-05:00") {
  const read = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: {
      id: subscriptionId, next_billing_date: nextBillingDate, due_date: "2026-10-15",
      lead_id: "lead-1", location_id: "location-1", catalog_item: { name: "Growth plan", kind: "service" },
    }, error: null }),
  }
  const write = {
    insert: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: "manual-invoice" }, error: null }),
  }
  const auth = { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) }
  jest.mocked(createClient).mockResolvedValue({
    auth, from: jest.fn((table: string) => table === "subscriptions" ? read : write),
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  return { read, write, auth }
}

describe("manual subscription invoice period metadata", () => {
  beforeEach(() => jest.resetAllMocks())

  it.each([undefined, "2026-10-01"])("preserves the verified canonical timestamp for the current period (%s)", async (billingDate) => {
    const { write, read } = setup()
    expect(await createSubscriptionInvoice({ ...input, billingDate })).toEqual({ data: { id: "manual-invoice" } })
    expect(read.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(read.eq).toHaveBeenCalledWith("id", subscriptionId)
    expect(write.insert).toHaveBeenCalledWith(expect.objectContaining({
      sale_date: "2026-10-06", due_date: "2026-10-20", location_id: "location-1",
      product_details: {
        subscription_id: subscriptionId, billing_cycle: "2026-10-01T04:00:00.000Z",
        billing_period_start: "2026-10-01", billing_period_end: "2026-11-01",
      },
    }))
  })

  it("stores a selected historical period independently of the invoice and due dates", async () => {
    const { write } = setup()
    await createSubscriptionInvoice({ ...input, billingDate: "2026-01-31", dueDate: "2026-10-25" })
    expect(write.insert).toHaveBeenCalledWith(expect.objectContaining({
      sale_date: "2026-10-06", due_date: "2026-10-25",
      product_details: {
        subscription_id: subscriptionId, billing_cycle: "2026-01-31T00:00:00.000Z",
        billing_period_start: "2026-01-31", billing_period_end: "2026-02-28",
      },
    }))
  })

  it.each(["", "2026-02-30", "2026-10-01T00:00:00Z", "wrong", null])("rejects provided invalid billing dates before reading (%s)", async (billingDate) => {
    expect(await createSubscriptionInvoice({ ...input, billingDate: billingDate as unknown as string }))
      .toEqual({ error: "Enter a valid billing period (YYYY-MM-DD)" })
    expect(createClient).not.toHaveBeenCalled()
  })

  it.each([null, "bad date", "2026-02-30T00:00:00Z"])("rejects invalid verified anchors (%s)", async (anchor) => {
    const { write } = setup(anchor)
    expect(await createSubscriptionInvoice(input)).toEqual({ error: "The subscription must have a valid next billing date" })
    expect(write.insert).not.toHaveBeenCalled()
  })

  it("does not insert for a subscription missing from the selected tenant", async () => {
    const { read, write } = setup()
    read.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect(await createSubscriptionInvoice(input)).toEqual({ error: "Subscription not found" })
    expect(write.insert).not.toHaveBeenCalled()
  })

  it("requires authentication before reading the verified subscription", async () => {
    const { auth, read } = setup()
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    expect(await createSubscriptionInvoice(input)).toEqual({ error: "Not authenticated" })
    expect(read.select).not.toHaveBeenCalled()
  })
})

describe("monthly invoice period boundaries", () => {
  it.each([
    ["2026-01-31", "2026-02-28"], ["2028-01-31", "2028-02-29"],
    ["2028-02-29", "2028-03-29"], ["2026-12-31", "2027-01-31"],
    ["0099-12-31", "0100-01-31"],
  ])("clamps %s to an exclusive next monthly anchor %s", (start, end) => {
    expect(getSubscriptionInvoicePeriod(subscriptionId, start)).toEqual({
      subscription_id: subscriptionId, billing_cycle: `${start}T00:00:00.000Z`,
      billing_period_start: start, billing_period_end: end,
    })
  })

  it("rejects an exclusive end outside the supported calendar range", () => {
    expect(getSubscriptionInvoicePeriod(subscriptionId, "9999-12-31")).toBeNull()
  })
})