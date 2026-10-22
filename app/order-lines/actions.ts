"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  isOrderLineActionStatus,
  nextOrderLineStatus,
  type OrderLineActionStatus,
} from "./status"
import type {
  OrderLineParams,
  OrderLinesResult,
} from "./types"
import { queryOrderLines } from "./query-order-lines"
import { readCachedOrderLines } from "./list-order-lines-cache"
import { bumpCacheEpoch } from "@/lib/redis/json-cache"
import {
  relatedOne,
} from "./order-line-mapper"

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
  const rows = (data || []) as unknown as Array<{
    id: string; status: string;
    sale_order_items: { sale_order_id: string } | Array<{ sale_order_id: string }> | null;
  }>
  return rows.map((row) => {
    const item = relatedOne(row.sale_order_items)
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
