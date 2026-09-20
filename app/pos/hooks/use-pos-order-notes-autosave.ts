"use client";

import { useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { getPosDb } from "@/app/pos/local/db";
import { enqueueOrderNotesUpdate } from "@/app/pos/local/outbox";
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

  return useCallback(
    (orderId: string, notes: string) => {
      if (!siteId || !orderId || orderId === "new") return;

      const previousTimer = timers.current.get(orderId);
      if (previousTimer) window.clearTimeout(previousTimer);

      const timer = window.setTimeout(async () => {
        timers.current.delete(orderId);
        try {
          await updateCachedOrderNotes(siteId, orderId, notes);
          await enqueueOrderNotesUpdate(siteId, {
            siteId,
            orderId,
            notes,
            clientMutationId: uuidv4(),
          });
          await refreshPosSyncCounts(siteId);
          if (navigator.onLine) void drainPosOutbox(siteId);
        } catch (error) {
          console.error("Failed to save POS order notes:", error);
        }
      }, NOTES_SAVE_DELAY_MS);

      timers.current.set(orderId, timer);
    },
    [siteId],
  );
}
