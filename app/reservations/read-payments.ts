import { readIdBatches, READ_PAGE_SIZE, type ReadBudget } from "./read-pages"

type Payment = { sale_order_id: string | null; amount: number | null; amount_due: number | null }
type Reader = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>

export async function readReservationPayments(db: Reader, siteId: string, itemIds: string[], budget: ReadBudget) {
  const items = await readIdBatches<{ id: string; sale_order_id: string | null }>(itemIds,
    (ids, offset, signal) => db.from("sale_order_items").select("id, sale_order_id")
      .eq("site_id", siteId).in("id", ids).order("id").range(offset, offset + READ_PAGE_SIZE - 1).abortSignal(signal), budget)
  const orderIds = [...new Set(items.flatMap(item => item.sale_order_id ? [item.sale_order_id] : []))]
  const orders = await readIdBatches<{ id: string; sale_id: string | null }>(orderIds,
    (ids, offset, signal) => db.from("sale_orders").select("id, sale_id")
      .eq("site_id", siteId).in("id", ids).order("id").range(offset, offset + READ_PAGE_SIZE - 1).abortSignal(signal), budget)
  const saleIds = [...new Set(orders.flatMap(order => order.sale_id ? [order.sale_id] : []))]
  const sales = await readIdBatches<{ id: string; amount: number | null; amount_due: number | null }>(saleIds,
    (ids, offset, signal) => db.from("sales").select("id, amount, amount_due")
      .eq("site_id", siteId).in("id", ids).order("id").range(offset, offset + READ_PAGE_SIZE - 1).abortSignal(signal), budget)
  const orderById = new Map(orders.map(order => [order.id, order]))
  const saleById = new Map(sales.map(sale => [sale.id, sale]))
  return new Map<string, Payment>(items.map(item => {
    const order = item.sale_order_id ? orderById.get(item.sale_order_id) : undefined
    const sale = order?.sale_id ? saleById.get(order.sale_id) : undefined
    return [item.id, { sale_order_id: item.sale_order_id, amount: sale?.amount ?? null, amount_due: sale?.amount_due ?? null }]
  }))
}