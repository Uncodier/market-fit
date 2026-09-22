/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  createSubscriptionInvoice,
  getSubscriptionDetail,
} from "@/app/subscriptions/actions"
import { createClient } from "@/lib/supabase/server"

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}))

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

const SITE_ID = "11111111-1111-4111-8111-111111111111"
const SUBSCRIPTION_ID = "22222222-2222-4222-8222-222222222222"

describe("subscription invoices", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("creates a pending sale linked to the scoped subscription", async () => {
    const subscriptionQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          id: SUBSCRIPTION_ID,
          site_id: SITE_ID,
          lead_id: "33333333-3333-4333-8333-333333333333",
          buyer_user_id: "44444444-4444-4444-8444-444444444444",
          catalog_item: { name: "Growth plan", kind: "service" },
        },
        error: null,
      }),
    }
    const invoiceQuery = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: "55555555-5555-4555-8555-555555555555" },
        error: null,
      }),
    }
    const supabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "66666666-6666-4666-8666-666666666666" } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "subscriptions") return subscriptionQuery
        if (table === "sales") return invoiceQuery
        throw new Error(`Unexpected table: ${table}`)
      }),
    }
    ;(createClient as jest.Mock).mockResolvedValue(supabase)

    const result = await createSubscriptionInvoice({
      siteId: SITE_ID,
      subscriptionId: SUBSCRIPTION_ID,
      amount: 125,
      invoiceDate: "2026-09-22",
    })

    expect(result).toEqual({
      data: { id: "55555555-5555-4555-8555-555555555555" },
    })
    expect(subscriptionQuery.eq).toHaveBeenCalledWith("site_id", SITE_ID)
    expect(subscriptionQuery.eq).toHaveBeenCalledWith("id", SUBSCRIPTION_ID)
    expect(invoiceQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_id: SUBSCRIPTION_ID,
        site_id: SITE_ID,
        amount: 125,
        amount_due: 125,
        sale_date: "2026-09-22",
        status: "pending",
      })
    )
  })

  it("rejects invalid invoice values before accessing the database", async () => {
    const result = await createSubscriptionInvoice({
      siteId: SITE_ID,
      subscriptionId: SUBSCRIPTION_ID,
      amount: 0,
      invoiceDate: "2026-09-22",
    })

    expect(result).toEqual({ error: "Enter a valid invoice amount" })
    expect(createClient).not.toHaveBeenCalled()
  })

  it("loads invoices only after finding the subscription in the same site", async () => {
    const subscriptionQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          id: SUBSCRIPTION_ID,
          site_id: SITE_ID,
          lead: { id: "lead-1", name: "Avery", email: "a@example.com" },
          catalog_item: { id: "item-1", name: "Growth plan" },
        },
        error: null,
      }),
    }
    const invoiceRows = [{
      id: "invoice-1",
      title: "Growth plan invoice",
      invoice_number: "INV-12",
      amount: "125",
      amount_due: "25",
      currency: "USD",
      status: "pending",
      sale_date: "2026-09-22",
      payments: [{
        id: "payment-1",
        date: "2026-09-23T10:00:00",
        amount: "100",
        method: "bank_transfer",
        notes: "First payment",
      }],
    }]
    const invoiceQuery: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    }
    invoiceQuery.order = jest
      .fn()
      .mockReturnValueOnce(invoiceQuery)
      .mockResolvedValueOnce({ data: invoiceRows, error: null })

    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: jest.fn((table: string) =>
        table === "subscriptions" ? subscriptionQuery : invoiceQuery
      ),
    })

    const result = await getSubscriptionDetail(SITE_ID, SUBSCRIPTION_ID)

    expect(subscriptionQuery.eq).toHaveBeenCalledWith("site_id", SITE_ID)
    expect(invoiceQuery.eq).toHaveBeenCalledWith("site_id", SITE_ID)
    expect(invoiceQuery.eq).toHaveBeenCalledWith("subscription_id", SUBSCRIPTION_ID)
    expect(result.invoices).toEqual([
      expect.objectContaining({
        id: "invoice-1",
        amount: 125,
        amountDue: 25,
        payments: [{
          id: "payment-1",
          date: "2026-09-23T10:00:00",
          amount: 100,
          method: "bank_transfer",
          notes: "First payment",
        }],
      }),
    ])
  })

  it("adds an indexed foreign key from sales to subscriptions", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260922134000_link_sales_to_subscriptions.sql"
      ),
      "utf8"
    )

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS subscription_id uuid")
    expect(sql).toContain("REFERENCES public.subscriptions(id)")
    expect(sql).toContain("sales_site_subscription_date_idx")
  })
})
