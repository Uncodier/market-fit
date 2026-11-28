import { isPosOpenOrder } from "../open-orders";
import type { PosOrderSnapshot } from "../order-snapshot";
import { posOrderMatchesVersion } from "../order-version";
import type { PosOutboxRow } from "./types";

/** Presentation only. Admission, original fingerprint and receipt checks belong to the server. */
export function isReceivedCashReviewCandidate(row: PosOutboxRow | null): boolean {
  if (!row || row.payload.kind !== "checkout" || row.status !== "failed" ||
    row.recoveryState !== "review_required" || row.resultSaleId || row.recoverySaleId) return false;
  const data = row.payload.data;
  const payments = data.payments ?? [];
  return data.source === "pos" && data.siteId === row.siteId && data.clientMutationId === row.clientMutationId &&
    !!data.existingOrderId && !data.existingOrderId.startsWith("local_") && !data.localLeadId &&
    (!row.recoveryOrderId || row.recoveryOrderId === data.existingOrderId) &&
    (data.intent === "pay" || data.intent === "complete") && !!data.registerSessionId && !!data.originLocationId &&
    !!(data.promotionId || data.promotionCode?.trim()) && !data.existingReservationId &&
    !data.lines.some(line => line.reservationStart || line.reservationEnd) &&
    !(data.customerEmail && data.customerName && !data.leadId) &&
    payments.length === 1 && payments[0].method === "cash" && !!payments[0].paymentId &&
    Number.isFinite(payments[0].amount) && payments[0].amount > 0 && !!data.expectedOrderVersion;
}

export function canReviewReceivedCash(row: PosOutboxRow | null, order: PosOrderSnapshot | null): boolean {
  if (!isReceivedCashReviewCandidate(row) || row?.payload.kind !== "checkout" || !order) return false;
  const data = row.payload.data;
  return order.site_id === row.siteId && order.id === data.existingOrderId &&
    !!order.currency && order.sales?.source === "shop" && order.sales.status === "pending" &&
    !!order.promotion_id && Number(order.discount_total) > 0 &&
    isPosOpenOrder(order) && Number(order.sales.amount_due) === Number(order.total) && Number(order.total) > 0 &&
    Array.isArray(order.sales.payments) && !order.sales.payments.length &&
    !order.sale_order_items?.some(line => line.metadata?.self_service === true) &&
    !!data.expectedOrderVersion && posOrderMatchesVersion(order, data.expectedOrderVersion);
}
