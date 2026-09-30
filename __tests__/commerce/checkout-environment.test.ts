/** @jest-environment node */

import { prepareCheckoutEnvironment } from "@/app/commerce/checkout-environment"
import type { CheckoutSource } from "@/app/commerce/checkout-types"

const sources: CheckoutSource[] = ["shop", "marketplace", "quote", "pos", "sales"]
const activeSite = { user_id: "site-owner", archived_at: null }

function setup(site: Record<string, unknown> | null = activeSite, error: unknown = null) {
  const siteQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: site, error }),
  }
  const settings = { currency: "USD" }
  const settingsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: settings }),
  }
  const catalogQuery = {
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({
      data: [{ id: "item-1", kind: "service", is_recurring: false, metadata: {} }],
      error: null,
    }),
  }
  const supabaseAdmin = {
    from: jest.fn((table: string) => {
      if (table === "sites") return siteQuery
      if (table === "settings") return settingsQuery
      if (table === "catalog_items") return catalogQuery
      throw new Error(`Unexpected admin table: ${table}`)
    }),
  }
  const supabase = {
    from: jest.fn((table: string) => {
      if (table === "catalog_items") return catalogQuery
      throw new Error(`Unexpected user table: ${table}`)
    }),
  }
  const params = {
    supabase,
    supabaseAdmin,
    siteId: "site-1",
    lines: [{ catalogItemId: "item-1", quantity: 1 }],
    source: "shop" as CheckoutSource,
    inputSource: "shop" as CheckoutSource,
    fulfillment: "none" as const,
  }
  return { params, siteQuery, settings, catalogQuery }
}

describe("prepareCheckoutEnvironment archived sites", () => {
  it.each(sources)("rejects archived %s checkout before reading settings or creating a lead", async (source) => {
    const { params, siteQuery } = setup({ ...activeSite, archived_at: "2026-09-22T10:00:00Z" })

    await expect(prepareCheckoutEnvironment({
      ...params,
      source,
      inputSource: source,
      customerEmail: "buyer@example.test",
      customerName: "Buyer",
    })).rejects.toThrow("This site is archived and cannot accept new checkouts.")

    expect(siteQuery.select).toHaveBeenCalledWith("user_id, archived_at")
    expect(siteQuery.eq).toHaveBeenCalledWith("id", "site-1")
    expect(params.supabaseAdmin.from.mock.calls).toEqual([["sites"]])
    expect(params.supabase.from).not.toHaveBeenCalled()
  })

  it.each(sources)("preserves active %s checkout client, owner, settings and schedule", async (source) => {
    const { params, settings } = setup()
    const isAdmin = ["shop", "marketplace", "quote"].includes(source)
    const scheduledFor = "2026-10-01T12:00:00Z"
    const result = await prepareCheckoutEnvironment({ ...params, source, inputSource: source, scheduledFor })

    expect(result).toMatchObject({
      isAdmin,
      isStaffCheckout: !isAdmin,
      siteSettings: settings,
      resolvedUserId: isAdmin ? "site-owner" : undefined,
      resolvedScheduledFor: scheduledFor,
      priceListChannel: ["pos", "shop", "marketplace"].includes(source) ? source : null,
    })
    expect(result.queryClient).toBe(isAdmin ? params.supabaseAdmin : params.supabase)
  })

  it("preserves an explicitly resolved user for active checkout", async () => {
    const { params } = setup()
    const result = await prepareCheckoutEnvironment({ ...params, userId: "resolved-user" })
    expect(result.resolvedUserId).toBe("resolved-user")
  })

  it.each([
    ["missing site", null, null],
    ["database error", activeSite, { message: "private database details" }],
  ])("fails closed for %s without exposing database errors", async (_label, site, error) => {
    const { params } = setup(site, error)
    await expect(prepareCheckoutEnvironment(params)).rejects.toThrow("Site is unavailable for checkout.")
    expect(params.supabaseAdmin.from.mock.calls).toEqual([["sites"]])
  })

  it("retains the empty-cart validation for active sites", async () => {
    const { params } = setup()
    await expect(prepareCheckoutEnvironment({ ...params, lines: [] })).rejects.toThrow("Cart is empty")
  })
})