import { cartHasBuyerAccountItem, cartHasReservationSlot } from "@/app/pos/cart-line-utils";
import { hasPosCustomer } from "@/app/pos/lead-utils";
import { isCompleteShippingAddress, type PosShippingAddress } from "@/app/pos/shipping-address";
import type { PosCartItem } from "@/app/pos/components/CartPanel";
import type { CheckoutFulfillmentMethod } from "@/app/commerce/delivery-options";
import type { RelationSelectValue } from "@/app/components/ui/relation-select";

export type PosCheckoutGate =
  | { ok: true }
  | {
      ok: false;
      kind:
        | "origin"
        | "ship-customer"
        | "ship-address"
        | "reservation-lead"
        | "promo-lead"
        | "digital-buyer";
    };

export function getPosCheckoutGate(params: {
  cart: PosCartItem[];
  originLocationId?: string;
  fulfillment: CheckoutFulfillmentMethod;
  leadValue: RelationSelectValue | string | null;
  buyerUserId?: string | null;
  shippingAddress?: PosShippingAddress | null;
  appliedPromoRequiresLead?: boolean;
  customerConfirmed?: boolean;
}): PosCheckoutGate {
  const active = params.cart.filter((c) => c.cartQty > 0);
  if (!params.originLocationId) return { ok: false, kind: "origin" };
  if (
    params.fulfillment === "ship" &&
    !params.leadValue &&
    !params.customerConfirmed
  ) {
    return { ok: false, kind: "ship-customer" };
  }
  if (
    params.fulfillment === "ship" &&
    !isCompleteShippingAddress(params.shippingAddress)
  ) {
    return { ok: false, kind: "ship-address" };
  }
  if (
    cartHasReservationSlot(active) &&
    !hasPosCustomer(params.leadValue) &&
    !params.customerConfirmed
  ) {
    return { ok: false, kind: "reservation-lead" };
  }
  if (cartHasBuyerAccountItem(active) && !params.buyerUserId) {
    return { ok: false, kind: "digital-buyer" };
  }
  if (
    params.appliedPromoRequiresLead &&
    !params.leadValue &&
    !params.customerConfirmed
  ) {
    return { ok: false, kind: "promo-lead" };
  }
  return { ok: true };
}
