import type { LocalPendingOrder, PosOutboxRow } from "./types";
import { isRejectedLocalDraft } from "./rejected-order-projection";

/** Display-only overlay. Never write optimistic balances into the order snapshot. */
export function projectPosOrderPicker(siteId: string, orders: LocalPendingOrder[], outbox: PosOutboxRow[]) {
  const rows = outbox.filter(row => row.siteId === siteId && row.payload.kind === "checkout" &&
    row.payload.data.siteId === siteId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const aliases = new Map<string, string>();
  for (const row of rows) {
    if (row.payload.kind !== "checkout") continue;
    const local = row.payload.data.existingOrderId || `local_${row.clientMutationId}`;
    const server = row.resultOrderId || row.recoveryOrderId;
    if (server) aliases.set(local, server);
  }
  const canonical = (id: string) => aliases.get(id) || id;
  const projected = new Map(orders.filter(order => order.site_id === siteId && !isRejectedLocalDraft(order, rows))
    .map(order => [canonical(order.id), order]));

  for (const row of rows) {
    if (row.payload.kind !== "checkout") continue;
    const data = row.payload.data;
    if (row.recoveryState === "rejected") continue;
    const id = canonical(data.existingOrderId || `local_${row.clientMutationId}`);
    const order = projected.get(id);
    const payments = data.payments || [];
    if (!payments.length) continue;
    const raw = order?.raw || order;
    const sale = Array.isArray(raw?.sales) ? raw.sales[0] : raw?.sales;
    const recorded: Array<{ payment_id?: string }> = sale?.payments || [];
    // A fresh server snapshot supersedes this operation, including later refunds.
    if (row.status === "synced" && payments.every(payment => payment.paymentId &&
      recorded.some(saved => saved.payment_id === payment.paymentId))) continue;
    if (row.status === "synced" && row.pickerAmountDueAfterPayment != null && row.pickerAmountDueAfterPayment <= 0.009) {
      projected.delete(id);
      continue;
    }
    // Do not resurrect a confirmed order absent from the server's open list.
    if (row.status === "synced" && !order) continue;
    const message = row.status === "synced" ? "Payment confirmed · Updating order"
      : row.status === "failed" || row.recoveryState ? "Payment needs review · Check sync queue"
        : "Payment confirmation pending";
    const base: LocalPendingOrder = order || {
      id, site_id: siteId, status: "pending", created_at: row.createdAt,
      raw: { id, site_id: siteId, status: "pending", created_at: row.createdAt, notes: data.notes },
    };
    projected.set(id, { ...base, raw: { ...(base.raw || base),
      pos_picker_payment_pending: true, pos_picker_message: message } });
  }
  return Array.from(projected.values());
}