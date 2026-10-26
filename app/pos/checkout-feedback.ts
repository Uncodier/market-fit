"use client";

import { toast } from "sonner";
import { getPosDb } from "./local/db";
import { syncPosCheckout } from "./local/sync-engine";
import { isPosPermissionCurrent, type PosPermissionLease } from "./local/location-permission-state";
import { printAfterPosCheckout } from "./print-after-checkout";
import type { PosOutboxRow } from "./local/types";

type PrintRequest = Parameters<typeof printAfterPosCheckout>[0];
type Feedback = {
  row: PosOutboxRow;
  permission: PosPermissionLease | null;
  print: PrintRequest;
};

const observations = new Map<string, Promise<void>>();

/** A local cleanup retry may rejoin an existing receipt, but must not print it twice. */
export function confirmPosCheckoutInBackground(input: Feedback): Promise<void> {
  if (!isPosPermissionCurrent(input.permission)) return Promise.resolve();
  const { row, permission } = input;
  const key = JSON.stringify([row.siteId, row.id, row.clientMutationId, permission?.userId, permission?.generation]);
  const active = observations.get(key);
  if (active) return active;
  const observation = observeCheckout(input).finally(() => {
    if (observations.get(key) === observation) observations.delete(key);
  });
  observations.set(key, observation);
  return observation;
}

/** This receipt owns its feedback, never the active cart. The durable queue owns recovery. */
async function observeCheckout({ row, permission, print }: Feedback): Promise<void> {
  const id = `pos-checkout:${row.id}`;
  const current = () => isPosPermissionCurrent(permission);
  if (!current()) return;
  const paid = row.payload.kind === "checkout" && Boolean(row.payload.data.payments?.length);
  const review = () => toast.error(paid
    ? "Checkout needs review. Check payment status in the sync queue before collecting again."
    : "Order needs review. Open the sync queue for details.", { id, duration: 10_000 });
  toast.message("Order saved on this device. Confirming in the background…", { id });
  try {
    await syncPosCheckout(row.siteId, row.clientMutationId);
    if (!current()) return;
    const stored = await getPosDb().outbox.where("clientMutationId").equals(row.clientMutationId).first();
    if (!current()) return;
    if (!stored || stored.siteId !== row.siteId || stored.id !== row.id) { review(); return; }
    if (stored.status === "synced") {
      toast.success(stored.resultOrderNumber ? `Order ${stored.resultOrderNumber} confirmed.` : "Order confirmed.", { id });
      try {
        await printAfterPosCheckout({ ...print, orderId: stored.resultOrderId,
          orderNumber: stored.resultOrderNumber, kitchenDelta: stored.resultKitchenDelta,
          fulfillment: stored.resultFulfillment });
      } catch {
        if (current()) toast.error("Order confirmed, but printing failed. Reprint from the order.", { id });
      }
    } else if (stored.status === "failed" || stored.recoveryState) {
      review();
    } else {
      toast.message(paid
        ? "Payment confirmation is pending. Check the sync queue; do not collect it again."
        : "Order saved locally. It will sync when online.", { id, duration: 10_000 });
    }
  } catch {
    if (current()) review();
  }
}