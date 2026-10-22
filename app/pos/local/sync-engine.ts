import { applyOutboxItem } from "./sync-outbox-item";
import { getPosPermissionLease, isPosPermissionCurrent, subscribePosPermission } from "./location-permission-state";
import { getPosDb } from "./db";
import {
  listOutbox,
  updateOutboxRow,
} from "./outbox";
import { pullAndStorePosCatalogSnapshot, applyPosOpenOrders } from "./snapshot-pull";
import { getPosCatalogRevision } from "@/app/pos/actions/sync-revision";
import { listPosOpenOrders } from "@/app/pos/actions/list-open-orders";
import {
  shouldRunCatalogPull,
  shouldRunOrdersPull,
  shouldDrainOutbox,
  ORDERS_INTERVAL_MS,
  ORDERS_RETRY_MAX_MS,
} from "./sync-policy";
import { clearAllPosSyncErrors, clearPosSyncError, getPosSyncError, recordPosSyncError, reconcilePosOutboxErrors } from "./sync-errors";
import { applyPosCheckoutRecovery, reconcilePosCheckout } from "./checkout-recovery";
import { PosCheckoutRecoveryError } from "../checkout-recovery-types";

export type SyncStatus = {
  online: boolean;
  pulling: boolean;
  syncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastPulledAt: string | null;
  lastOrdersPulledAt: string | null;
  lastError: string | null;
};

type SiteSyncState = {
  lastPulledAt: string | null;
  lastCatalogCheckAt: number | null;
  lastOrdersAt: number | null;
  lastOrdersPulledAt: string | null;
  pendingCount: number;
  failedCount: number;
  ordersRetryDelayMs: number;
  nextOrdersRetryAt: number | null;
};

type SyncListener = (status: SyncStatus) => void;

const listeners = new Map<SyncListener, string | undefined>();
let running = false;
let rerunFlag = false;
let pulling = false;
const EMPTY_SITE_STATE: SiteSyncState = {
  lastPulledAt: null,
  lastCatalogCheckAt: null,
  lastOrdersAt: null,
  lastOrdersPulledAt: null,
  pendingCount: 0,
  failedCount: 0,
  ordersRetryDelayMs: 0,
  nextOrdersRetryAt: null,
};
const siteState = new Map<string, SiteSyncState>();
// Permission changes reset scheduling, but cannot cancel an outstanding Server Action.
// Retain its slot until the real request and local application have settled.
const ordersInFlight = new Map<string, Promise<void>>();
subscribePosPermission(() => { siteState.clear(); clearAllPosSyncErrors(); });

function isBrowserOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function isDocumentVisible() {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

async function refreshCounts(siteId: string) {
  const permission = getPosPermissionLease(siteId);
  if (!permission) return;
  try {
    const rows = await listOutbox(siteId);
    if (!isPosPermissionCurrent(permission)) return;
    reconcilePosOutboxErrors(siteId, rows);
    const pendingCount = rows.filter(
      (r) => r.status === "pending" || r.status === "syncing",
    ).length;
    const failedCount = rows.filter((r) => r.status === "failed").length;
    const meta = await getPosDb().meta.get(siteId);
    if (!isPosPermissionCurrent(permission)) return;
    const prev = siteState.get(siteId) || { ...EMPTY_SITE_STATE };
    siteState.set(siteId, {
      ...prev,
      lastPulledAt: meta?.lastPulledAt ?? prev.lastPulledAt,
      pendingCount,
      failedCount,
    });
    clearPosSyncError(siteId, "counts");
  } catch (error) {
    if (!isPosPermissionCurrent(permission)) return;
    recordPosSyncError("counts", {
      siteId, operation: "outbox", error: error instanceof Error ? error.message : "Failed to read sync queue",
    });
  }
  emit(siteId);
}

export function refreshPosSyncCounts(siteId: string) {
  return refreshCounts(siteId);
}

function emit(siteId: string) {
  const state = siteState.get(siteId) || { ...EMPTY_SITE_STATE };
  const status: SyncStatus = {
    online: isBrowserOnline(),
    pulling,
    syncing: running,
    pendingCount: state.pendingCount,
    failedCount: state.failedCount,
    lastPulledAt: state.lastPulledAt,
    lastOrdersPulledAt: state.lastOrdersPulledAt,
    lastError: getPosSyncError(siteId),
  };
  listeners.forEach((listenerSiteId, listener) => {
    if (!listenerSiteId || listenerSiteId === siteId) listener(status);
  });
}

export function subscribePosSync(listener: SyncListener, siteId?: string): () => void {
  listeners.set(listener, siteId);
  return () => listeners.delete(listener);
}

export function getPosSyncStatus(siteId: string): SyncStatus {
  const state = siteState.get(siteId) || { ...EMPTY_SITE_STATE };
  return {
    online: isBrowserOnline(),
    pulling,
    syncing: running,
    pendingCount: state.pendingCount,
    failedCount: state.failedCount,
    lastPulledAt: state.lastPulledAt,
    lastOrdersPulledAt: state.lastOrdersPulledAt,
    lastError: getPosSyncError(siteId),
  };
}

export async function drainPosOutbox(siteId: string): Promise<void> {
  const permission = getPosPermissionLease(siteId);
  if (!permission) return;
  if (!isBrowserOnline()) {
    emit(siteId);
    return;
  }
  if (running) {
    rerunFlag = true;
    return;
  }
  running = true;
  emit(siteId);
  let attemptedCheckout = false;

  try {
    // Prefer create_lead before checkout that depends on it
    const open = await listOutbox(siteId, ["pending", "syncing", "failed"]);
    const ordered = [
      ...open.filter((r) => r.kind === "create_lead"),
      ...open.filter((r) => r.kind !== "create_lead"),
    ];

    for (const row of ordered) {
      if (!isPosPermissionCurrent(permission)) break;
      // Failures of a collected payment are status lookups, not checkout replays.
      // This also handles historical rows whose response predates durable admission.
      if (row.payload?.kind === "checkout" && row.payload.data.payments?.length &&
        (row.status !== "pending" || row.recoveryState)) {
        if (row.recoveryState === "rejected") continue;
        try {
          const recovery = await reconcilePosCheckout(siteId, row.id);
          if (recovery.state === "completed") clearPosSyncError(siteId, `outbox:${row.id}`);
        } catch {
          // A failed evidence read never authorizes a second collection.
        }
        continue;
      }
      if (row.recoveryState) continue;
      if (row.kind === "checkout") attemptedCheckout = true;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await updateOutboxRow(row.id, {
          status: "syncing",
          attempts: row.attempts + 1,
        });
        if (!isPosPermissionCurrent(permission)) break;
        await Promise.race([
          applyOutboxItem(row, permission),
          new Promise<void>((_, reject) => {
            timeout = setTimeout(() => reject(new Error("Sync timed out")), 45000);
          }),
        ]);
        clearPosSyncError(siteId, `outbox:${row.id}`);
      } catch (error) {
        if (!isPosPermissionCurrent(permission)) break;
        const message = error instanceof Error ? error.message : "Sync failed";
        recordPosSyncError(`outbox:${row.id}`, {
          siteId, operation: row.kind, error: message,
          clientMutationId: row.clientMutationId, attempts: row.attempts + 1,
        });
        await updateOutboxRow(row.id, {
          status: "failed",
          lastError: message,
        });
        if (error instanceof PosCheckoutRecoveryError) await applyPosCheckoutRecovery(row, error.recovery);
        else if (row.payload.kind === "checkout" && row.payload.data.payments?.length) {
          try { await reconcilePosCheckout(siteId, row.id); } catch { /* Retain unknown payment evidence. */ }
        }
      } finally {
        if (timeout !== undefined) clearTimeout(timeout);
      }
    }
    clearPosSyncError(siteId, "outbox");
  } catch (error) {
    if (!isPosPermissionCurrent(permission)) return;
    recordPosSyncError("outbox", {
      siteId, operation: "outbox", error: error instanceof Error ? error.message : "Sync failed",
    });
  } finally {
    running = false;
    if (isPosPermissionCurrent(permission)) {
      await refreshCounts(siteId);
      if (attemptedCheckout) void pullPosCatalogInBackground(siteId, true);
      if (rerunFlag) void drainPosOutbox(siteId);
    }
    rerunFlag = false;
  }
}

function markCatalogChecked(siteId: string) {
  const prev = siteState.get(siteId) || { ...EMPTY_SITE_STATE };
  siteState.set(siteId, {
    ...prev,
    lastCatalogCheckAt: Date.now(),
  });
}

export async function pullPosCatalogInBackground(
  siteId: string,
  force = false,
): Promise<void> {
  const permission = getPosPermissionLease(siteId);
  if (!permission) return;
  if (!isBrowserOnline()) return;
  if (pulling) return;
  pulling = true;
  emit(siteId);

  try {
    const meta = await getPosDb().meta.get(siteId);
    let revisionToUse: string | null = null;

    const revRes = await getPosCatalogRevision(siteId);
    if (!isPosPermissionCurrent(permission)) return;
    if ("error" in revRes) {
      recordPosSyncError("catalog", { siteId, operation: "catalog", error: revRes.error || "Catalog revision failed" });
    }
    if (!("error" in revRes) && revRes.data) {
      if (!force && meta?.lastCatalogRevision === revRes.data) {
        markCatalogChecked(siteId);
        clearPosSyncError(siteId, "catalog");
        return;
      }
      revisionToUse = revRes.data;
    }

    const res = await pullAndStorePosCatalogSnapshot(siteId, revisionToUse);
    if (!isPosPermissionCurrent(permission)) return;
    if (!res.ok) {
      recordPosSyncError("catalog", { siteId, operation: "catalog", error: res.error || "Catalog pull failed" });
    } else {
      const prev = siteState.get(siteId) || { ...EMPTY_SITE_STATE };
      siteState.set(siteId, {
        ...prev,
        lastPulledAt: res.pulledAt || new Date().toISOString(),
        lastCatalogCheckAt: Date.now(),
      });
      clearPosSyncError(siteId, "catalog");
    }
  } catch (error) {
    if (!isPosPermissionCurrent(permission)) return;
    recordPosSyncError("catalog", { siteId, operation: "catalog", error: error instanceof Error ? error.message : "Catalog pull failed" });
  } finally {
    pulling = false;
    await refreshCounts(siteId);
  }
}

export function pullPosOrdersInBackground(siteId: string): Promise<void> {
  const permission = getPosPermissionLease(siteId);
  if (!permission || !isBrowserOnline() || !isDocumentVisible()) return Promise.resolve();
  const existing = ordersInFlight.get(siteId);
  if (existing) return existing;
  const state = siteState.get(siteId) || { ...EMPTY_SITE_STATE };
  // Force and visibility triggers may bypass freshness, never a failure cooldown.
  if (state.nextOrdersRetryAt !== null && Date.now() < state.nextOrdersRetryAt) return Promise.resolve();

  const request = Promise.resolve().then(async () => {
    if (!isPosPermissionCurrent(permission) || !isBrowserOnline() || !isDocumentVisible()) return;
    try {
      const res = await listPosOpenOrders(siteId);
      if (!isPosPermissionCurrent(permission)) return;
      if (res.error) throw new Error(res.error);
      await applyPosOpenOrders(siteId, res.data || []);
      if (!isPosPermissionCurrent(permission)) return;
      const prev = siteState.get(siteId) || { ...EMPTY_SITE_STATE };
      siteState.set(siteId, {
        ...prev,
        lastOrdersAt: Date.now(),
        lastOrdersPulledAt: new Date().toISOString(),
        ordersRetryDelayMs: 0,
        nextOrdersRetryAt: null,
      });
      clearPosSyncError(siteId, "orders");
    } catch (error) {
      if (!isPosPermissionCurrent(permission)) return;
      const prev = siteState.get(siteId) || { ...EMPTY_SITE_STATE };
      const ordersRetryDelayMs = Math.min(prev.ordersRetryDelayMs * 2 || ORDERS_INTERVAL_MS, ORDERS_RETRY_MAX_MS);
      siteState.set(siteId, { ...prev, ordersRetryDelayMs, nextOrdersRetryAt: Date.now() + ordersRetryDelayMs });
      // Keep the last known local open orders if the light pull fails.
      recordPosSyncError("orders", { siteId, operation: "orders", error: error instanceof Error ? error.message : "Orders pull failed" });
    }
  }).finally(() => {
    ordersInFlight.delete(siteId);
    emit(siteId);
  });
  ordersInFlight.set(siteId, request);
  return request;
}

export async function runPosSyncCycle(
  siteId: string,
  force = false,
  isVisibilityTrigger = false,
): Promise<void> {
  if (typeof window === "undefined" || document.visibilityState === "hidden") return;
  const permission = getPosPermissionLease(siteId);
  if (!permission) return;
  await refreshCounts(siteId);
  if (!isPosPermissionCurrent(permission) || !isDocumentVisible()) return;

  const now = Date.now();
  const state = siteState.get(siteId) || { ...EMPTY_SITE_STATE };
  const lastCatalogAt =
    state.lastCatalogCheckAt ??
    (state.lastPulledAt ? new Date(state.lastPulledAt).getTime() : null);

  const doCatalog = shouldRunCatalogPull({
    now,
    lastCatalogAt,
    visible: true,
    force,
    isVisibilityTrigger,
  });
  const doOrders = shouldRunOrdersPull({
    now,
    lastOrdersAt: state.lastOrdersAt,
    visible: true,
    force,
  });

  // Each lane has its own admission guard. A slow orders pull must not hold up
  // catalog checks or local outbox replay (the framework may still serialize actions).
  const work: Promise<void>[] = [];
  if (doCatalog) work.push(pullPosCatalogInBackground(siteId, force));
  if (doOrders) work.push(pullPosOrdersInBackground(siteId));
  const online = isBrowserOnline();
  const latest = siteState.get(siteId) || state;
  if (shouldDrainOutbox({ pendingCount: latest.pendingCount, failedCount: latest.failedCount, online, force })) {
    work.push(drainPosOutbox(siteId));
  }
  await Promise.all(work);
}

let wired = false;
const intervals = new Map<string, number>();

export function startPosSyncLoop(siteId: string) {
  if (typeof window === "undefined") return;

  void runPosSyncCycle(siteId, false);

  if (!intervals.has(siteId)) {
    const id = window.setInterval(() => {
      void runPosSyncCycle(siteId, false);
    }, 30_000);
    intervals.set(siteId, id);
  }

  if (!wired) {
    wired = true;
    window.addEventListener("online", () => {
      intervals.forEach((_, sid) => void drainPosOutbox(sid));
    });
    window.addEventListener("offline", () => {
      intervals.forEach((_, sid) => emit(sid));
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        intervals.forEach((_, sid) => void runPosSyncCycle(sid, false, true));
      }
    });
  }
}

export function stopPosSyncLoop(siteId: string) {
  const id = intervals.get(siteId);
  if (id) {
    clearInterval(id);
    intervals.delete(siteId);
  }
}
