import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { OrderParams, OrdersResult } from "./types"
import {
  assertRead, CommerceReadError, readBatches, readFailure, searchValue, settledReads, uniqueIds, READ_DEADLINE_MS,
} from "./scoped-read"
import {
  ORDER_BASE_SELECT, ORDER_ITEM_SELECT, ORDER_SALE_SELECT, ORDER_LEAD_SELECT,
  type OrderBase, type OrderItem, type OrderSale, type OrderLead,
} from "./order-read-dto"

export async function queryOrders(params: OrderParams): Promise<OrdersResult> {
  const signal = AbortSignal.timeout(READ_DEADLINE_MS)
  try {
    const client = await createClient()
    const search = params.q?.trim()
    const unpaid = params.paymentStatus === "unpaid"
    const page = Math.max(1, Math.floor(Number(params.page) || 1))
    const pageSize = Math.min(100, Math.max(1, Math.floor(Number(params.pageSize) || 50)))
    // Empty embeds implement complete search without hydrating every item or
    // truncating search matches to a preliminary 5,000-row/URL-sized ID list.
    const select = ORDER_BASE_SELECT +
      (search ? ", matching_items:sale_order_items()" : "") +
      (unpaid ? ", sales!inner(amount_due)" : "")
    let query = client.from("sale_orders").select(select, { count: "exact" })
      .eq("site_id", params.siteId)
    if (search) {
      query = query.ilike("matching_items.name", `%${search}%`)
        .eq("matching_items.site_id", params.siteId)
        .or(`order_number.ilike.${searchValue(search)},matching_items.not.is.null`)
    }
    if (unpaid) query = query.gt("sales.amount_due", 0).eq("sales.site_id", params.siteId)
    if (params.status && params.status !== "all") {
      query = params.status.includes(",") ? query.in("status", params.status.split(",")) :
        query.eq("status", params.status)
    }
    if (params.locationId && params.locationId !== "all") query = query.eq("origin_location_id", params.locationId)
    if (params.startDate) query = query.gte("created_at", params.startDate)
    if (params.endDate) query = query.lte("created_at", params.endDate)
    query = query.order(params.sort === "updated_at" ? "updated_at" : "created_at", {
      ascending: params.sort === "oldest",
    }).order("id", { ascending: true })
    const from = (page - 1) * pageSize
    const result = await query.range(from, from + pageSize - 1).abortSignal(signal)
    const rows = (assertRead(result, signal) || []) as unknown as OrderBase[]
    if (!rows.length) return { data: [], count: result.count || 0 }
    const [items, sales] = await settledReads([
      readBatches<OrderItem>(client, params.siteId, "sale_order_items", ORDER_ITEM_SELECT,
        "sale_order_id", rows.map(row => row.id), signal),
      readBatches<OrderSale>(client, params.siteId, "sales", ORDER_SALE_SELECT,
        "id", uniqueIds(rows.map(row => row.sale_id)), signal),
    ] as const)
    const leads = await readBatches<OrderLead>(client, params.siteId, "leads", ORDER_LEAD_SELECT,
      "id", uniqueIds(sales.map(sale => sale.lead_id)), signal)
    const leadsById = new Map(leads.map(lead => [lead.id, lead]))
    const salesById = new Map(sales.map(sale => [sale.id, sale]))
    const itemsByOrder = new Map<string, OrderItem[]>()
    for (const item of items) {
      const group = itemsByOrder.get(item.sale_order_id) || []
      group.push(item)
      itemsByOrder.set(item.sale_order_id, group)
    }
    return {
      data: rows.map(row => {
        // Discard the filtering embed, including its limited unpaid projection.
        const base = { ...row } as OrderBase & {
          sales?: unknown; matching_items?: unknown
        }
        delete base.sales
        delete base.matching_items
        const sale = salesById.get(row.sale_id)
        const lead = sale?.lead_id ? leadsById.get(sale.lead_id) : null
        const customer = lead ? { id: lead.id, name: lead.name, email: lead.email } : null
        return { ...base, sales: sale ? { ...sale, leads: customer } : null,
          leads: customer, sale_order_items: itemsByOrder.get(row.id) || [] }
      }),
      count: result.count || 0,
    }
  } catch (error) {
    return readFailure(signal.aborted ? new CommerceReadError("READ_TIMEOUT", error) : error)
  }
}