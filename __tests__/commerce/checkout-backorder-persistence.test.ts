/** @jest-environment node */
import { upsertSaleOrderItemsWithModifiers } from "@/app/commerce/checkout-order-items"
import { persistCheckoutRecords } from "@/app/commerce/checkout-records"
import type { ProcessedCheckoutLine } from "@/app/commerce/checkout-types"

jest.mock("@/app/promotions/resolve-promotion", () => ({ resolvePromotionDiscount: jest.fn() }))

type Row = Record<string, unknown> & {
  id: string
  metadata?: Record<string, unknown>
  items?: { metadata: Record<string, unknown> }[]
}

function recordClient(initial: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    sale_order_items: [], sale_orders: [], sales: [], ...initial,
  }
  const writes: { table: string; payload: Record<string, unknown> }[] = []
  return {
    tables, writes,
    from: jest.fn((table: string) => {
      let payload: Record<string, unknown> | undefined
      let insert = false
      const filters: Record<string, unknown> = {}
      const matches = (row: Row) => Object.entries(filters).every(([key, value]) => row[key] === value)
      const result = () => {
        if (!payload) return tables[table].filter(matches)
        writes.push({ table, payload })
        if (insert) {
          const row = { ...payload, id: `${table}-${tables[table].length + 1}` }
          tables[table].push(row)
          return [row]
        }
        return tables[table].filter(matches).map((row) => Object.assign(row, payload))
      }
      const query = {
        select: () => query,
        insert: (data: Record<string, unknown>) => { payload = data; insert = true; return query },
        update: (data: Record<string, unknown>) => { payload = data; return query },
        eq: (key: string, value: unknown) => { filters[key] = value; return query },
        single: async () => ({ data: result()[0], error: null }),
        then: <T>(resolve: (value: { data: Row[]; error: null }) => T) =>
          Promise.resolve({ data: result(), error: null }).then(resolve),
      }
      return query
    }),
  }
}

function processedLine(overrides: Partial<ProcessedCheckoutLine> = {}): ProcessedCheckoutLine {
  return {
    site_id: "site", catalog_item_id: "sku", name: "Product", currency: "USD",
    quantity: 4, unit_price: 10, subtotal: 40, is_reservation_dropin: false,
    isRoundRobinDropin: false, client_line_key: "host", parent_client_line_key: null,
    modifier_group_id: null, parent_name: null, backorder_quantity: 2, ...overrides,
  }
}

describe("durable POS backorder metadata", () => {
  const parent = processedLine()
  const modifier = processedLine({
    catalog_item_id: "extra", client_line_key: "modifier", parent_client_line_key: "host",
    modifier_group_id: "group", backorder_quantity: 3,
  })

  it("persists host and modifier shortage markers without introducing a lifecycle status", async () => {
    const client = recordClient()
    const admin = recordClient()
    const params = {
      supabase: client, supabaseAdmin: admin, isAdmin: false, siteId: "site", orderId: "order",
      existingItems: [], processedLines: [parent, modifier], lines: [], intent: "complete", isFullyPaid: true,
    }
    await upsertSaleOrderItemsWithModifiers(params)
    const rows = client.tables.sale_order_items
    expect(rows.map((row) => row.metadata?.backorder_quantity)).toEqual([2, 3])
    expect(rows.map((row) => row.status)).toEqual(["completed", "completed"])
    expect(rows[1].parent_sale_order_item_id).toBe(rows[0].id)
    expect(admin.from).not.toHaveBeenCalled()

    rows[0].metadata = { ...rows[0].metadata, kitchen_note: "Keep" }
    await upsertSaleOrderItemsWithModifiers({
      ...params, existingOrderId: "order", existingItems: rows,
      processedLines: [{ ...parent, backorder_quantity: 0 }, { ...modifier, backorder_quantity: 1 }],
    })
    expect(rows.map((row) => row.metadata?.backorder_quantity)).toEqual([0, 1])
    expect(rows[0].metadata?.kitchen_note).toBe("Keep")
    expect(rows).toHaveLength(2)
  })

  it("does not add backorder metadata for non-POS lines", async () => {
    const client = recordClient()
    const nonPos = { ...parent }
    delete nonPos.backorder_quantity
    await upsertSaleOrderItemsWithModifiers({
      supabase: client, supabaseAdmin: client, isAdmin: false, siteId: "site", orderId: "order",
      existingItems: [], processedLines: [nonPos], lines: [], isFullyPaid: false,
    })
    expect(client.tables.sale_order_items[0].metadata).not.toHaveProperty("backorder_quantity")
  })

  it("persists and refreshes markers in serialized sale order items used by Sales rehydration", async () => {
    const client = recordClient()
    const params = {
      supabase: client, supabaseAdmin: client, isAdmin: false, siteId: "site", source: "pos" as const,
      fulfillment: "none" as const, quoteForAccept: null, processedLines: [parent, modifier],
      orderSubtotal: 80, orderTaxTotal: 0, orderShippingCost: 0, orderCurrency: "USD",
    }
    const result = await persistCheckoutRecords(params)
    const rows = client.tables.sale_orders
    expect(rows[0].items?.map((item) => item.metadata.backorder_quantity)).toEqual([2, 3])
    expect(rows[0].items?.[1].metadata).toMatchObject({
      client_line_key: "modifier", parent_client_line_key: "host", is_modifier: true,
    })
    await persistCheckoutRecords({
      ...params, effectiveExistingOrderId: result.order.id,
      processedLines: [{ ...parent, backorder_quantity: 0 }, { ...modifier, backorder_quantity: 0 }],
    })
    expect(rows[0].items?.map((item) => item.metadata.backorder_quantity)).toEqual([0, 0])
    expect(rows).toHaveLength(1)
  })

  it("keeps non-POS serialized item metadata unchanged", async () => {
    const client = recordClient()
    const nonPos = { ...parent }
    delete nonPos.backorder_quantity
    await persistCheckoutRecords({
      supabase: client, supabaseAdmin: client, isAdmin: false, siteId: "site", source: "shop",
      fulfillment: "none", quoteForAccept: null, processedLines: [nonPos],
      orderSubtotal: 40, orderTaxTotal: 0, orderShippingCost: 0, orderCurrency: "USD",
    })
    expect(client.tables.sale_orders[0].items?.[0].metadata).not.toHaveProperty("backorder_quantity")
  })
})