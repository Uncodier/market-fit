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
const OPEN_ORDERS_QUERY_TIMEOUT_MS = 8_000;

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
      key: `cache:v4:pos-open-orders:${cacheIdentity}`,
      ttlSeconds: 5,
      lockTtlMs: 10_000,
      compute: async () => {
        // Cancel the actual PostgREST fetches, not just the caller's wait. Keep
        // waiting for all fan-out work to settle before releasing the cache lock.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), OPEN_ORDERS_QUERY_TIMEOUT_MS);
        // The authorized, isolated demo fixture does not implement PostgREST cancellation.
        const signal = access.supabase._isDemo === true ? undefined : controller.signal;
        try {
          const ordersQuery = access.supabase
            .from("sale_orders")
            .select(POS_ORDER_SNAPSHOT_SELECT)
            .eq("site_id", siteId)
            .in("status", [...OPEN_ORDER_STATUSES])
            .order("created_at", { ascending: false })
            .limit(OPEN_ORDER_LIMIT);
          const { data: orders, error: ordersError } = await (signal ? ordersQuery.abortSignal(signal) : ordersQuery);

          if (controller.signal.aborted) throw new Error("Open orders query timed out");
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

          const salesQuery = access.supabase
            .from("sales")
            .select(POS_SALE_SNAPSHOT_SELECT)
            .eq("site_id", siteId)
            .in("id", saleIds);
          const [salesResult, sellersResult] = await Promise.allSettled([
            signal ? salesQuery.abortSignal(signal) : salesQuery,
            enrichPosOrderSellers(access.supabase, siteId, openOrders, signal),
          ]);

          if (controller.signal.aborted) throw new Error("Open orders query timed out");
          if (salesResult.status === "rejected") throw salesResult.reason;
          if (sellersResult.status === "rejected") throw sellersResult.reason;
          const { data: sales, error: salesError } = salesResult.value;
          if (salesError) throw new Error(salesError.message);

          return selectOrdersLinkedToUnpaidSales(
            sellersResult.value,
            (sales || []) as PosSaleRow[],
          );
        } catch (error) {
          if (controller.signal.aborted) throw new Error("Open orders query timed out");
          throw error;
        } finally {
          clearTimeout(timeout);
        }
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
