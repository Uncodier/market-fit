"use client";

import { useEffect, useState } from "react";
import {
  getPosSyncStatus,
  startPosSyncLoop,
  stopPosSyncLoop,
  subscribePosSync,
  type SyncStatus,
  drainPosOutbox,
  runPosSyncCycle,
} from "@/app/pos/local/sync-engine";

const EMPTY: SyncStatus = {
  online: true,
  pulling: false,
  syncing: false,
  pendingCount: 0,
  failedCount: 0,
  lastPulledAt: null,
  lastOrdersPulledAt: null,
  lastError: null,
};

export function usePosSyncStatus(siteId: string | undefined) {
  const [snapshot, setSnapshot] = useState<{ siteId?: string; status: SyncStatus }>({ status: EMPTY });

  useEffect(() => {
    if (!siteId) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setSnapshot({ siteId, status: getPosSyncStatus(siteId) });
    });
    const unsub = subscribePosSync((next) => {
      if (active) setSnapshot({ siteId, status: { ...next } });
    }, siteId);
    startPosSyncLoop(siteId);
    return () => {
      active = false;
      unsub();
      stopPosSyncLoop(siteId);
    };
  }, [siteId]);

  return {
    status: snapshot.siteId === siteId ? snapshot.status : EMPTY,
    retrySync: () => {
      if (siteId) void runPosSyncCycle(siteId, true);
    },
    drainOutbox: () => {
      if (siteId) void drainPosOutbox(siteId);
    },
  };
}
