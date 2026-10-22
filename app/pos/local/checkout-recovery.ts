import { reconcilePosCheckoutStatus } from "../actions/reconcile-checkout";
import { getPosDb } from "./db";
import { requirePosPermission, isPosPermissionCurrent } from "./location-permission-state";
import { updateOutboxRow, mapLocalId } from "./outbox";
import type { PosOutboxRow } from "./types";
import type { PosCheckoutRecovery } from "../checkout-recovery-types";

/** Only explicit server evidence can unblock other orders. Unknown legacy writes cannot. */
export function isPosPaymentIsolated(row: PosOutboxRow): boolean {
  return row.status === "failed" && (row.recoveryState === "rejected" || row.recoveryState === "payment_recorded");
}

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
    await updateOutboxRow(row.id, { status: "failed", recoveryState, recoveryMessage: recovery.message,
      recoveryOrderId: recovery.orderId || row.recoveryOrderId,
      recoverySaleId: recovery.saleId || row.recoverySaleId,
    });
  });
}

/** Read-only reconciliation request; never calls checkout or changes the queued payload. */
export async function reconcilePosCheckout(siteId: string, rowId: string): Promise<PosCheckoutRecovery> {
  const permission = requirePosPermission(siteId);
  const row = await getPosDb().outbox.get(rowId);
  if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed");
  if (!row || row.siteId !== siteId || row.payload.kind !== "checkout" || row.payload.data.userId !== permission.userId) {
    throw new Error("Checkout recovery is unavailable for this operation.");
  }
  if (row.status === "synced") throw new Error("This checkout is already synchronized.");
  const data = row.payload.data;
  const result = await reconcilePosCheckoutStatus({
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