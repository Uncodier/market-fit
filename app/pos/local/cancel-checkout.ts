import { getPosDb } from "./db";
import { applyPosCheckoutRecovery } from "./checkout-recovery";
import { requirePosRemotePermission, assertPosRemotePermission } from "./remote-permission";
import { isPosPermissionCurrent } from "./location-permission-state";
import type { PosCheckoutRecovery } from "../checkout-recovery-types";

/** Cancel admission, never delete a payment or infer cancellation from a timeout. */
export async function cancelPosCheckout(siteId: string, rowId: string, reason: string): Promise<PosCheckoutRecovery> {
  const permission = requirePosRemotePermission(siteId);
  const row = await getPosDb().outbox.get(rowId);
  assertPosRemotePermission(permission);
  if (!row || row.siteId !== siteId || row.payload.kind !== "checkout" ||
    row.payload.data.userId !== permission.userId || row.status === "synced") {
    throw new Error("This operation is not available for cancellation.");
  }
  if (!reason.trim() || reason.trim().length > 500) throw new Error("Enter a cancellation reason (up to 500 characters).");
  const response = await fetch("/api/pos/checkout-cancel", {
    method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siteId, clientMutationId: row.clientMutationId, reason: reason.trim() }),
  });
  const body: { data?: PosCheckoutRecovery; error?: string; cancellationState?: string } = await response.json();
  if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed");
  if (!response.ok || body.data?.state !== "rejected" || typeof body.data.message !== "string") {
    if (response.status === 409 && body.cancellationState === "not_found") {
      throw new Error("Cancellation was not confirmed: the server has no admission record for this attempt. Older local operations cannot be cleared by the new hash protocol. Keep the queue entry and ask a manager to reconcile its mutation and payment IDs.");
    }
    if (response.status === 409 && ["writes_started", "review_required", "completed"].includes(body.cancellationState ?? "")) {
      throw new Error("Cancellation was not confirmed: this attempt has started checkout writes or already completed. The order may exist even if its link is missing. Keep it for reconciliation; do not create a replacement payment.");
    }
    throw new Error(response.status === 409
      ? "Cancellation is not safe: the operation is unknown, has started writes, or already has a payment. Check payment status; do not collect again."
      : "Cancellation could not be confirmed. Keep this operation and check payment status before trying again.");
  }
  await applyPosCheckoutRecovery(row, body.data);
  const { refreshPosSyncCounts } = await import("./sync-engine");
  await refreshPosSyncCounts(siteId);
  return body.data;
}