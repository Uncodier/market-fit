import { checkoutPosCart, fetchPosOrder } from "../operation-client";
import { applyPosCheckoutRecovery, reconcilePosCheckout } from "./checkout-recovery";
import { getPosDb } from "./db";
import { assertPosRemotePermission, requirePosRemotePermission } from "./remote-permission";

import { canReviewReceivedCash } from "./received-cash-review";
export { canReviewReceivedCash } from "./received-cash-review";

async function recoverOriginal(siteId: string, rowId: string) {
  const permission = requirePosRemotePermission(siteId);
  const db = getPosDb();
  const ownedRow = async () => {
    const row = await db.outbox.get(rowId);
    assertPosRemotePermission(permission);
    if (row?.siteId !== siteId || row.payload.kind !== "checkout" || row.payload.data.userId !== permission.userId) {
      throw new Error("The original cash attempt is unavailable for this cashier.");
    }
    return row;
  };
  const original = await ownedRow();
  if (original.status === "synced") return;
  const status = await reconcilePosCheckout(siteId, rowId);
  assertPosRemotePermission(permission);
  if (status.state === "completed") return;
  if (status.state !== "review_required") throw new Error(status.message);
  const row = await ownedRow();
  if (row.status === "synced") return;
  if (row.payload.kind !== "checkout" || !row.payload.data.existingOrderId) throw new Error("Original order required.");
  const { localLeadId, ...originalInput } = row.payload.data;
  const live = await fetchPosOrder(siteId, row.payload.data.existingOrderId);
  assertPosRemotePermission(permission);
  if (localLeadId || !live.data || !canReviewReceivedCash(row, live.data)) {
    throw new Error("The order or its payment evidence changed. Refresh the review; do not collect again.");
  }
  // Never persist this opt-in on the outbox row: automatic sync cannot request recovery.
  const result = await checkoutPosCart({ ...originalInput, recoverReceivedCash: true });
  assertPosRemotePermission(permission);
  if ("error" in result && result.error) throw new Error(result.error);
  if (result.success !== true || result.orderId !== live.data.id || result.saleId !== live.data.sale_id) {
    throw new Error("The original cash checkout was not confirmed. Check payment status; do not collect again.");
  }
  await applyPosCheckoutRecovery(row, { state: "completed", message: "Original cash checkout confirmed.",
    result: { ...result, success: true, saleId: live.data.sale_id, orderId: live.data.id } });
  const { refreshPosSyncCounts } = await import("./sync-engine");
  await refreshPosSyncCounts(siteId);
}

const flights = new Map<string, Promise<void>>();

/** Explicit cashier action, never a background retry or a new payment identity. */
export async function recoverReceivedCash(siteId: string, rowId: string): Promise<void> {
  const key = JSON.stringify([siteId, rowId]);
  let flight = flights.get(key);
  if (!flight) {
    flight = recoverOriginal(siteId, rowId).finally(() => flights.delete(key));
    flights.set(key, flight);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([flight, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Confirmation is taking longer than expected. Check payment status; do not collect again.")), 45_000);
    })]);
  } finally { clearTimeout(timer); }
}
