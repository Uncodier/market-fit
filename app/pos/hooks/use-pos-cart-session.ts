"use client";

import { useEffect, useState, type MutableRefObject } from "react";
import { toast } from "sonner";
import { loadCartSession, saveCartSession } from "@/app/pos/local/cart-session";
import type { PosCartSession } from "@/app/pos/local/types";

export function usePosCartSession({
  siteId, snapshot, loadingOrder, sequence, onRestore,
}: {
  siteId?: string;
  snapshot: Omit<PosCartSession, "siteId" | "updatedAt">;
  loadingOrder: boolean;
  sequence: MutableRefObject<number>;
  onRestore: (session: PosCartSession) => void;
}) {
  const [loadedSiteId, setLoadedSiteId] = useState<string>();
  const sessionReady = !!siteId && loadedSiteId === siteId;

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    const version = sequence.current;
    void loadCartSession(siteId).then((session) => {
      if (cancelled) return;
      if (version === sequence.current) onRestore(session);
      setLoadedSiteId(siteId);
    }).catch(() => {
      if (!cancelled) toast.error("Unable to restore the POS session. Please reload.");
    });
    return () => { cancelled = true; };
  }, [siteId, sequence, onRestore]);

  useEffect(() => {
    if (!siteId || !sessionReady || loadingOrder) return;
    const timer = window.setTimeout(() => {
      void saveCartSession({ ...snapshot, siteId }).catch(() => {
        toast.error("Unable to save the POS session on this device.");
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [siteId, sessionReady, loadingOrder, snapshot]);

  return sessionReady;
}