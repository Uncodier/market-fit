"use client";

import { isPosPermissionCurrent, type PosPermissionLease } from "./local/location-permission-state";
import type { PosOutboxRow } from "./local/types";
import { printAfterPosCheckout } from "./print-after-checkout";

/** Attempt once per durable payment, including reloads and cleanup retries.
 * Claim before dispatch: an interrupted write may already have reached paper.
 * A skipped/partial print is available through explicit manual reprint, not replay.
 */
export async function printLocalPosReceipt(input: {
  row: PosOutboxRow;
  permission: PosPermissionLease | null;
  print: Parameters<typeof printAfterPosCheckout>[0];
}): Promise<void> {
  const { row, permission, print } = input;
  if (row.payload.kind !== "checkout" || !row.payload.data.payments?.length ||
    (row.status !== "synced" && (row.status === "failed" || row.recoveryState))) return;
  const key = `pos-receipt-attempt:${JSON.stringify([row.siteId, row.payload.data.userId, row.clientMutationId])}`;
  try {
    if (!isPosPermissionCurrent(permission) || !navigator.locks) return;
    const claimed = await navigator.locks.request(key, { mode: "exclusive" }, async () => {
      if (!isPosPermissionCurrent(permission) || localStorage.getItem(key)) return false;
      localStorage.setItem(key, "attempted");
      return localStorage.getItem(key) === "attempted";
    });
    if (!claimed || !isPosPermissionCurrent(permission)) return;
    const pending = row.status !== "synced";
    await printAfterPosCheckout({
      ...print,
      kitchenDelta: null,
      skipReceipt: false,
      receiptJobId: `receipt-${row.clientMutationId}`,
      orderId: pending ? null : row.resultOrderId,
      orderNumber: pending ? null : row.resultOrderNumber,
      createdAt: row.createdAt,
      receipt: {
        ...print.receipt,
        confirmationPending: pending,
        localReference: row.clientMutationId,
        orderNumber: pending ? null : row.resultOrderNumber,
        qrValue: pending ? null : row.resultOrderNumber,
      },
    });
  } catch {
    // Unavailable hardware/storage must never fail checkout or trigger a replay.
  }
}