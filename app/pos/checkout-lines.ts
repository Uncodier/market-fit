import type { CheckoutLine } from "@/app/commerce/checkout";
import type { PosCartItem } from "@/app/pos/cart-types";

export function posCheckoutLines(cart: PosCartItem[]): CheckoutLine[] {
  return cart.filter((item) => item.cartQty > 0).map((item) => ({
    catalogItemId: item.id,
    quantity: item.cartQty,
    unitPriceOverride: item.cartPrice,
    saleOrderItemId: item.saleOrderItemId,
    reservationStart: item.reservationStart,
    reservationEnd: item.reservationEnd,
    clientLineKey: item.lineKey || item.id,
    modifiers: (item.modifiers || []).map((modifier) => ({
      catalogItemId: modifier.catalogItemId,
      quantity: modifier.cartQty,
      unitPriceOverride: modifier.cartPrice,
      saleOrderItemId: modifier.saleOrderItemId,
      groupId: modifier.groupId,
    })),
  }));
}