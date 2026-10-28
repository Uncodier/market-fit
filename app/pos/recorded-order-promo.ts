import type { LocalPromoMatch } from "./local/resolve-promo-local";
import type { PosCartItem } from "./cart-types";
import type { RelationSelectValue } from "@/app/components/ui/relation-select";

/** Compare redemption identity, not the customer picker's presentation label. */
export function posPromoOrderContext(params: {
  leadValue: RelationSelectValue | string;
  buyerUserId: string | null;
  fulfillment: string;
  originLocationId: string;
  expectedOrderVersion?: string;
}): string {
  const lead = params.leadValue;
  const customer = typeof lead === "string" ? (lead ? ["existing", lead] : null)
    : lead?.mode === "existing" ? ["existing", lead.id]
      : lead?.mode === "create" ? ["create", lead.label] : null;
  let tracksOrigin = true;
  if (params.expectedOrderVersion) {
    try {
      const baseline = JSON.parse(params.expectedOrderVersion);
      // Only an explicit original null permits first assignment. Missing or
      // malformed versions stay conservative and the server verifies all evidence.
      tracksOrigin = baseline?.origin_location_id !== null;
    } catch { /* Invalid versions remain blocked by the existing payment guard. */ }
  }
  return JSON.stringify([customer, params.buyerUserId || null, params.fulfillment,
    tracksOrigin ? params.originLocationId || null : null]);
}

export function posPromoCartFingerprint(cart: PosCartItem[], context: string): string {
  return JSON.stringify([context, cart.filter((line) => line.cartQty > 0).map((line) => [
    line.id, line.lineKey, line.currency, line.cartQty, line.cartPrice,
    line.modifiers?.map((child) => [child.catalogItemId, child.groupId, child.cartQty, child.cartPrice]),
  ])]);
}

/** Upgrade only the saved baseline, never accept the current edited cart as one. */
export function normalizePosPromoFingerprint(fingerprint: string, expectedOrderVersion?: string): string {
  try {
    const saved = JSON.parse(fingerprint);
    if (!Array.isArray(saved) || saved.length !== 2 || typeof saved[0] !== "string" || !Array.isArray(saved[1])) return fingerprint;
    const context = JSON.parse(saved[0]);
    if (!Array.isArray(context) || context.length !== 4) return fingerprint;
    const [lead, buyerUserId, fulfillment, originLocationId] = context;
    if (Array.isArray(lead)) return fingerprint;
    const validLead = lead === null || typeof lead === "string" ||
      (lead && typeof lead === "object" && (
        lead.mode === "existing" && typeof lead.id === "string" ||
        lead.mode === "create" && typeof lead.label === "string"
      ));
    if (!validLead || (buyerUserId !== null && typeof buyerUserId !== "string") ||
      typeof fulfillment !== "string" || (originLocationId !== null && typeof originLocationId !== "string")) return fingerprint;
    return JSON.stringify([posPromoOrderContext({ leadValue: lead, buyerUserId, fulfillment,
      originLocationId: originLocationId || "", expectedOrderVersion }), saved[1]]);
  } catch { return fingerprint; }
}

/** Restore a recorded discount, not a new redemption against the POS catalog. */
export function recordedPosOrderPromo(order: {
  promotion_id?: string | null;
  discount_total?: number | string | null;
  subtotal?: number | string | null;
  promotions?: { name?: string | null; code?: string | null; image_url?: string | null } | null;
}): LocalPromoMatch | null {
  const discount = Number(order.discount_total);
  const subtotal = Number(order.subtotal);
  if (!order.promotion_id || !Number.isFinite(discount) || discount <= 0 ||
    !Number.isFinite(subtotal) || subtotal < discount) return null;
  const code = order.promotions?.code?.trim() || null;
  return {
    promotionId: order.promotion_id,
    promotionName: order.promotions?.name || code || "Order promotion",
    code,
    discount,
    orderSubtotal: subtotal,
    byConditions: !!order.promotions && !code,
    imageUrl: order.promotions?.image_url || null,
  };
}