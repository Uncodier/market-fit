"use client";

import { useCallback, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { getPosDb } from "@/app/pos/local/db";
import { enqueueOrderNotesUpdate } from "@/app/pos/local/outbox";
import { getPosPermissionLease, isPosPermissionCurrent } from "../local/location-permission-state";
import {
  drainPosOutbox,
  refreshPosSyncCounts,
} from "@/app/pos/local/sync-engine";

const NOTES_SAVE_DELAY_MS = 500;

async function updateCachedOrderNotes(
  siteId: string,
  orderId: string,
  notes: string,
) {
  const db = getPosDb();
  const order = await db.pendingOrders.get(orderId);
  if (!order || order.site_id !== siteId) return;
  await db.pendingOrders.update(orderId, {
    raw: { ...order.raw, notes },
  });
}

export function usePosOrderNotesAutosave(siteId?: string) {
  const timers = useRef(new Map<string, number>());
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
      pending.clear();
    };
  }, [siteId]);

  return useCallback(
    (orderId: string, notes: string) => {
      if (!siteId || !orderId || orderId === "new") return;
      const permission = getPosPermissionLease(siteId);
      if (!permission) return;

      const previousTimer = timers.current.get(orderId);
      if (previousTimer) window.clearTimeout(previousTimer);

      const timer = window.setTimeout(async () => {
        timers.current.delete(orderId);
        try {
          if (!isPosPermissionCurrent(permission)) return;
          await updateCachedOrderNotes(siteId, orderId, notes);
          if (!isPosPermissionCurrent(permission)) return;
          await enqueueOrderNotesUpdate(siteId, {
            siteId,
            orderId,
            notes,
            clientMutationId: uuidv4(),
          });
          await refreshPosSyncCounts(siteId);
          if (isPosPermissionCurrent(permission)) void drainPosOutbox(siteId);
        } catch (error) {
          console.error("Failed to save POS order notes:", error);
        }
      }, NOTES_SAVE_DELAY_MS);

      timers.current.set(orderId, timer);
    },
    [siteId],
  );
}
