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
  lastError: null,
};

export function usePosSyncStatus(siteId: string | undefined) {
  const [status, setStatus] = useState<SyncStatus>(EMPTY);

  useEffect(() => {
    if (!siteId) return;
    setStatus(getPosSyncStatus(siteId));
    const unsub = subscribePosSync((next) => setStatus({ ...next }));
    startPosSyncLoop(siteId);
    return () => {
      unsub();
      stopPosSyncLoop(siteId);
    };
  }, [siteId]);

  return {
    status,
    retrySync: () => {
      if (siteId) void runPosSyncCycle(siteId);
    },
    drainOutbox: () => {
      if (siteId) void drainPosOutbox(siteId);
    },
  };
}
