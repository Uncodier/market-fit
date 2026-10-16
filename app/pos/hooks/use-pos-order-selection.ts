"use client";

import { useCallback, useEffect, type MutableRefObject } from "react";
import { toast } from "sonner";
import { getPosOrder } from "@/app/pos/actions/get-order";
import { hasPosOrderCartSnapshot, posSessionFromOrder } from "@/app/pos/order-session";

type Order = Parameters<typeof posSessionFromOrder>[0];

export function usePosOrderSelection({
  siteId,
  pendingOrders,
  sequence,
  populateFromOrder,
  clearOrderFields,
  resetToNewOrder,
  setActiveOrderId,
  setLoadingOrder,
}: {
  siteId?: string;
  pendingOrders: Order[];
  sequence: MutableRefObject<number>;
  populateFromOrder: (order: Order, includeCart: boolean) => boolean;
  clearOrderFields: () => void;
  resetToNewOrder: () => Promise<void>;
  setActiveOrderId: (id: string) => void;
  setLoadingOrder: (loading: boolean) => void;
}) {
  useEffect(() => {
    setLoadingOrder(false);
    return () => { sequence.current += 1; };
  }, [siteId, sequence, setLoadingOrder]);

  const handleOrderSelect = useCallback(async (id: string, forceRefresh = false) => {
    const request = ++sequence.current;
    const isCurrent = () => request === sequence.current;
    setLoadingOrder(false);
    if (!id || id === "new") {
      await resetToNewOrder();
      return true;
    }
    if (!siteId) return false;

    // Never display or charge the previous ticket under the newly selected ID.
    clearOrderFields();
    setActiveOrderId(id);
    const cached = pendingOrders.find((order) => order?.id === id &&
      (!order.site_id || order.site_id === siteId));
    try {
      if (cached?.pending_sync) {
        throw new Error("Wait for this order to sync before taking another payment.");
      }
      if (cached && !forceRefresh) {
        const complete = hasPosOrderCartSnapshot(cached);
        if (populateFromOrder(cached, complete) && complete) return true;
      }
      setLoadingOrder(true);
      if (!forceRefresh && (id.startsWith("local_") || !navigator.onLine)) {
        const { readLocalPendingOrders } = await import("@/app/pos/local/snapshot-pull");
        const orders = await readLocalPendingOrders(siteId);
        if (!isCurrent()) return false;
        const local = orders.find((order) => order.id === id)?.raw;
        if (local?.pending_sync) throw new Error("Wait for this order to sync before taking another payment.");
        if (hasPosOrderCartSnapshot(local) && populateFromOrder(local, true)) return true;
        if (id.startsWith("local_")) throw new Error("This order is still syncing. Please try again after sync.");
      }
      const result = await getPosOrder(siteId, id);
      if (!isCurrent()) return false;
      if (result.error) throw new Error(result.error);
      if (!hasPosOrderCartSnapshot(result.data) || !populateFromOrder(result.data, true)) {
        throw new Error("This order is no longer available for payment.");
      }
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      await resetToNewOrder();
      toast.error(error instanceof Error ? error.message : "Failed to load order");
      return false;
    } finally {
      // A late response must not clear a newer ticket's loading indicator.
      if (isCurrent()) setLoadingOrder(false);
    }
  }, [siteId, pendingOrders, sequence, populateFromOrder, clearOrderFields,
    resetToNewOrder, setActiveOrderId, setLoadingOrder]);

  return { handleOrderSelect };
}