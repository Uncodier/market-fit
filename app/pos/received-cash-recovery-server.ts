import "server-only";
import type { CheckoutCartParams } from "@/app/commerce/checkout-types";
import { inPosOperationScope } from "./checkout-request-access";
import { PosCheckoutRecoveryError } from "./checkout-recovery-types";

export const receivedCashReview = () => new PosCheckoutRecoveryError({ state: "review_required",
  message: "Preserve the original cash receipt for review. Do not collect it again." });

/** This shape historically reached the atomic existing-order RPC without business writes.
 * In particular environment preparation may create/link a lead, and quote or
 * reservation preparation is not admitted. Only the validated operation transport
 * may enter (not a direct call to the checkout Server Action).
 */
export function assertReceivedCashDispatch(p: CheckoutCartParams) {
  if (!inPosOperationScope() || p.source !== "pos" || !p.existingOrderId || !p.expectedOrderVersion ||
    !p.clientMutationId || !p.registerSessionId || !p.originLocationId || !["pay", "complete"].includes(p.intent || "") ||
    !(p.promotionId || p.promotionCode?.trim()) || p.payments?.length !== 1 || p.payments[0].method !== "cash" ||
    !p.payments[0].paymentId || (!p.leadId && p.customerName && p.customerEmail) || p.existingReservationId ||
    p.selfServiceLocationId || p.quotationId || p.lines.some(l => l.reservationStart || l.reservationEnd)) {
    throw receivedCashReview();
  }
}