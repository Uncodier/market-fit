/** @jest-environment node */
import { persistCheckoutRecords } from "@/app/commerce/checkout-records"
import type { ProcessedCheckoutLine } from "@/app/commerce/checkout-types"

jest.mock("@/app/promotions/resolve-promotion", () => ({ resolvePromotionDiscount: jest.fn() }))

const line: ProcessedCheckoutLine = {
  site_id: "site", catalog_item_id: "product", name: "Product", currency: "USD",
  quantity: 1, unit_price: 20, subtotal: 20, is_reservation_dropin: false,
  isRoundRobinDropin: false, client_line_key: "line", parent_client_line_key: null,
  modifier_group_id: null, parent_name: null,
}
type Row = Record<string, unknown>

/** Copies reads like the SDK; a second screen changes the order before persistence. */
function database(status = "pending", selfService = false) {
  const order: Row = { id: "order", site_id: "site", sale_id: "sale", status, total: 20,
    items: selfService ? [{ metadata: { self_service: true } }] : [], currency: "USD" }
  const sale: Row = { id: "sale", site_id: "site", source: selfService ? "shop" : "pos",
    status: "pending", amount: 20, amount_due: 20, payments: [] }
  const tables: Record<string, Row[]> = { sale_orders: [order], sales: [sale],
    sale_order_items: [{ ...line, id: "item", sale_order_id: "order", status: "new", metadata: { client_line_key: "line" } }] }
  const writes: { table: string; payload: Row; filters: Row }[] = []
  let onSaleWrite: (() => void) | undefined
  const client = { from(table: string) {
    const filters: Row = {}
    let payload: Row | undefined
    const execute = () => {
      if (payload && table === "sales") onSaleWrite?.()
      const rows = tables[table].filter(row => Object.entries(filters).every(([key, value]) => row[key] === value))
      if (payload) {
        writes.push({ table, payload, filters: { ...filters } })
        rows.forEach(row => Object.assign(row, payload))
      }
      return structuredClone(rows)
    }
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query },
      update: (data: Row) => { payload = data; return query },
      single: async () => {
        const rows = execute()
        return rows.length === 1 ? { data: rows[0], error: null }
          : { data: null, error: { code: "PGRST116", message: "No matching row" } }
      },
      then: <T>(resolve: (value: { data: Row[]; error: null }) => T) => Promise.resolve({ data: execute(), error: null }).then(resolve),
    }
    return query
  } }
  return { client, order, writes, beforeOrderWrite(callback: () => void) { onSaleWrite = callback } }
}

function params(db: ReturnType<typeof database>, intent: "draft" | "send" | "pay" | "complete"):
Parameters<typeof persistCheckoutRecords>[0] {
  return { supabase: db.client, supabaseAdmin: db.client, isAdmin: false, siteId: "site", source: "pos",
    fulfillment: "pickup", quoteForAccept: null, processedLines: [line], intent,
    effectiveExistingOrderId: "order", orderSubtotal: 20, orderTaxTotal: 0,
    orderShippingCost: 0, orderCurrency: "USD" }
}

it.each(["draft", "send", "pay"] as const)("%s does not echo a pending snapshot over concurrent kitchen progress", async intent => {
  const db = database()
  db.beforeOrderWrite(() => { db.order.status = "in_progress" })
  const result = await persistCheckoutRecords(params(db, intent))
  expect(db.order.status).toBe("in_progress")
  expect(result.orderInitialStatus).toBe("in_progress")
  const write = db.writes.find(write => write.table === "sale_orders")!
  expect(write.payload).not.toHaveProperty("status")
  expect(write.filters).toMatchObject({ site_id: "site", id: "order" })
})

it.each(["in_progress", "completed", "cancelled"])("a self-service payment does not regress a concurrent %s status", async status => {
  const db = database("pending", true)
  db.beforeOrderWrite(() => { db.order.status = status })
  const result = await persistCheckoutRecords({ ...params(db, "pay"), payments: [{ method: "cash", amount: 20 }] })
  expect(db.order.status).toBe(status)
  expect(result.orderInitialStatus).toBe(status)
  expect(db.writes.find(write => write.table === "sale_orders")!.payload).not.toHaveProperty("status")
})

it.each(["draft", "send"] as const)("%s preserves already completed work when it has no new lines", async intent => {
  const db = database("completed")
  await persistCheckoutRecords(params(db, intent))
  expect(db.order.status).toBe("completed")
  expect(db.writes.find(write => write.table === "sale_orders")!.payload).not.toHaveProperty("status")
})

it("retains explicit Send reopening for new work, conditional on the observed status", async () => {
  const db = database("completed")
  const result = await persistCheckoutRecords({ ...params(db, "send"), processedLines: [{ ...line, quantity: 2 }] })
  expect(result.order.status).toBe("pending")
  expect(db.writes.find(write => write.table === "sale_orders")).toMatchObject({
    payload: { status: "pending" }, filters: { site_id: "site", id: "order", status: "completed" },
  })
})

it("does not let queued Send reopening overwrite a concurrent cancellation", async () => {
  const db = database("completed")
  db.beforeOrderWrite(() => { db.order.status = "cancelled" })
  await expect(persistCheckoutRecords({ ...params(db, "send"), processedLines: [{ ...line, quantity: 2 }] }))
    .rejects.toThrow("Order")
  expect(db.order.status).toBe("cancelled")
})

it("retains explicit ordinary POS completion instead of omitting a real transition", async () => {
  const db = database()
  const result = await persistCheckoutRecords(params(db, "complete"))
  expect(result.order.status).toBe("completed")
  expect(db.writes.find(write => write.table === "sale_orders")!.filters.status).toBe("pending")
})