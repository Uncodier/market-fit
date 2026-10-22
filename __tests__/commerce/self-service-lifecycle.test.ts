/** @jest-environment node */
import { persistCheckoutRecords } from "@/app/commerce/checkout-records"
import { upsertSaleOrderItemsWithModifiers } from "@/app/commerce/checkout-order-items"
import { resolvePromotionDiscount } from "@/app/promotions/resolve-promotion"
import { isPersistedSelfServiceSalePaid, selfServiceLineState } from "@/app/commerce/self-service-lifecycle"
import type { ProcessedCheckoutLine } from "@/app/commerce/checkout-types"

jest.mock("@/app/promotions/resolve-promotion", () => ({ resolvePromotionDiscount: jest.fn() }))

type Row = Record<string, unknown> & { id: string; metadata?: Record<string, unknown> }
function database() {
  const tables: Record<string, Row[]> = { sales: [], sale_orders: [], sale_order_items: [] }
  return {
    tables,
    from: (table: string) => {
      let payload: Record<string, unknown> | undefined
      let insert = false
      const filters: Record<string, unknown> = {}
      const result = () => {
        const rows = tables[table].filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value))
        if (!payload) return rows
        if (insert) {
          const row = { ...payload, id: `${table}-${tables[table].length + 1}` }
          tables[table].push(row)
          return [row]
        }
        return rows.map((row) => Object.assign(row, payload))
      }
      const query = {
        select: () => query,
        insert: (data: Record<string, unknown>) => { payload = data; insert = true; return query },
        update: (data: Record<string, unknown>) => { payload = data; return query },
        eq: (key: string, value: unknown) => { filters[key] = value; return query },
        single: async () => ({ data: result()[0], error: null }),
        then: <T>(resolve: (value: { data: Row[]; error: null }) => T) => Promise.resolve({ data: result(), error: null }).then(resolve),
      }
      return query
    },
  }
}

const line: ProcessedCheckoutLine = {
  site_id: "site", catalog_item_id: "product", name: "Product", currency: "USD",
  quantity: 1, unit_price: 20, subtotal: 20, is_reservation_dropin: false,
  isRoundRobinDropin: false, client_line_key: "parent", parent_client_line_key: null,
  modifier_group_id: null, parent_name: null,
}
const modifier = { ...line, catalog_item_id: "extra", client_line_key: "child", parent_client_line_key: "parent" }

function recordParams(client: ReturnType<typeof database>): Parameters<typeof persistCheckoutRecords>[0] {
  return {
    supabase: client, supabaseAdmin: client, isAdmin: false, siteId: "site", source: "shop",
    fulfillment: "pickup", quoteForAccept: null, processedLines: [line], intent: "draft",
    selfServiceLocationId: "location", finalOriginLocationId: "location", paymentMethod: "cash",
    orderSubtotal: 20, orderTaxTotal: 0, orderShippingCost: 0, orderCurrency: "USD",
  }
}

describe("self-service persisted payment gate", () => {
  it("creates a pending cash sale and marks the order without payment rows", async () => {
    const client = database()
    const result = await persistCheckoutRecords(recordParams(client))
    expect(result).toMatchObject({ isFullyPaid: false, orderInitialStatus: "pending", saleInitialStatus: "pending" })
    expect(result.sale).toMatchObject({ source: "shop", payment_method: "cash", amount_due: 20, payments: [] })
    expect(result.order.items[0].metadata).toMatchObject({ self_service: true, self_service_location_id: "location" })
    expect(result.order.order_number).toMatch(/^K-[A-F0-9]{12}$/)
  })

  it("releases a genuinely free draft after a server-resolved coupon, not a client total", async () => {
    jest.mocked(resolvePromotionDiscount).mockResolvedValueOnce({ data: { discount: 20, promotionId: "promo" } } as never)
    const result = await persistCheckoutRecords({ ...recordParams(database()), promotionCode: "FREE" })
    expect(result).toMatchObject({ orderTotal: 0, isFullyPaid: true, saleInitialStatus: "completed", orderInitialStatus: "completed" })
    expect(result.sale).toMatchObject({ amount_due: 0, payments: [] })
  })

  it("does not treat a coupon as free while trusted tax remains payable", async () => {
    jest.mocked(resolvePromotionDiscount).mockResolvedValueOnce({ data: { discount: 20, promotionId: "promo" } } as never)
    const result = await persistCheckoutRecords({ ...recordParams(database()), promotionCode: "FREE", orderTaxTotal: 2 })
    expect(result).toMatchObject({ orderTotal: 2, isFullyPaid: false, orderInitialStatus: "pending" })
  })

  it("preserves the marker and shop source through partial and full POS cash completion", async () => {
    const client = database()
    const initial = await persistCheckoutRecords(recordParams(client))
    const pos = { ...recordParams(client), source: "pos" as const, selfServiceLocationId: undefined,
      effectiveExistingOrderId: initial.order.id, intent: "complete" as const }
    const partial = await persistCheckoutRecords({ ...pos, payments: [{ method: "cash", amount: 5 }] })
    expect(partial).toMatchObject({ isFullyPaid: false, orderInitialStatus: "pending", saleInitialStatus: "pending" })
    expect(partial.sale.source).toBe("shop")
    expect(partial.order.items[0].metadata.self_service).toBe(true)
    const paid = await persistCheckoutRecords({ ...pos, payments: [{ method: "cash", amount: 15 }] })
    expect(paid).toMatchObject({ isFullyPaid: true, orderInitialStatus: "completed", saleInitialStatus: "completed" })
    expect(paid.sale.amount_due).toBe(0)
  })

  it("leaves ordinary unpaid POS completion semantics unchanged", async () => {
    const result = await persistCheckoutRecords({ ...recordParams(database()), source: "pos", selfServiceLocationId: undefined, intent: "complete" })
    expect(result).toMatchObject({ isFullyPaid: false, saleInitialStatus: "pending", orderInitialStatus: "completed" })
    expect(result.order.items[0].metadata).not.toHaveProperty("self_service")
  })
})

describe("self-service kitchen line lifecycle", () => {
  it.each(["draft", "send", "complete", "pay"])("keeps unpaid parents and modifiers draft for intent %s", async (intent) => {
    const client = database()
    await upsertSaleOrderItemsWithModifiers({ supabase: client, supabaseAdmin: client, isAdmin: false,
      siteId: "site", orderId: "order", existingItems: [], processedLines: [line, modifier], lines: [],
      intent, isFullyPaid: false, selfService: true, selfServiceLocationId: "location" })
    expect(client.tables.sale_order_items.map((row) => row.status)).toEqual(["draft", "draft"])
    expect(client.tables.sale_order_items.map((row) => row.sent_at)).toEqual([null, null])
    expect(client.tables.sale_order_items.every((row) => row.metadata?.self_service === true)).toBe(true)
  })

  it.each(["draft", "complete", "pay"])("releases paid drafts as new, not completed, for intent %s", async (intent) => {
    const client = database()
    await upsertSaleOrderItemsWithModifiers({ supabase: client, supabaseAdmin: client, isAdmin: false,
      siteId: "site", orderId: "order", existingItems: [], processedLines: [line, modifier], lines: [],
      intent, isFullyPaid: true, selfService: true, selfServiceLocationId: "location" })
    expect(client.tables.sale_order_items.map((row) => row.status)).toEqual(["new", "new"])
    expect(client.tables.sale_order_items.every((row) => typeof row.sent_at === "string")).toBe(true)
  })

  it.each(["new", "preparing", "ready", "completed", "cancelled"])("does not re-release a %s line on retry", (status) => {
    expect(selfServiceLineState(true, { status, sent_at: "original" })).toEqual({ newStatus: status, sentAt: "original" })
  })

  it.each([null, {}, { status: "pending", amount_due: 0 }, { status: "completed", amount_due: 1 },
    { status: "completed", amount_due: "invalid" }, { status: "refunded", amount_due: 0 }])("fails closed on unpaid or invalid persisted sale %#", (sale) => {
    expect(isPersistedSelfServiceSalePaid(sale)).toBe(false)
  })
})