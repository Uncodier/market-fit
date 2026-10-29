"use client";

import { useCallback, useEffect, type MutableRefObject } from "react";
import { toast } from "sonner";
import { fetchPosOrder } from "@/app/pos/operation-client";
import { hasPosOrderCartSnapshot, posSessionFromOrder } from "@/app/pos/order-session";
import { getPosPermissionLease, requirePosPermission, isPosPermissionCurrent, type PosPermissionLease } from "../local/location-permission-state";

type Order = Parameters<typeof posSessionFromOrder>[0];

export function usePosOrderSelection({
  siteId,
  pendingOrders,
  sequence: sequenceRef,
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
    return () => { sequenceRef.current += 1; };
  }, [siteId, sequenceRef, setLoadingOrder]);

  const handleOrderSelect = useCallback(async (id: string, forceRefresh = false) => {
    const request = ++sequenceRef.current;
    const isCurrent = () => request === sequenceRef.current;
    setLoadingOrder(false);
    if (!id || id === "new") {
      await resetToNewOrder();
      return true;
    }
    if (!siteId) return false;
    const isEffectivelyOffline = () => !navigator.onLine || !!getPosPermissionLease(siteId)?.offline;

    // Never display or charge the previous ticket under the newly selected ID.
    clearOrderFields();
    setActiveOrderId(id);
    const cached = pendingOrders.find((order) => order?.id === id &&
      (!order.site_id || order.site_id === siteId));
    let offlineAttempted = false;
    const loadOffline = async () => {
      offlineAttempted = true;
      setLoadingOrder(true);
      const { readOfflineOrder } = await import("@/app/pos/local/read-offline-order");
      if (!isCurrent()) return false;
      const local = await readOfflineOrder(siteId, id, cached, isCurrent);
      if (!isCurrent()) return false;
      if (!hasPosOrderCartSnapshot(local) || !populateFromOrder(local, true)) {
        throw new Error("This order is not available on this device while offline.");
      }
      setActiveOrderId(id);
      return true;
    };
    try {
      // Connectivity takes precedence over pending/in-flight synchronization.
      if (isEffectivelyOffline()) return await loadOffline();
      const pending = id.startsWith("local_") || !!cached?.pending_sync;
      let resolvedId = id;
      let permission: PosPermissionLease | undefined;
      if (!pending && cached && !forceRefresh) {
        const complete = hasPosOrderCartSnapshot(cached);
        if (populateFromOrder(cached, complete) && complete) return true;
      }
      setLoadingOrder(true);
      if (pending) {
        permission = requirePosPermission(siteId);
        const { resolvePendingOrder } = await import("@/app/pos/local/resolve-pending-order");
        if (!isCurrent()) return false;
        if (isEffectivelyOffline()) return await loadOffline();
        resolvedId = await resolvePendingOrder(siteId, id, isCurrent);
        if (!isCurrent()) return false;
        if (isEffectivelyOffline()) return await loadOffline();
        if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed");
      }
      permission ??= requirePosPermission(siteId);
      const result = await fetchPosOrder(siteId, resolvedId);
      if (!isCurrent()) return false;
      if (isEffectivelyOffline()) return await loadOffline();
      if (permission && !isPosPermissionCurrent(permission)) throw new Error("POS access changed");
      if (result.error) throw new Error(result.error);
      if (result.data?.id !== resolvedId || (result.data?.site_id && result.data.site_id !== siteId) ||
        (result.data && "pending_sync" in result.data && result.data.pending_sync)) {
        throw new Error("The loaded order does not match the selected order.");
      }
      if (!hasPosOrderCartSnapshot(result.data) || !populateFromOrder(result.data, true)) {
        throw new Error("This order is no longer available for payment.");
      }
      setActiveOrderId(resolvedId);
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      if (isEffectivelyOffline() && !offlineAttempted) {
        try { return await loadOffline(); } catch (offlineError) { error = offlineError; }
        if (!isCurrent()) return false;
      }
      await resetToNewOrder();
      toast.error(error instanceof Error ? error.message : "Failed to load order");
      return false;
    } finally {
      // A late response must not clear a newer ticket's loading indicator.
      if (isCurrent()) setLoadingOrder(false);
    }
  }, [siteId, pendingOrders, sequenceRef, populateFromOrder, clearOrderFields,
    resetToNewOrder, setActiveOrderId, setLoadingOrder]);

  return { handleOrderSelect };
}