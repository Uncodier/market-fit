import type { LocalPendingOrder, PosOutboxRow } from "./types";

/** Retire only an uncreated local draft; keep the queue and every payment ID for audit. */
export function isRejectedLocalDraft(order: LocalPendingOrder, rows: PosOutboxRow[]): boolean {
  if (!order.id.startsWith("local_")) return false;
  const creatorId = order.id.slice(6);
  const creator = rows.find(row => row.siteId === order.site_id && row.clientMutationId === creatorId &&
    row.payload.kind === "checkout" && !row.payload.data.existingOrderId);
  if (!creator) return false;
  const related = rows.filter(row => row.siteId === order.site_id && row.payload.kind === "checkout" &&
    (row.clientMutationId === creatorId || row.payload.data.existingOrderId === order.id ||
      row.resultOrderId === order.id || row.recoveryOrderId === order.id));
  return related.every(row => row.status === "failed" && row.recoveryState === "rejected" &&
    !row.resultOrderId && !row.recoveryOrderId && !row.recoverySaleId && !row.resultSaleId);
}