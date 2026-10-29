import { getPosDb } from "./db";
import { listOutbox } from "./outbox";
import { requirePosPermission, isPosPermissionCurrent } from "./location-permission-state";
import { syncPosCheckout } from "./sync-engine";
import type { IdMapRow, PosOutboxRow } from "./types";

const REVIEW = "This order has an unresolved checkout. Use Check payment status in the sync queue before taking another payment.";
const SAVED = "This order is still saved in the sync queue. Wait for it to finish syncing before taking payment.";
const MISMATCH = "The saved checkout does not match this order. Review the sync queue before taking payment.";
const isLocal = (id: string) => id.startsWith("local_");
const hasText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

function orderIds(row: PosOutboxRow): string[] {
  if (row.payload.kind !== "checkout") return [];
  const data = row.payload.data;
  return [data.existingOrderId || `local_${row.clientMutationId}`, row.resultOrderId, row.recoveryOrderId]
    .filter(hasText);
}

/** Find the selected order's aliases without treating unrelated queue work as a dependency. */
function relatedEvidence(orderId: string, rows: PosOutboxRow[], mappings: IdMapRow[]) {
  const ids = new Set([orderId]);
  const related = new Set<PosOutboxRow>();
  const maps = new Set<IdMapRow>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      const references = orderIds(row);
      if (related.has(row) || !references.some((id) => ids.has(id))) continue;
      related.add(row);
      references.forEach((id) => ids.add(id));
      changed = true;
    }
    for (const map of mappings) {
      if (maps.has(map) || (!ids.has(map.localId) && !(map.kind === "order" && ids.has(map.serverId)))) continue;
      maps.add(map);
      ids.add(map.localId);
      ids.add(map.serverId);
      changed = true;
    }
  }
  return { ids, rows: [...related], mappings: [...maps] };
}

/**
 * Resolve an original saved checkout, never create a new attempt or drain the queue.
 * The returned ID is only a lookup target: callers must fetch an authorized, current
 * order snapshot before enabling checkout. No local evidence proves payment state.
 */
export async function resolvePendingOrder(
  siteId: string,
  orderId: string,
  isCurrent: () => boolean = () => true,
): Promise<string> {
  const permission = requirePosPermission(siteId);
  const assertCurrent = () => {
    if (!isCurrent() || !isPosPermissionCurrent(permission)) throw new Error("POS access or order selection changed");
  };
  assertCurrent();
  if (!hasText(orderId) || orderId === "new") throw new Error(MISMATCH);

  const readEvidence = async () => {
    assertCurrent();
    const rows = await listOutbox(siteId);
    assertCurrent();
    const mappings = await getPosDb().idMaps.toArray();
    assertCurrent();
    const evidence = relatedEvidence(orderId, rows, mappings);
    if (!evidence.rows.length) throw new Error("No original checkout was found for this saved order. Review the sync queue.");
    for (const map of evidence.mappings) {
      if (map.siteId !== siteId || map.kind !== "order" || !isLocal(map.localId) ||
        !hasText(map.serverId) || isLocal(map.serverId)) throw new Error(MISMATCH);
    }
    for (const row of evidence.rows) {
      if (row.kind !== "checkout" || row.payload.kind !== "checkout") throw new Error(MISMATCH);
      const data = row.payload.data;
      if (row.siteId !== siteId || data.siteId !== siteId || data.userId !== permission.userId ||
        data.source !== "pos" || !hasText(row.clientMutationId) || data.clientMutationId !== row.clientMutationId ||
        rows.filter((candidate) => candidate.clientMutationId === row.clientMutationId).length !== 1) {
        throw new Error(MISMATCH);
      }
      if ((row.resultOrderId && isLocal(row.resultOrderId)) ||
        (row.recoveryOrderId && isLocal(row.recoveryOrderId))) throw new Error(MISMATCH);
      if (row.status === "failed" && row.recoveryState === "rejected") continue;
      if (row.recoveryState || (row.status !== "synced" &&
        (data.payments != null && (!Array.isArray(data.payments) || data.payments.length > 0)))) throw new Error(REVIEW);
      if (row.status !== "synced") {
        if (!["pending", "syncing", "failed"].includes(row.status) || data.intent === "pay" || data.intent === "complete" ||
          !["pickup", "ship", "dine_in", "none"].includes(data.fulfillment) ||
          !Array.isArray(data.lines) || !data.lines.length || !data.lines.every((line) => line &&
            hasText(line.catalogItemId) && Number.isFinite(line.quantity) && line.quantity > 0)) throw new Error(MISMATCH);
      }
      // The worker may synchronize a local creator dependency. Validate that
      // creator here too, before allowing it to dispatch any original checkout.
      if (data.existingOrderId && isLocal(data.existingOrderId) &&
        !evidence.mappings.some((map) => map.localId === data.existingOrderId) &&
        !evidence.rows.some((candidate) => candidate.clientMutationId === data.existingOrderId?.slice(6) &&
          candidate.payload.kind === "checkout" && !candidate.payload.data.existingOrderId)) throw new Error(MISMATCH);
    }
    const serverIds = [...evidence.ids].filter((id) => !isLocal(id));
    if (serverIds.length > 1) throw new Error(MISMATCH);
    if (!serverIds.length && evidence.rows.every(row => row.status === "failed" && row.recoveryState === "rejected")) {
      throw new Error("This local order was rejected or cancelled before creation. Its history is kept in the sync queue; start a new order.");
    }
    return { ...evidence, serverId: serverIds[0] };
  };

  let evidence = await readEvidence();
  while (true) {
    const pending = evidence.rows.find((row) => row.status !== "synced" && row.recoveryState !== "rejected");
    if (!pending) break;
    assertCurrent();
    await syncPosCheckout(siteId, pending.clientMutationId);
    assertCurrent();
    // A bounded wait or a rejected request does not establish synchronization.
    evidence = await readEvidence();
    const current = evidence.rows.find((row) => row.id === pending.id);
    if (!current || current.clientMutationId !== pending.clientMutationId || current.status !== "synced") throw new Error(SAVED);
  }
  assertCurrent();
  if (!evidence.serverId || evidence.rows.some((row) => row.recoveryState !== "rejected" && row.resultOrderId !== evidence.serverId &&
    !evidence.mappings.some((map) => map.serverId === evidence.serverId && orderIds(row).includes(map.localId)))) {
    throw new Error(MISMATCH);
  }
  return evidence.serverId;
}