import { getPosCheckoutGate } from "@/app/pos/checkout-gates";
import { EMPTY_POS_SHIPPING_ADDRESS } from "@/app/pos/shipping-address";

const base = {
  cart: [{ cartQty: 1, kind: "product" } as any],
  originLocationId: "loc-1",
  fulfillment: "dine_in" as const,
  leadValue: null,
  buyerUserId: null,
  shippingAddress: EMPTY_POS_SHIPPING_ADDRESS,
};

describe("getPosCheckoutGate", () => {
  it("requires origin, shipping address, digital buyer, and reservation lead", () => {
    expect(getPosCheckoutGate({ ...base, originLocationId: "" })).toEqual(
      { ok: false, kind: "origin" },
    );
    expect(
      getPosCheckoutGate({
        ...base,
        fulfillment: "ship",
        leadValue: "lead-1",
      }),
    ).toEqual({ ok: false, kind: "ship-address" });
    expect(
      getPosCheckoutGate({
        ...base,
        cart: [{ cartQty: 1, kind: "digital_asset" } as any],
      }),
    ).toEqual({ ok: false, kind: "digital-buyer" });
    expect(
      getPosCheckoutGate({
        ...base,
        cart: [
          {
            cartQty: 1,
            kind: "service",
            reservationStart: "2026-08-13T18:00:00.000Z",
          } as any,
        ],
      }),
    ).toEqual({ ok: false, kind: "reservation-lead" });
  });
});
