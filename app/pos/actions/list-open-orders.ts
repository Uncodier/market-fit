"use server";

import {
  OPEN_ORDER_STATUSES,
  selectOrdersLinkedToUnpaidSales,
  type PosSaleRow,
} from "@/app/pos/list-open-orders";
import {
  POS_ORDER_SNAPSHOT_SELECT,
  POS_SALE_SNAPSHOT_SELECT,
  type PosOrderSnapshot,
} from "@/app/pos/order-snapshot";
import { enrichPosOrderSellers } from "@/app/pos/order-seller";
import { hashRedisKeyPart } from "@/lib/redis/control-plane";
import { readThroughJsonCache } from "@/lib/redis/json-cache";
import { requirePosSiteAccess } from "./site-access";

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
  try {
    const access = await requirePosSiteAccess(siteId);
    if ("error" in access) return { data: [], error: access.error };
    const cacheIdentity = await hashRedisKeyPart(`${siteId}:${access.role}:${access.user.id}`);

    const cached = await readThroughJsonCache({
      key: `cache:v3:pos-open-orders:${cacheIdentity}`,
      ttlSeconds: 5,
      lockTtlMs: 10_000,
      compute: async () => {
        const { data: orders, error: ordersError } = await access.supabase
          .from("sale_orders")
          .select(POS_ORDER_SNAPSHOT_SELECT)
          .eq("site_id", siteId)
          .in("status", [...OPEN_ORDER_STATUSES])
          .order("created_at", { ascending: false })
          .limit(OPEN_ORDER_LIMIT);

        if (ordersError) throw new Error(ordersError.message);

        const openOrders = (orders || []) as Array<Omit<PosOrderSnapshot, "sales" | "leads">>;
        const saleIds = [
          ...new Set(
            openOrders
              .map((order: { sale_id?: string | null }) => order.sale_id)
              .filter((id: string | null | undefined): id is string => !!id),
          ),
        ];
        if (saleIds.length === 0) return [];

        const [{ data: sales, error: salesError }, enrichedOrders] = await Promise.all([
          access.supabase
            .from("sales")
            .select(POS_SALE_SNAPSHOT_SELECT)
            .eq("site_id", siteId)
            .in("id", saleIds),
          enrichPosOrderSellers(access.supabase, siteId, openOrders),
        ]);

        if (salesError) throw new Error(salesError.message);

        return selectOrdersLinkedToUnpaidSales(
          enrichedOrders,
          (sales || []) as PosSaleRow[],
        );
      },
    });

    if (cached.status === "busy") {
      return { data: [], error: "Open orders are being refreshed" };
    }
    return { data: cached.value };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list open POS orders";
    console.error("Error listing open POS orders:", error);
    return { data: [], error: message };
  }
}
