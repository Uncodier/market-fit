import { checkoutCart } from "@/app/commerce/checkout";
import { checkInTicket } from "@/app/commerce/ticket-check-in";
import { createLeadWithIdempotency } from "@/app/pos/actions/create-lead-sync";
import { getPosDb } from "./db";
import {
  getServerIdForLocal,
  listOutbox,
  mapLocalId,
  updateOutboxRow,
} from "./outbox";
import { pullAndStorePosCatalogSnapshot, applyPosOpenOrders } from "./snapshot-pull";
import { getPosCatalogRevision } from "@/app/pos/actions/sync-revision";
import { listPosOpenOrders } from "@/app/pos/actions/list-open-orders";
import {
  shouldRunCatalogPull,
  shouldRunOrdersPull,
  shouldDrainOutbox,
} from "./sync-policy";
import type { PosOutboxRow } from "./types";

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
};

type SyncListener = (status: SyncStatus) => void;

const listeners = new Set<SyncListener>();
let running = false;
let rerunFlag = false;
let pulling = false;
let lastError: string | null = null;
const EMPTY_SITE_STATE: SiteSyncState = {
  lastPulledAt: null,
  lastCatalogCheckAt: null,
  lastOrdersAt: null,
  lastOrdersPulledAt: null,
  pendingCount: 0,
  failedCount: 0,
};
const siteState = new Map<string, SiteSyncState>();

function isBrowserOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

async function refreshCounts(siteId: string) {
  const rows = await listOutbox(siteId);
  const pendingCount = rows.filter(
    (r) => r.status === "pending" || r.status === "syncing",
  ).length;
  const failedCount = rows.filter((r) => r.status === "failed").length;
  const meta = await getPosDb().meta.get(siteId);
  const prev = siteState.get(siteId) || { ...EMPTY_SITE_STATE };
  siteState.set(siteId, {
    ...prev,
    lastPulledAt: meta?.lastPulledAt ?? prev.lastPulledAt,
    pendingCount,
    failedCount,
  });
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
    lastError,
  };
  listeners.forEach((l) => l(status));
}

export function subscribePosSync(listener: SyncListener): () => void {
  listeners.add(listener);
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
    lastError,
  };
}

async function applyOutboxItem(row: PosOutboxRow): Promise<void> {
  if (row.payload.kind === "create_lead") {
    const data = row.payload.data;
    const res = await createLeadWithIdempotency({
      siteId: data.siteId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      clientMutationId: data.clientMutationId,
    });
    if (res.error || !res.lead) throw new Error(res.error || "Lead sync failed");
    await mapLocalId({
      localId: data.localLeadId,
      serverId: res.lead.id,
      kind: "lead",
      siteId: data.siteId,
    });
    await getPosDb().leads.update(data.localLeadId, {
      is_local: false,
      // Keep local row but also store server id mapping; UI resolves via idMaps
    });
    // Upsert server lead under server id
    await getPosDb().leads.put({
      ...res.lead,
      site_id: data.siteId,
      is_local: false,
    });
    await updateOutboxRow(row.id, {
      status: "synced",
      resultLeadId: res.lead.id,
      lastError: null,
    });
    return;
  }

  if (row.payload.kind === "check_in") {
    const data = row.payload.data;
    const res = await checkInTicket({
      code: data.code,
      siteId: data.siteId,
      clientMutationId: data.clientMutationId,
    });
    if (res.error) throw new Error(res.error);
    await updateOutboxRow(row.id, { status: "synced", lastError: null });
    return;
  }

  if (row.payload.kind === "checkout") {
    const data = { ...row.payload.data };
    let leadId = data.leadId;
    if (data.localLeadId) {
      leadId =
        (await getServerIdForLocal(data.localLeadId)) || leadId || undefined;
      if (!leadId) {
        throw new Error("Waiting for local lead to sync");
      }
    }

    let existingOrderId = data.existingOrderId;
    if (existingOrderId?.startsWith("local_")) {
      existingOrderId =
        (await getServerIdForLocal(existingOrderId)) || undefined;
    }

    const res = await checkoutCart({
      ...data,
      leadId,
      existingOrderId,
      clientMutationId: data.clientMutationId,
    });
    if (res.error) throw new Error(res.error);

    if (res.orderId && data.existingOrderId?.startsWith("local_")) {
      await mapLocalId({
        localId: data.existingOrderId,
        serverId: res.orderId,
        kind: "order",
        siteId: data.siteId,
      });
    }
    if (res.saleId) {
      await mapLocalId({
        localId: data.clientMutationId,
        serverId: res.saleId,
        kind: "sale",
        siteId: data.siteId,
      });
    }

    await updateOutboxRow(row.id, {
      status: "synced",
      resultSaleId: res.saleId || null,
      resultOrderId: res.orderId || null,
      resultOrderNumber: (res as any).orderNumber || null,
      resultKitchenDelta: (res as any).kitchenDelta || null,
      resultFulfillment: (res as any).fulfillment || null,
      lastError: null,
    });
  }
}

export async function drainPosOutbox(siteId: string): Promise<void> {
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

  try {
    // Prefer create_lead before checkout that depends on it
    const open = await listOutbox(siteId, ["pending", "syncing", "failed"]);
    const ordered = [
      ...open.filter((r) => r.kind === "create_lead"),
      ...open.filter((r) => r.kind !== "create_lead"),
    ];

    for (const row of ordered) {
      await updateOutboxRow(row.id, {
        status: "syncing",
        attempts: row.attempts + 1,
      });
      try {
        await Promise.race([
          applyOutboxItem(row),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error("Sync timed out")), 45000),
          ),
        ]);
        lastError = null;
      } catch (e: any) {
        lastError = e?.message || "Sync failed";
        await updateOutboxRow(row.id, {
          status: "failed",
          lastError,
        });
      }
    }
  } finally {
    running = false;
    await refreshCounts(siteId);
    if (rerunFlag) {
      rerunFlag = false;
      void drainPosOutbox(siteId);
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
  if (!isBrowserOnline()) return;
  if (pulling) return;
  pulling = true;
  emit(siteId);

  try {
    const meta = await getPosDb().meta.get(siteId);
    let revisionToUse: string | null = null;

    const revRes = await getPosCatalogRevision(siteId);
    if (!("error" in revRes) && revRes.data) {
      if (!force && meta?.lastCatalogRevision === revRes.data) {
        markCatalogChecked(siteId);
        return;
      }
      revisionToUse = revRes.data;
    }

    const res = await pullAndStorePosCatalogSnapshot(siteId, revisionToUse);
    if (!res.ok) {
      lastError = res.error || "Catalog pull failed";
    } else {
      const prev = siteState.get(siteId) || { ...EMPTY_SITE_STATE };
      siteState.set(siteId, {
        ...prev,
        lastPulledAt: res.pulledAt || new Date().toISOString(),
        lastCatalogCheckAt: Date.now(),
      });
      if (!lastError?.includes("Sync")) lastError = null;
    }
  } catch (e: any) {
    lastError = e?.message || "Catalog pull failed";
  } finally {
    pulling = false;
    await refreshCounts(siteId);
  }
}

export async function pullPosOrdersInBackground(siteId: string): Promise<void> {
  if (!isBrowserOnline()) return;
  try {
    const res = await listPosOpenOrders(siteId);
    if (res.error) return;
    await applyPosOpenOrders(siteId, res.data || []);
    const prev = siteState.get(siteId) || { ...EMPTY_SITE_STATE };
    siteState.set(siteId, {
      ...prev,
      lastOrdersAt: Date.now(),
      lastOrdersPulledAt: new Date().toISOString(),
    });
    emit(siteId);
  } catch {
    // Keep the last known local open orders if the light pull fails.
  }
}

export async function runPosSyncCycle(
  siteId: string,
  force = false,
  isVisibilityTrigger = false,
): Promise<void> {
  if (typeof window === "undefined" || document.visibilityState === "hidden") return;

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

  if (doCatalog) {
    await pullPosCatalogInBackground(siteId, force);
  }

  if (doOrders) {
    await pullPosOrdersInBackground(siteId);
  }

  const online = isBrowserOnline();
  const pendingCount =
    siteState.get(siteId)?.pendingCount ?? state.pendingCount;
  if (shouldDrainOutbox({ pendingCount, online, force })) {
    await drainPosOutbox(siteId);
  }
}

let wired = false;
const intervals = new Map<string, number>();

export function startPosSyncLoop(siteId: string) {
  if (typeof window === "undefined") return;

  void refreshCounts(siteId);
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
