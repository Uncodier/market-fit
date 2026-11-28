import type { PosOutboxRow } from "../local/types";
import type { PosOrderSnapshot } from "../order-snapshot";
import { QueuedOrderItems } from "./QueuedOrderItems";

export const recoveryDetails = {
  rejected: {
    label: "Rejected — no payment recorded",
    explanation: "No payment was recorded for this attempt. Reload and review the order before a new confirmation. The rejected attempt stays in the queue for audit.",
  },
  payment_recorded: {
    label: "Payment recorded — checkout not confirmed complete",
    explanation: "Payment recorded does not mean the full checkout completed. Do not charge again. Keep this attempt for manager review of the remaining checkout steps.",
  },
  review_required: {
    label: "Review required — payment status needs review",
    explanation: "Full checkout completion is not confirmed; do not assume the payment failed. Check payment status or ask a manager to review. Do not collect this payment again.",
  },
};

export function checkoutReviewOrderId(row: PosOutboxRow): string | undefined {
  const existingId = row.payload.kind === "checkout" ? row.payload.data.existingOrderId : undefined;
  return [row.recoveryOrderId, row.resultOrderId, existingId]
    .find((id): id is string => Boolean(id && !id.startsWith("local_")));
}

export function PosCheckoutRecoveryDetails({ row, order, currency }: {
  row: PosOutboxRow; order?: PosOrderSnapshot | null; currency?: string | null;
}) {
  if (row.payload.kind !== "checkout") return null;
  const checkout = row.payload.data;
  const recovery = row.status === "synced" ? {
    label: "Checkout completion confirmed",
    explanation: "The original attempt is synchronized. Do not collect the same payment again.",
  } : row.status === "pending" || row.status === "syncing" ? {
    label: "Checkout waiting for synchronization",
    explanation: "Keep the original queued operation. Do not enter the same payment again.",
  } : recoveryDetails[row.recoveryState ?? "review_required"];
  const paymentTotal = (checkout.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0);
  const methods = [...new Set(checkout.payments?.map((payment) => payment.method) ?? [])];
  return <section className="space-y-3 text-sm" aria-label="Queued checkout attempt">
    <div className="space-y-1">
      <h3 className="font-semibold">{recovery.label}</h3>
      <p>{recovery.explanation}</p>
      {row.recoveryMessage && <p>{row.recoveryMessage}</p>}
    </div>
    <dl className="space-y-1 break-words">
      {[
        ["Queue row ID", row.id], ["Client mutation ID", row.clientMutationId],
        ["Queue status", row.status], ["Existing order ID", checkout.existingOrderId],
        ["Recovery order ID", row.recoveryOrderId], ["Result order ID", row.resultOrderId],
        ["Recovery sale ID", row.recoverySaleId], ["Queued items", String(checkout.lines.length)],
        ["Queued payment total", [currency, paymentTotal.toFixed(2)].filter(Boolean).join(" ")],
        ["Payment method", methods.join(", ") || checkout.paymentMethod || "None"],
      ].map(([name, value]) => <div key={name}>
        <dt className="inline font-medium">{name}: </dt><dd className="inline">{value || "Not available"}</dd>
      </div>)}
    </dl>
    {checkout.lines.length > 0 && <QueuedOrderItems siteId={row.siteId} lines={checkout.lines} order={order} />}
    {row.lastError && <p className="text-destructive">{row.lastError}</p>}
  </section>;
}