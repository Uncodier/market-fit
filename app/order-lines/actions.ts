"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  isOrderLineActionStatus,
  isOrderLineFilter,
  nextOrderLineStatus,
  orderLineStatusesForFilter,
  type OrderLineActionStatus,
} from "./status"
import type {
  OrderLineParams,
  OrderLineRow,
  OrderLinesResult,
} from "./types"
import { groupOrderLineModifiers } from "./modifiers"
import { readCachedOrderLines } from "./list-order-lines-cache"
import { bumpCacheEpoch } from "@/lib/redis/json-cache"
import {
  mapOrderLine,
  relatedOne,
  type RawShipment,
} from "./order-line-mapper"

async function findMatchingLineIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
  searchQuery: string,
): Promise<string[]> {
  const searchPattern = `%${searchQuery}%`
  const [itemMatches, orderMatches] = await Promise.all([
    supabase
      .from("sale_order_items")
      .select("id")
      .eq("site_id", siteId)
      .is("parent_sale_order_item_id", null)
      .ilike("name", searchPattern)
      .limit(5000),
    supabase
      .from("sale_orders")
      .select("id")
      .eq("site_id", siteId)
      .ilike("order_number", searchPattern)
      .limit(5000),
  ])

  if (itemMatches.error) throw new Error(itemMatches.error.message)
  if (orderMatches.error) throw new Error(orderMatches.error.message)

  const orderIds = (orderMatches.data || []).map(
    (order: { id: string }) => order.id,
  )
  let orderLineMatches: Array<{ id: string }> = []

  if (orderIds.length > 0) {
    const result = await supabase
      .from("sale_order_items")
      .select("id")
      .eq("site_id", siteId)
      .is("parent_sale_order_item_id", null)
      .in("sale_order_id", orderIds)
      .limit(5000)

    if (result.error) throw new Error(result.error.message)
    orderLineMatches = result.data || []
  }

  return [
    ...new Set([
      ...(itemMatches.data || []).map((line: { id: string }) => line.id),
      ...orderLineMatches.map((line) => line.id),
    ]),
  ]
}

async function queryOrderLines(
  params: OrderLineParams,
): Promise<OrderLinesResult> {
  try {
    const supabase = await createClient()
    const page = Math.max(1, Number(params.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 50))
    const searchQuery = params.q?.trim()
    const status =
      params.status && isOrderLineFilter(params.status)
        ? params.status
        : "all"
    const matchingLineIds = searchQuery
      ? await findMatchingLineIds(supabase, params.siteId, searchQuery)
      : null

    if (matchingLineIds?.length === 0) {
      return { data: [], count: 0 }
    }

    let query = supabase
      .from("sale_order_item_units")
      .select(
        `
          id,
          sale_order_item_id,
          unit_index,
          quantity,
          status,
          assigned_to,
          shipment_id,
          started_at,
          in_progress_at,
          ready_at,
          completed_at,
          delivered_at,
          created_at,
          sale_order_items!inner (
            id,
            sale_order_id,
            site_id,
            catalog_item_id,
            name,
            description,
            quantity,
            unit_price,
            metadata,
            parent_sale_order_item_id,
            sale_orders!inner (
              id,
              order_number,
              status,
              fulfillment_method,
              scheduled_for,
              origin_location_id,
              created_at,
              updated_at,
              sales (
                source,
                leads (id, name, email)
              )
            )
          )
        `,
        { count: "exact" },
      )
      .eq("site_id", params.siteId)
      .eq("sale_order_items.site_id", params.siteId)
      .is("sale_order_items.parent_sale_order_item_id", null)

    const statuses = orderLineStatusesForFilter(status)
    if (statuses) query = query.in("status", statuses)
    if (params.locationId && params.locationId !== "all") {
      query = query.eq(
        "sale_order_items.sale_orders.origin_location_id",
        params.locationId,
      )
    }
    if (matchingLineIds) {
      query = query.in("sale_order_item_id", matchingLineIds)
    }
    if (params.startDate) query = query.gte("created_at", params.startDate)
    if (params.endDate) query = query.lte("created_at", params.endDate)

    query = query
      .order("created_at", {
        ascending: params.sort === "oldest",
      })
      .order("sale_order_item_id", { ascending: true })
      .order("unit_index", { ascending: true })

    const from = (page - 1) * pageSize
    const { data, count, error } = await query.range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const rows = (data || []) as any[]
    const orderIds = [
      ...new Set(
        rows
          .map((line: any) => relatedOne<any>(line.sale_order_items)?.sale_order_id)
          .filter(Boolean),
      ),
    ] as string[]
    let modifiersByItemId = new Map<string, OrderLineRow["modifiers"]>()
    if (orderIds.length > 0) {
      const { data: orderItems, error: modifiersError } = await supabase
        .from("sale_order_items")
        .select("id, parent_sale_order_item_id, name, description, quantity, metadata")
        .eq("site_id", params.siteId)
        .in("sale_order_id", orderIds)
      if (modifiersError) throw new Error(modifiersError.message)
      modifiersByItemId = groupOrderLineModifiers(orderItems || [])
    }
    const shipmentIds = [
      ...new Set(
        rows
          .map((line: any): unknown => line.shipment_id)
          .filter(
            (id: unknown): id is string =>
              typeof id === "string" && id.length > 0,
          ),
      ),
    ]
    const shipmentsById = new Map<string, RawShipment>()

    if (shipmentIds.length > 0) {
      const { data: shipments, error: shipmentsError } = await supabase
        .from("shipments")
        .select(
          "id, status, created_at, updated_at, shipped_at, delivered_at, estimated_delivery_at",
        )
        .eq("site_id", params.siteId)
        .in("id", shipmentIds)

      if (shipmentsError) throw new Error(shipmentsError.message)
      for (const shipment of (shipments || []) as RawShipment[]) {
        shipmentsById.set(shipment.id, shipment)
      }
    }

    return {
      data: rows
        .map((line: any) =>
          mapOrderLine(line, shipmentsById, modifiersByItemId),
        )
        .filter((line): line is OrderLineRow => Boolean(line)),
      count: count || 0,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load order lines"
    console.error("Error in listOrderLines:", error)
    return { data: [], count: 0, error: message }
  }
}

export async function listOrderLines(
  params: OrderLineParams,
): Promise<OrderLinesResult> {
  return readCachedOrderLines(params, () => queryOrderLines(params))
}

const MAX_BULK_ORDER_LINES = 100

type OperationalLineRecord = {
  id: string
  saleOrderId: string
  status: string
}

function normalizeLineIds(lineIds: string[]): string[] {
  const normalized = [
    ...new Set(
      lineIds.filter(
        (lineId) => typeof lineId === "string" && lineId.trim().length > 0,
      ),
    ),
  ]
  if (normalized.length === 0) throw new Error("No order lines selected")
  if (normalized.length > MAX_BULK_ORDER_LINES) {
    throw new Error(`Select up to ${MAX_BULK_ORDER_LINES} order lines`)
  }
  return normalized
}

async function loadOperationalLines(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
  lineIds: string[],
): Promise<OperationalLineRecord[]> {
  const { data, error } = await supabase
    .from("sale_order_item_units")
    .select(
      `
        id,
        sale_order_item_id,
        status,
        sale_order_items!inner (sale_order_id)
      `,
    )
    .eq("site_id", siteId)
    .in("id", lineIds)

  if (error) throw new Error(error.message)
  if ((data || []).length !== lineIds.length) {
    throw new Error("One or more order lines were not found")
  }
  return (data || []).map((row: any) => {
    const item = relatedOne<any>(row.sale_order_items)
    if (!item) throw new Error("Order line item not found")
    return {
      id: row.id,
      saleOrderId: item.sale_order_id,
      status: row.status,
    }
  })
}

async function revalidateOrderLineViews(siteId: string, orderIds: string[]) {
  await bumpCacheEpoch("order-data", siteId)
  revalidatePath("/order-lines")
  revalidatePath("/orders")
  for (const orderId of new Set(orderIds)) {
    revalidatePath(`/orders/${orderId}`)
  }
}

export async function updateOperationalOrderLineStatus(
  siteId: string,
  lineId: string,
  status: OrderLineActionStatus,
) {
  try {
    if (!isOrderLineActionStatus(status)) {
      return { error: "Invalid order line status" }
    }

    const supabase = await createClient()
    const [current] = await loadOperationalLines(supabase, siteId, [lineId])
    if (
      status !== "cancelled" &&
      nextOrderLineStatus(current.status) !== status
    ) {
      return { error: "Order lines can only move to their next status" }
    }

    const operation = status === "cancelled" ? "cancel" : "set_status"
    const { data: updatedCount, error } = await supabase.rpc(
      "mutate_sale_order_item_units",
      {
        p_site_id: siteId,
        p_unit_ids: [lineId],
        p_operation: operation,
        p_assignee_id: null,
        p_status: status === "cancelled" ? null : status,
      },
    )

    if (error) throw new Error(error.message)
    if (updatedCount !== 1) throw new Error("Order line was not updated")

    await revalidateOrderLineViews(siteId, [current.saleOrderId])
    return { data: { id: lineId, status } }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update order line"
    console.error("Error in updateOperationalOrderLineStatus:", error)
    return { error: message }
  }
}

export async function advanceOperationalOrderLines(
  siteId: string,
  lineIds: string[],
) {
  try {
    const ids = normalizeLineIds(lineIds)
    const supabase = await createClient()
    const lines = await loadOperationalLines(supabase, siteId, ids)
    const transitions = Object.fromEntries(
      lines.flatMap((line) => {
        const status = nextOrderLineStatus(line.status)
        return status ? [[line.id, status]] : []
      }),
    )
    const actionableIds = Object.keys(transitions)
    if (actionableIds.length === 0) return { count: 0 }
    const { data: updatedCount, error } = await supabase.rpc(
      "mutate_sale_order_item_units",
      {
        p_site_id: siteId,
        p_unit_ids: actionableIds,
        p_operation: "advance",
        p_assignee_id: null,
        p_status: JSON.stringify(transitions),
      },
    )
    if (error) throw new Error(error.message)

    await revalidateOrderLineViews(
      siteId,
      lines.map((line) => line.saleOrderId),
    )
    return { count: Number(updatedCount) || 0 }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update order lines"
    console.error("Error in advanceOperationalOrderLines:", error)
    return { error: message }
  }
}

export async function assignOperationalOrderLines(
  siteId: string,
  lineIds: string[],
  assigneeId: string | null,
) {
  try {
    const ids = normalizeLineIds(lineIds)
    const normalizedAssignee =
      typeof assigneeId === "string" && assigneeId.trim()
        ? assigneeId.trim()
        : null
    const supabase = await createClient()
    const lines = await loadOperationalLines(supabase, siteId, ids)

    const { data: updatedCount, error } = await supabase.rpc(
      "mutate_sale_order_item_units",
      {
        p_site_id: siteId,
        p_unit_ids: ids,
        p_operation: "assign",
        p_assignee_id: normalizedAssignee,
        p_status: null,
      },
    )

    if (error) throw new Error(error.message)
    if (Number(updatedCount) !== ids.length) {
      throw new Error("One or more order lines were not assigned")
    }
    await revalidateOrderLineViews(
      siteId,
      lines.map((line) => line.saleOrderId),
    )
    return { count: ids.length, assigneeId: normalizedAssignee }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to assign order lines"
    console.error("Error in assignOperationalOrderLines:", error)
    return { error: message }
  }
}
