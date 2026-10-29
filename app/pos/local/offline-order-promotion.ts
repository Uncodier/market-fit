import type { PosCartItem } from "../cart-types";
import { posCartLineSubtotal } from "../cart-totals";
import { recordedPosOrderPromo } from "../recorded-order-promo";
import { evaluatePromotionLocal } from "./resolve-promo-local";
import type { LocalPromotion } from "./types";

/** Restore the requested promotion only; never substitute another automatic offer. */
export function offlineOrderPromotion(order: Record<string, unknown>, cart: PosCartItem[],
  promotions: LocalPromotion[], currency: string, rates: Record<string, number>, timezone: string | null) {
  const recorded = recordedPosOrderPromo(order);
  const code = typeof order.local_promotion_code === "string" ? order.local_promotion_code.trim() : "";
  const id = typeof order.local_promotion_id === "string" ? order.local_promotion_id : "";
  if (recorded && (!id || recorded.promotionId === id) &&
    (!code || recorded.code?.toUpperCase() === code.toUpperCase())) return recorded;
  if (!code && !id) return null;
  const promo = promotions.find(candidate => candidate.site_id === order.site_id &&
    (id ? candidate.id === id : candidate.code?.trim().toUpperCase() === code.toUpperCase()));
  if (!promo || (code && promo.code?.trim().toUpperCase() !== code.toUpperCase())) {
    throw new Error("The saved promotion is unavailable offline. Reconnect to restore this order without losing its discount.");
  }
  const result = evaluatePromotionLocal({ promo,
    lines: cart.map(line => ({ catalogItemId: line.id, categoryId: line.category_id,
      quantity: line.cartQty, subtotal: posCartLineSubtotal(line, currency, rates) })),
    locationId: typeof order.origin_location_id === "string" ? order.origin_location_id : null,
    timezone,
  });
  if ("error" in result) throw new Error(`The saved promotion needs review: ${result.error}`);
  return result.data;
}