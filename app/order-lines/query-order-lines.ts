import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { OrderLineParams, OrderLineRow, OrderLinesResult } from "./types"
import { isOrderLineFilter, orderLineStatusesForFilter } from "./status"
import { groupOrderLineModifiers } from "./modifiers"
import { mapOrderLine, relatedOne, type RawShipment } from "./order-line-mapper"
import {
  assertRead, CommerceReadError, readBatches, readFailure, READ_DEADLINE_MS,
  searchValue, settledReads, uniqueIds,
} from "../orders/scoped-read"
import {
  ORDER_LEAD_SELECT, type OrderLead, type OrderSale,
} from "../orders/order-read-dto"
import {
  UNIT_BASE_SELECT, LINE_ITEM_SELECT, LINE_ORDER_SELECT, LINE_SHIPMENT_SELECT,
  type UnitBase, type LineItem, type LineOrder,
} from "./order-line-read-dto"

type FilterItem = { sale_order_id: string }
type UnitPage = UnitBase & { sale_order_items: FilterItem | FilterItem[] }
type LineSale = Pick<OrderSale, "id" | "site_id" | "lead_id" | "source">

export async function queryOrderLines(params: OrderLineParams): Promise<OrderLinesResult> {
  const signal = AbortSignal.timeout(READ_DEADLINE_MS)
  try {
    const client = await createClient()
    const page = Math.max(1, Math.floor(Number(params.page) || 1))
    const pageSize = Math.min(100, Math.max(1, Math.floor(Number(params.pageSize) || 50)))
    const search = params.q?.trim()
    const status = params.status && isOrderLineFilter(params.status) ? params.status : "all"
    let query = client.from("sale_order_item_units").select(`
      ${UNIT_BASE_SELECT}, sale_order_items!inner (
        sale_order_id, sale_orders!inner(id)
        ${search ? ", matching_order:sale_orders()" : ""}
      )`, { count: "exact" })
      .eq("site_id", params.siteId).eq("sale_order_items.site_id", params.siteId)
      .eq("sale_order_items.sale_orders.site_id", params.siteId)
      .is("sale_order_items.parent_sale_order_item_id", null)
    const statuses = orderLineStatusesForFilter(status)
    if (statuses) query = query.in("status", statuses)
    if (params.locationId && params.locationId !== "all") {
      query = query.eq("sale_order_items.sale_orders.origin_location_id", params.locationId)
    }
    if (search) {
      query = query.ilike("sale_order_items.matching_order.order_number", `%${search}%`)
        .eq("sale_order_items.matching_order.site_id", params.siteId)
        .or(`name.ilike.${searchValue(search)},matching_order.not.is.null`, { referencedTable: "sale_order_items" })
    }
    if (params.startDate) query = query.gte("created_at", params.startDate)
    if (params.endDate) query = query.lte("created_at", params.endDate)
    query = query.order("created_at", { ascending: params.sort === "oldest" })
      .order("sale_order_item_id", { ascending: true }).order("unit_index", { ascending: true })
      .order("id", { ascending: true })
    const from = (page - 1) * pageSize
    const result = await query.range(from, from + pageSize - 1).abortSignal(signal)
    const units = (assertRead(result, signal) || []) as unknown as UnitPage[]
    if (!units.length) return { data: [], count: result.count || 0 }
    const orderIds = uniqueIds(units.map(unit => relatedOne(unit.sale_order_items)?.sale_order_id))
    const [items, orders, shipments] = await settledReads([
      readBatches<LineItem>(client, params.siteId, "sale_order_items", LINE_ITEM_SELECT,
        "sale_order_id", orderIds, signal),
      readBatches<LineOrder>(client, params.siteId, "sale_orders", LINE_ORDER_SELECT,
        "id", orderIds, signal),
      readBatches<RawShipment>(client, params.siteId, "shipments", LINE_SHIPMENT_SELECT,
        "id", uniqueIds(units.map(unit => unit.shipment_id)), signal),
    ] as const)
    const sales = await readBatches<LineSale>(client, params.siteId, "sales", "id, site_id, lead_id, source",
      "id", uniqueIds(orders.map(order => order.sale_id)), signal)
    const leads = await readBatches<OrderLead>(client, params.siteId, "leads", ORDER_LEAD_SELECT,
      "id", uniqueIds(sales.map(sale => sale.lead_id)), signal)
    const itemsById = new Map(items.map(item => [item.id, item]))
    const ordersById = new Map(orders.map(order => [order.id, order]))
    const salesById = new Map(sales.map(sale => [sale.id, sale]))
    const leadsById = new Map(leads.map(lead => [lead.id, lead]))
    const shipmentsById = new Map(shipments.map(shipment => [shipment.id, shipment]))
    const modifiers = groupOrderLineModifiers(items)
    const data: OrderLineRow[] = units.map(unit => {
      const item = itemsById.get(unit.sale_order_item_id)
      const order = item ? ordersById.get(item.sale_order_id) : null
      // Never silently drop missing/now-hidden relations after pagination: the
      // page/count came from one RLS snapshot, so a concurrent change is an error.
      if (!item || !order) throw new CommerceReadError("READ_CHANGED")
      const sale = salesById.get(order.sale_id)
      const lead = sale?.lead_id ? leadsById.get(sale.lead_id) || null : null
      const row = mapOrderLine({ ...unit, sale_order_items: { ...item,
        sale_orders: { ...order, sales: sale ? { ...sale, leads: lead } : null },
      } }, shipmentsById, modifiers)
      if (!row) throw new CommerceReadError("READ_CHANGED")
      return row
    })
    return { data, count: result.count || 0 }
  } catch (error) {
    return readFailure(signal.aborted ? new CommerceReadError("READ_TIMEOUT", error) : error)
  }
}