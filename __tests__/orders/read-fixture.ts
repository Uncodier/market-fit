type Row = Record<string, unknown>
type Method = "eq" | "in" | "is" | "gt" | "gte" | "lte" | "ilike" | "or" | "order" | "range"
type Query = {
  select: (select: string, options?: { count: string }) => Query;
  abortSignal: (signal: AbortSignal) => Query;
  then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise<unknown>;
} & Record<Method, (...args: unknown[]) => Query>
export type Call = { table: string; select: string; count?: string; ops: Array<[string, ...unknown[]]>; signal?: AbortSignal }

/** Offline relational fixture: checks scope/search before count and range. */
export function readFixture(tables: Record<string, Row[]>) {
  const calls: Call[] = []
  const hidden = new Set<string>()
  const failures = new Map<string, unknown>()
  let wait: ((call: Call) => Promise<void>) | undefined
  const client = { from(table: string) {
    const call: Call = { table, select: "", ops: [] }
    calls.push(call)
    const query = {} as Query
    query.select = (select: string, options?: { count: string }) => {
      call.select = select; call.count = options?.count; return query
    }
    for (const method of ["eq", "in", "is", "gt", "gte", "lte", "ilike", "or", "order", "range"] as Method[]) {
      query[method] = (...args: unknown[]) => { call.ops.push([method, ...args]); return query }
    }
    query.abortSignal = (signal: AbortSignal) => { call.signal = signal; return query }
    query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
      return execute().then(resolve, reject)
    }
    async function execute() {
      if (wait) await wait(call)
      if (failures.has(table)) return { data: null, count: null, error: failures.get(table) }
      const visible = (name: string) => (tables[name] || []).filter(row => !hidden.has(String(row.id)))
      const site = call.ops.find(op => op[0] === "eq" && op[1] === "site_id")?.[2]
      const itemFor = (unit: Row) => visible("sale_order_items").find(item => item.id === unit.sale_order_item_id && item.site_id === site)
      const orderFor = (unit: Row) => visible("sale_orders").find(order => order.id === itemFor(unit)?.sale_order_id && order.site_id === site)
      const saleFor = (order: Row) => visible("sales").find(sale => sale.id === order.sale_id && sale.site_id === site)
      const value = (row: Row, path: string): unknown => {
        if (path === "sales.amount_due") return saleFor(row)?.amount_due
        if (path.startsWith("sale_order_items.sale_orders.")) return orderFor(row)?.[path.split(".").at(-1)!]
        if (path.startsWith("sale_order_items.")) return itemFor(row)?.[path.split(".").at(-1)!]
        return row[path]
      }
      let rows = visible(table)
      if (table === "sale_order_item_units") rows = rows.filter(row => itemFor(row) && orderFor(row))
      for (const [op, key, expected] of call.ops) {
        const path = String(key)
        if (["order", "range", "ilike", "or"].includes(op) || path.startsWith("matching_") || path.includes("matching_order") || path === "sales.site_id") continue
        rows = rows.filter(row => {
          const actual = value(row, path)
          if (op === "eq" || op === "is") return actual === expected
          if (op === "in") return (expected as unknown[]).includes(actual)
          if (op === "gt") return Number(actual) > Number(expected)
          if (op === "gte") return String(actual) >= String(expected)
          if (op === "lte") return String(actual) <= String(expected)
          return true
        })
      }
      const searchPattern = call.ops.find(op => op[0] === "ilike")?.[2]
      const search = typeof searchPattern === "string" ? searchPattern.slice(1, -1).toLowerCase() : null
      if (search) rows = rows.filter(row => table === "sale_orders" ?
        String(row.order_number).toLowerCase().includes(search) || visible("sale_order_items").some(item => item.site_id === site && item.sale_order_id === row.id && String(item.name).toLowerCase().includes(search)) :
        String(itemFor(row)?.name).toLowerCase().includes(search) || String(orderFor(row)?.order_number).toLowerCase().includes(search))
      const count = rows.length
      const ordering = call.ops.filter(op => op[0] === "order")
      rows = [...rows].sort((a, b) => {
        for (const [, key, options] of ordering) {
          const field = String(key)
          if (a[field] === b[field]) continue
          return (String(a[field]) < String(b[field]) ? -1 : 1) * ((options as { ascending: boolean }).ascending ? 1 : -1)
        }
        return 0
      })
      const range = call.ops.find(op => op[0] === "range")
      if (range) rows = rows.slice(Number(range[1]), Number(range[2]) + 1)
      return { data: rows.map(row => table === "sale_order_item_units" ?
        { ...row, sale_order_items: { sale_order_id: itemFor(row)!.sale_order_id } } : { ...row }), count, error: null }
    }
    return query
  } }
  return { client, calls, hidden, failures, setWait(fn: typeof wait) { wait = fn } }
}

export function commerceTables() {
  const sale_orders = Array.from({ length: 8 }, (_, i) => ({
    id: `order-${i}`, site_id: i === 7 ? "other" : "site", sale_id: `sale-${i}`,
    order_number: i === 4 ? "MATCH-4" : `ORD-${i}`, status: i === 5 ? "draft" : "pending",
    created_at: `2026-01-0${i + 1}`, updated_at: `2026-01-0${i + 1}`,
    origin_location_id: i === 6 ? "hidden-location" : "location", items: [],
    metadata: { marketplace: { provider: "synthetic" } }, total: 12, fulfillment_method: "pickup",
    shipping_address: { city: "Test" }, scheduled_for: "2026-01-09",
  }))
  const sale_order_items = sale_orders.map((order, i) => ({
    id: `item-${i}`, site_id: order.site_id, sale_order_id: order.id, name: i === 2 ? "Matching product" : "Product",
    description: "Description", quantity: 2, unit_price: 6, metadata: {}, parent_sale_order_item_id: null,
  }))
  const sales = sale_orders.map((order, i) => ({
    id: order.sale_id, site_id: order.site_id, lead_id: `lead-${i}`, amount_due: i % 2 ? 0 : 12,
    status: "pending", source: "pos", amount: 12, payment_method: "cash", payments: [],
  }))
  const leads = sales.map((sale, i) => ({ id: sale.lead_id, site_id: sale.site_id, name: `Customer ${i}`, email: "customer@example.test" }))
  const sale_order_item_units = sale_order_items.map((item, i) => ({
    id: `unit-${i}`, site_id: item.site_id, sale_order_item_id: item.id,
    status: "pending", created_at: sale_orders[i].created_at, unit_index: 1, quantity: 1,
    shipment_id: i === 2 ? "shipment" : null, assigned_to: "worker", started_at: "2026-01-01",
  }))
  return { sale_orders, sale_order_items, sales, leads, sale_order_item_units, shipments: [
    { id: "shipment", site_id: "site", status: "delivered", created_at: "2026-01-01", updated_at: "2026-01-03", delivered_at: "2026-01-03" },
  ] }
}