import { hasPosOutboxWork, syncPosOutboxRow } from "./sync-outbox-worker";
import { getPosPermissionLease, isPosPermissionCurrent, subscribePosPermission } from "./location-permission-state";
import { canStartPosRemoteRequest } from "./remote-permission";
import { POS_ACCESS_UPDATED_EVENT } from "./access-recheck";
import { getPosDb } from "./db";
import { listOutbox } from "./outbox";
import { pullAndStorePosCatalogSnapshot, applyPosOpenOrders } from "./snapshot-pull";
import { fetchPosCatalogRevision } from "@/app/pos/catalog-revision-client";
import { listPosOpenOrders } from "@/app/pos/actions/list-open-orders";
import {
  shouldRunCatalogPull,
  shouldRefreshCatalogSnapshot,
  shouldRunOrdersPull,
  shouldDrainOutbox,
  ORDERS_INTERVAL_MS,
  ORDERS_RETRY_MAX_MS,
} from "./sync-policy";
import { clearAllPosSyncErrors, clearPosSyncError, getPosSyncError, recordPosSyncError, reconcilePosOutboxErrors } from "./sync-errors";
import { beginCatalogSync, clearCatalogSyncProgress, finishCatalogSync, getCatalogSyncProgress, setCatalogSyncPhase, type CatalogSyncProgress } from "./catalog-sync-progress";

export type SyncStatus = {
  /** Legacy remote-work availability; cached leases must keep consumers offline. */
  online: boolean;
  /** Browser connectivity for diagnostics, never authorization for remote work. */
  networkOnline?: boolean;
  pulling: boolean;
  syncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastPulledAt: string | null;
  lastOrdersPulledAt: string | null;
  lastError: string | null;
  catalogSync?: CatalogSyncProgress;
  accessVerified?: boolean;
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
const drainingSites = new Set<string>();
const rerunSites = new Set<string>();
const pullingSites = new Set<string>();
const knownSites = new Set<string>();
// Keep recovery intent across permission suspension and workspace unmounts.
const catalogRecovery = new Map<string, number>();
let recoverySequence = 0;
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
subscribePosPermission(() => {
  siteState.clear(); clearAllPosSyncErrors(); clearCatalogSyncProgress();
  const sites = new Set([...knownSites, ...Array.from(listeners.values()).filter((id): id is string => !!id)]);
  sites.forEach((siteId) => emit(siteId));
});

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
    const failedCount = rows.filter((r) => r.status === "failed" && r.recoveryState !== "rejected").length;
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
  const status = getPosSyncStatus(siteId);
  listeners.forEach((listenerSiteId, listener) => {
    if (!listenerSiteId || listenerSiteId === siteId) listener(status);
  });
}

export function subscribePosSync(listener: SyncListener, siteId?: string): () => void {
  listeners.set(listener, siteId);
  return () => listeners.delete(listener);
}

export function getPosSyncStatus(siteId: string): SyncStatus {
  const permission = getPosPermissionLease(siteId);
  if (!permission) return {
    online: false, networkOnline: isBrowserOnline(), accessVerified: false, pulling: false, syncing: false,
    pendingCount: 0, failedCount: 0, lastPulledAt: null, lastOrdersPulledAt: null, lastError: null,
  };
  const state = siteState.get(siteId) || { ...EMPTY_SITE_STATE };
  return {
    online: isBrowserOnline() && !permission.offline,
    networkOnline: isBrowserOnline(),
    accessVerified: !permission.offline,
    pulling: pullingSites.has(siteId),
    syncing: drainingSites.has(siteId) || hasPosOutboxWork(siteId),
    pendingCount: state.pendingCount,
    failedCount: state.failedCount,
    lastPulledAt: state.lastPulledAt,
    lastOrdersPulledAt: state.lastOrdersPulledAt,
    lastError: getPosSyncError(siteId),
    catalogSync: getCatalogSyncProgress(siteId),
  };
}

export async function drainPosOutbox(siteId: string): Promise<void> {
  const permission = getPosPermissionLease(siteId);
  if (!permission || !canStartPosRemoteRequest(permission)) return;
  if (!isBrowserOnline()) {
    emit(siteId);
    return;
  }
  if (drainingSites.has(siteId)) {
    rerunSites.add(siteId);
    return;
  }
  drainingSites.add(siteId);
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
      if (!canStartPosRemoteRequest(permission)) break;
      if (row.kind === "checkout") attemptedCheckout = true;
      await syncPosOutboxRow(row, permission, outboxChanged);
    }
    clearPosSyncError(siteId, "outbox");
  } catch (error) {
    if (!canStartPosRemoteRequest(permission)) return;
    recordPosSyncError("outbox", {
      siteId, operation: "outbox", error: error instanceof Error ? error.message : "Sync failed",
    });
  } finally {
    drainingSites.delete(siteId);
    const rerun = rerunSites.delete(siteId);
    if (isPosPermissionCurrent(permission)) {
      await refreshCounts(siteId);
      if (attemptedCheckout) void pullPosCatalogInBackground(siteId, true);
      if (rerun) void drainPosOutbox(siteId);
    }
  }
}

function outboxChanged(siteId: string) {
  emit(siteId);
  void refreshCounts(siteId);
}

/** Wait for this checkout and its local dependencies, not unrelated queue work.
 * Failures remain in the outbox for the payment caller to inspect. A bounded
 * wait is not payment confirmation and never releases a still-active request.
 */
export async function syncPosCheckout(siteId: string, mutationId: string): Promise<void> {
  const permission = getPosPermissionLease(siteId);
  if (!permission || !canStartPosRemoteRequest(permission)) return;
  try {
    const rows = await listOutbox(siteId);
    if (!canStartPosRemoteRequest(permission)) return;
    const row = rows.find((candidate) => candidate.siteId === siteId &&
      candidate.clientMutationId === mutationId && candidate.kind === "checkout" && candidate.payload.kind === "checkout");
    if (!row || row.status === "synced") return;
    await syncPosOutboxRow(row, permission, outboxChanged);
  } catch (error) {
    if (canStartPosRemoteRequest(permission)) recordPosSyncError("outbox", {
      siteId, operation: "outbox", error: error instanceof Error ? error.message : "Sync failed",
    });
  } finally {
    if (isPosPermissionCurrent(permission)) {
      await refreshCounts(siteId);
      void pullPosCatalogInBackground(siteId, true);
    }
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
  if (!canStartPosRemoteRequest(permission)) return;
  if (pullingSites.has(siteId)) return;
  pullingSites.add(siteId);
  beginCatalogSync(siteId);
  emit(siteId);

  try {
    const meta = await getPosDb().meta.get(siteId);
    if (!canStartPosRemoteRequest(permission)) return;
    const recovery = catalogRecovery.get(siteId);
    const refreshSnapshot = force || recovery !== undefined || !meta?.lastCatalogRevision ||
      shouldRefreshCatalogSnapshot(Date.now(), meta?.lastPulledAt ?? null);
    let revisionToUse: string | null = null;

    // Revision lookup is an optimization, not a prerequisite for a full pull.
    const revRes = await fetchPosCatalogRevision(siteId).catch((error: unknown) => ({
      error: error instanceof Error ? error.message : "Catalog revision failed",
    }));
    if (!canStartPosRemoteRequest(permission)) return;
    if ("error" in revRes) {
      recordPosSyncError("catalog", { siteId, operation: "catalog", error: revRes.error || "Catalog revision failed" });
    }
    if (!("error" in revRes) && revRes.data) {
      if (!refreshSnapshot && meta?.lastCatalogRevision === revRes.data) {
        markCatalogChecked(siteId);
        clearPosSyncError(siteId, "catalog");
        finishCatalogSync(siteId, "checked");
        return;
      }
      revisionToUse = revRes.data;
    }

    setCatalogSyncPhase(siteId, "downloading");
    emit(siteId);
    const res = await pullAndStorePosCatalogSnapshot(siteId, revisionToUse, refreshSnapshot, () => {
      setCatalogSyncPhase(siteId, "saving");
      emit(siteId);
    });
    if (!canStartPosRemoteRequest(permission)) return;
    if (!res.ok) {
      recordPosSyncError("catalog", { siteId, operation: "catalog", error: res.error || "Catalog pull failed" });
      finishCatalogSync(siteId, "error");
    } else {
      const prev = siteState.get(siteId) || { ...EMPTY_SITE_STATE };
      siteState.set(siteId, {
        ...prev,
        lastPulledAt: res.pulledAt || new Date().toISOString(),
        lastCatalogCheckAt: Date.now(),
      });
      clearPosSyncError(siteId, "catalog");
      finishCatalogSync(siteId, "success", refreshSnapshot || revisionToUse === null);
      if (recovery !== undefined && catalogRecovery.get(siteId) === recovery) catalogRecovery.delete(siteId);
    }
  } catch (error) {
    if (!canStartPosRemoteRequest(permission)) return;
    recordPosSyncError("catalog", { siteId, operation: "catalog", error: error instanceof Error ? error.message : "Catalog pull failed" });
    finishCatalogSync(siteId, "error");
  } finally {
    pullingSites.delete(siteId);
    if (!canStartPosRemoteRequest(permission)) finishCatalogSync(siteId, "checked");
    await refreshCounts(siteId);
  }
}

export function pullPosOrdersInBackground(siteId: string): Promise<void> {
  const permission = getPosPermissionLease(siteId);
  if (!permission || !canStartPosRemoteRequest(permission) || !isDocumentVisible()) return Promise.resolve();
  const existing = ordersInFlight.get(siteId);
  if (existing) return existing;
  const state = siteState.get(siteId) || { ...EMPTY_SITE_STATE };
  // Force and visibility triggers may bypass freshness, never a failure cooldown.
  if (state.nextOrdersRetryAt !== null && Date.now() < state.nextOrdersRetryAt) return Promise.resolve();

  const request = Promise.resolve().then(async () => {
    if (!canStartPosRemoteRequest(permission) || !isDocumentVisible()) return;
    try {
      const res = await listPosOpenOrders(siteId);
      if (!canStartPosRemoteRequest(permission)) return;
      if (res.error) throw new Error(res.error);
      await applyPosOpenOrders(siteId, res.data || [], permission);
      if (!canStartPosRemoteRequest(permission)) return;
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
      if (!canStartPosRemoteRequest(permission)) return;
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

  const refreshSnapshot = catalogRecovery.has(siteId) || shouldRefreshCatalogSnapshot(now, state.lastPulledAt);
  const doCatalog = refreshSnapshot || shouldRunCatalogPull({
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
  knownSites.add(siteId);

  void runPosSyncCycle(siteId, false);

  if (!intervals.has(siteId)) {
    const id = window.setInterval(() => {
      void runPosSyncCycle(siteId, false);
    }, 30_000);
    intervals.set(siteId, id);
  }

  if (!wired) {
    wired = true;
    window.addEventListener(POS_ACCESS_UPDATED_EVENT, () => {
      // Lease renewal is not scope invalidation: retain counts, errors, progress
      // and scheduling. Never trust event payloads as authorization.
      const sites = new Set([...knownSites, ...Array.from(listeners.values()).filter((id): id is string => !!id)]);
      sites.forEach((sid) => emit(sid));
      intervals.forEach((_, sid) => {
        if (canStartPosRemoteRequest(getPosPermissionLease(sid))) void runPosSyncCycle(sid, false);
      });
    });
    window.addEventListener("online", () => {
      knownSites.forEach((sid) => emit(sid));
      intervals.forEach((_, sid) => void runPosSyncCycle(sid, true));
    });
    window.addEventListener("focus", () => {
      intervals.forEach((_, sid) => void runPosSyncCycle(sid, false, true));
    });
    window.addEventListener("offline", () => {
      knownSites.forEach((sid) => {
        catalogRecovery.set(sid, ++recoverySequence);
        emit(sid);
      });
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
