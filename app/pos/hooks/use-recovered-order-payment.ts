"use client";

import { useEffect, useRef, useState } from "react";

/** Open the normal payment flow only after the refreshed order has rendered. */
export function useRecoveredOrderPayment({ siteId, activeOrderId, ready, loadOrder, initiateCheckout }: {
  siteId?: string;
  activeOrderId: string;
  ready: boolean;
  loadOrder: (id: string, forceRefresh: boolean) => Promise<boolean>;
  initiateCheckout: () => void;
}) {
  const [target, setTarget] = useState<{ siteId: string; orderId: string } | null>(null);
  const scope = useRef({ siteId, active: true });
  useEffect(() => {
    const session = { siteId, active: true };
    scope.current = session;
    return () => { session.active = false; };
  }, [siteId]);
  useEffect(() => {
    if (!target) return;
    let active = true;
    // Wait for the committed selection; a superseding render cancels this callback.
    queueMicrotask(() => {
      if (!active) return;
      if (target.siteId !== siteId || target.orderId !== activeOrderId) {
        setTarget(null);
        return;
      }
      if (!ready) return;
      setTarget(null);
      initiateCheckout();
    });
    return () => { active = false; };
  }, [target, siteId, activeOrderId, ready, initiateCheckout]);
  return async (orderId: string) => {
    const session = scope.current;
    if (!siteId || session.siteId !== siteId || !session.active) return false;
    const loaded = await loadOrder(orderId, true);
    if (!loaded || !session.active) return false;
    setTarget({ siteId, orderId });
    return true;
  };
}