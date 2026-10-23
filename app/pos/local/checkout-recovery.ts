import { fetchPosCheckoutStatus } from "../checkout-status-client";
import { getPosDb } from "./db";
import { requirePosPermission, isPosPermissionCurrent } from "./location-permission-state";
import { updateOutboxRow, mapLocalId } from "./outbox";
import type { PosOutboxRow } from "./types";
import type { PosCheckoutRecovery } from "../checkout-recovery-types";
import { assertPosRemotePermission, requirePosRemotePermission } from "./remote-permission";

export async function applyPosCheckoutRecovery(row: PosOutboxRow, recovery: PosCheckoutRecovery): Promise<void> {
  const permission = requirePosPermission(row.siteId);
  if (row.payload.kind !== "checkout" || row.payload.data.userId !== permission.userId) throw new Error("POS account changed");
  if (recovery.state === "completed" && recovery.result?.success === true) {
    const result = recovery.result;
    if (row.payload.data.existingOrderId?.startsWith("local_")) await mapLocalId({
      siteId: row.siteId, kind: "order", localId: row.payload.data.existingOrderId, serverId: result.orderId,
    });
    if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed");
    await updateOutboxRow(row.id, { status: "synced", lastError: null, recoveryState: undefined,
      recoveryMessage: recovery.message, recoveryOrderId: result.orderId, recoverySaleId: result.saleId,
      resultOrderId: result.orderId, resultSaleId: result.saleId, resultOrderNumber: result.orderNumber,
      resultKitchenDelta: result.kitchenDelta, resultFulfillment: result.fulfillment,
    });
    return;
  }
  if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed");
  const recoveryState = recovery.state === "rejected" || recovery.state === "payment_recorded"
    ? recovery.state : "review_required";
  const db = getPosDb();
  await db.transaction("rw", db.outbox, async () => {
    const current = await db.outbox.get(row.id);
    // A late status read cannot overwrite a newer confirmed checkout result.
    if (!current || current.status === "synced") return;
    if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed");
    // Confirmed immutable receipt evidence remains valid if a subsequent read
    // catches a transient/in-flight state. Never undo safe order isolation.
    const state = current.recoveryState === "payment_recorded" && recoveryState === "review_required"
      ? "payment_recorded" : recoveryState;
    await updateOutboxRow(row.id, { status: "failed", recoveryState: state,
      recoveryMessage: state !== recoveryState ? current.recoveryMessage : recovery.message,
      recoveryOrderId: recovery.orderId || row.recoveryOrderId,
      recoverySaleId: recovery.saleId || row.recoverySaleId,
    });
  });
}

/** Read-only reconciliation request; never calls checkout or changes the queued payload. */
export async function reconcilePosCheckout(siteId: string, rowId: string): Promise<PosCheckoutRecovery> {
  const permission = requirePosRemotePermission(siteId);
  const row = await getPosDb().outbox.get(rowId);
  if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed");
  if (!row || row.siteId !== siteId || row.payload.kind !== "checkout" || row.payload.data.userId !== permission.userId) {
    throw new Error("Checkout recovery is unavailable for this operation.");
  }
  if (row.status === "synced") throw new Error("This checkout is already synchronized.");
  const data = row.payload.data;
  assertPosRemotePermission(permission);
  const result = await fetchPosCheckoutStatus({
    siteId, clientMutationId: row.clientMutationId,
    existingOrderId: data.existingOrderId?.startsWith("local_") ? undefined : data.existingOrderId,
    registerSessionId: data.registerSessionId,
    payments: (data.payments || []).map((p) => ({ paymentId: p.paymentId, method: p.method,
      amount: p.amount, tendered: p.tendered, change: p.change })),
  });
  if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed");
  if (result.error || !result.data) throw new Error(result.error || "Unable to verify checkout.");
  await applyPosCheckoutRecovery(row, result.data);
  const { refreshPosSyncCounts } = await import("./sync-engine");
  await refreshPosSyncCounts(siteId);
  return result.data;
}