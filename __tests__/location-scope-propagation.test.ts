/** @jest-environment node */
import { createQuotationFromDeal } from "@/app/quotations/actions"
import { createSubscriptionInvoice } from "@/app/subscriptions/actions"
import { generateSubscriptionPeriodInvoice } from "@/app/subscriptions/generate-period-invoice"
import { persistCheckoutRecords } from "@/app/commerce/checkout-records"
import { finalizeCheckout } from "@/app/commerce/checkout-finalize"
import { createClient } from "@/lib/supabase/server"
import { requireAccountingAccess } from "@/app/accounting/access"

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/app/accounting/access", () => ({ requireAccountingAccess: jest.fn() }))
jest.mock("@/app/catalog/tax-actions", () => ({ getTaxesByCatalogItemIds: jest.fn() }))
jest.mock("@/app/quotations/quotation-pdf", () => ({}))
jest.mock("@/app/quotations/send-quotation-email", () => ({}))
jest.mock("@/app/quotations/public-actions", () => ({}))
jest.mock("@/app/promotions/resolve-promotion", () => ({ resolvePromotionDiscount: jest.fn() }))
jest.mock("@/lib/redis/json-cache", () => ({ bumpCacheEpoch: jest.fn() }))
jest.mock("@/app/shipments/create-shipment", () => ({ createAuthorizedShipment: jest.fn() }))
jest.mock("@/app/promotions/apply-promotion-to-order", () => ({ applyPromotionToOrder: jest.fn() }))
jest.mock("@/app/accounting/source-posting", () => ({ tryPostSaleJournalWithClient: jest.fn() }))
jest.mock("@/app/documents/public-token-store", () => ({ ensurePublicAccessTokenForRecord: jest.fn().mockResolvedValue({ token: "public-token" }) }))
jest.mock("@/app/commerce/entitlements", () => ({ grantFromOrder: jest.fn(), syncSubscriptionEntitlements: jest.fn() }))
jest.mock("@/app/commerce/checkout-order-items", () => ({ upsertSaleOrderItemsWithModifiers: jest.fn().mockResolvedValue([]) }))
jest.mock("@/app/commerce/checkout-reservations", () => ({ syncCheckoutDropinReservations: jest.fn() }))
jest.mock("@/app/pos/actions/idempotency", () => ({ recordPosClientMutation: jest.fn() }))
jest.mock("@/app/commerce/ensure-commerce-lead-converted", () => ({ isCommerceLeadSource: jest.fn().mockReturnValue(false) }))

const siteId = "11111111-1111-4111-8111-111111111111"
const parentId = "22222222-2222-4222-8222-222222222222"
const branch = "33333333-3333-4333-8333-333333333333"
const warehouse = "44444444-4444-4444-8444-444444444444"
const scopeCases = [{ location_id: branch }, { location_id: null }, {}]
function read(data: unknown) {
  return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(), like: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), lt: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data, error: null }) }
}
function write(id: string) {
  return { insert: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id }, error: null }) }
}
function assertScope(payload: Record<string, unknown>, source: { location_id?: string | null }) {
  if ("location_id" in source) expect(payload).toHaveProperty("location_id", source.location_id)
  else expect(payload).not.toHaveProperty("location_id")
}
const auth = { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "actor" } }, error: null }) }

describe("canonical location propagation without default attribution", () => {
  beforeEach(() => jest.clearAllMocks())

  it.each(scopeCases)("copies a same-site deal's optional scope to its quotation: %j", async scope => {
    const parent = read({ id: parentId, site_id: siteId, ...scope })
    const quote = write("quote")
    const lead = read({ buyer_user_id: "buyer" })
    const from = jest.fn(table => table === "deals" ? parent : table === "leads" ? lead : quote)
    jest.mocked(createClient).mockResolvedValue({ from } as never)
    expect(await createQuotationFromDeal(siteId, parentId, "lead")).toHaveProperty("data.id", "quote")
    expect(parent.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(parent.eq).toHaveBeenCalledWith("id", parentId)
    expect(parent.select).toHaveBeenCalledWith("*")
    assertScope(quote.insert.mock.calls[0][0][0], scope)
  })

  it("does not create a quotation for a missing, foreign or RLS-hidden deal", async () => {
    const parent = read(null)
    const from = jest.fn().mockReturnValue(parent)
    jest.mocked(createClient).mockResolvedValue({ from } as never)
    expect(await createQuotationFromDeal(siteId, parentId, "lead")).toEqual({ error: "Deal not found" })
    expect(from.mock.calls).toEqual([["deals"]])
  })

  it.each(scopeCases)("copies subscription scope to manual and period invoices, preserving absent legacy columns: %j", async scope => {
    const subscription = read({ id: parentId, site_id: siteId, status: "active", amount: 20,
      next_billing_date: "2026-10-20", due_date: null, catalog_item: { name: "Plan", kind: "service", currency: "USD" }, ...scope })
    const invoice = write("invoice")
    const client = { auth, from: jest.fn(table => table === "subscriptions" ? subscription : invoice) }
    jest.mocked(createClient).mockResolvedValue(client as never)
    expect(await createSubscriptionInvoice({ siteId, subscriptionId: parentId, amount: 20, invoiceDate: "2026-10-20" })).toHaveProperty("data.id", "invoice")
    assertScope(invoice.insert.mock.calls[0][0], scope)
    expect(subscription.eq).toHaveBeenCalledWith("site_id", siteId)
    const lookup = read(null)
    const from = jest.fn().mockReturnValueOnce(subscription)
      .mockReturnValueOnce(lookup).mockReturnValueOnce(lookup).mockReturnValueOnce(lookup).mockReturnValueOnce(invoice)
    jest.mocked(requireAccountingAccess).mockResolvedValue({ auth, from } as never)
    expect(await generateSubscriptionPeriodInvoice({ siteId, subscriptionId: parentId, billingDate: "2026-10-20" })).toHaveProperty("data.id", "invoice")
    assertScope(invoice.insert.mock.calls[1][0], scope)
  })

  it.each(scopeCases)("uses a quote's scope for sales/orders but preserves physical fulfillment origin: %j", async scope => {
    const sale = write("sale")
    const order = write("order")
    const client = { from: jest.fn(table => table === "sales" ? sale : order) }
    const admin = { from: jest.fn().mockReturnValue(read(null)) }
    await persistCheckoutRecords({
      supabase: client, supabaseAdmin: admin, isAdmin: false, siteId, source: "quote", fulfillment: "ship",
      finalOriginLocationId: warehouse, quoteForAccept: { id: parentId, site_id: siteId, status: "sent", ...scope },
      processedLines: [], orderSubtotal: 10, orderTaxTotal: 0, orderShippingCost: 0, orderCurrency: "USD",
    })
    assertScope(sale.insert.mock.calls[0][0], scope)
    assertScope(order.insert.mock.calls[0][0], scope)
    expect(order.insert.mock.calls[0][0]).toHaveProperty("origin_location_id", warehouse)
  })

  it("preserves an existing sale's canonical location when fulfillment origin changes", async () => {
    const saleRead = read({ id: "sale", location_id: branch, status: "pending", amount: 10, amount_due: 10 })
    const orderRead = read({ id: "order", sale_id: "sale", location_id: branch, status: "pending" })
    const sale = write("sale")
    const order = write("order")
    const from = jest.fn().mockReturnValueOnce(orderRead).mockReturnValueOnce(saleRead)
      .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [] }) }).mockReturnValueOnce(sale).mockReturnValueOnce(order)
    await persistCheckoutRecords({
      supabase: { from }, supabaseAdmin: { from }, isAdmin: false, siteId, source: "pos", fulfillment: "ship",
      finalOriginLocationId: warehouse, quoteForAccept: null, effectiveExistingOrderId: "order",
      processedLines: [], orderSubtotal: 10, orderTaxTotal: 0, orderShippingCost: 0, orderCurrency: "USD",
    })
    expect(sale.update.mock.calls[0][0]).not.toHaveProperty("location_id")
    expect(order.update.mock.calls[0][0]).not.toHaveProperty("location_id")
    expect(order.update.mock.calls[0][0]).toHaveProperty("origin_location_id", warehouse)
  })

  it.each(scopeCases)("creates recurring subscriptions from persisted order scope, never fulfillment origin: %j", async scope => {
    const subscription = write("subscription")
    const catalog = { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [{ id: "sku", is_recurring: true }] }) }
    const client = { from: jest.fn(table => table === "catalog_items" ? catalog : table === "subscriptions" ? subscription : read(null)) }
    const line = { site_id: siteId, catalog_item_id: "sku", name: "Plan", currency: "USD", quantity: 1,
      unit_price: 10, subtotal: 10, is_reservation_dropin: false, isRoundRobinDropin: false,
      client_line_key: "line", parent_client_line_key: null, modifier_group_id: null, parent_name: null }
    await finalizeCheckout({
      supabase: client, supabaseAdmin: client, isAdmin: false, isStaffCheckout: true, siteId, source: "pos",
      lines: [], processedLines: [line], sale: { id: "sale" }, order: { id: "order", ...scope }, existingItems: [],
      fulfillment: "ship", finalOriginLocationId: warehouse, intent: "draft", isFullyPaid: false,
      orderInitialStatus: "pending", quoteForAccept: null, activeQuotationClaim: null, orderTotal: 10,
    })
    assertScope(subscription.insert.mock.calls[0][0], scope)
  })
})