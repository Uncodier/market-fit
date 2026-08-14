"use server";

import { createClient } from "@/lib/supabase/server";
import {
  OPEN_ORDER_STATUSES,
  selectOrdersLinkedToUnpaidSales,
  type PosSaleRow,
} from "@/app/pos/list-open-orders";

const OPEN_ORDER_LIMIT = 100;

/**
 * Open POS tickets: pending / in progress / completed, but only when the
 * linked sale still has amount_due > 0.
 *
 * Starts from sale_orders (kitchen / tab tickets), then loads those sales and
 * drops any with amount_due <= 0. Filtering sales first is unreliable: the
 * newest unpaid sales are often shop/quote rows and can crowd out POS tickets.
 */
export async function listPosOpenOrders(siteId: string) {
  const supabase = await createClient();

  const { data: orders, error: ordersError } = await supabase
    .from("sale_orders")
    .select("*, sale_order_items (status)")
    .eq("site_id", siteId)
    .in("status", [...OPEN_ORDER_STATUSES])
    .order("created_at", { ascending: false })
    .limit(OPEN_ORDER_LIMIT);

  if (ordersError) {
    console.error("Error listing open POS orders:", ordersError);
    return { data: [], error: ordersError.message };
  }

  const openOrders = orders || [];
  const saleIds = [
    ...new Set(
      openOrders
        .map((order: { sale_id?: string | null }) => order.sale_id)
        .filter((id: string | null | undefined): id is string => !!id),
    ),
  ];
  if (saleIds.length === 0) return { data: [] };

  const { data: sales, error: salesError } = await supabase
    .from("sales")
    .select(
      "id, status, source, amount, payment_method, amount_due, payments, leads (id, name, email)",
    )
    .eq("site_id", siteId)
    .in("id", saleIds);

  if (salesError) {
    console.error("Error listing sales for open POS orders:", salesError);
    return { data: [], error: salesError.message };
  }

  return {
    data: selectOrdersLinkedToUnpaidSales(
      openOrders,
      (sales || []) as PosSaleRow[],
    ),
  };
}
