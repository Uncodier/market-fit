import {
  cartHasReservationSlot,
  cartHasBuyerAccountItem,
  cartWithDiscountPercent,
  cartWithPrice,
  cartWithQtyDelta,
} from "@/app/pos/cart-line-utils";

describe("cartHasReservationSlot", () => {
  it("is false for empty or non-reservation carts", () => {
    expect(cartHasReservationSlot([])).toBe(false);
    expect(cartHasReservationSlot([{ cartQty: 1 }])).toBe(false);
    expect(
      cartHasReservationSlot([{ cartQty: 0, reservationStart: "2026-08-13T18:00:00.000Z" }]),
    ).toBe(false);
  });

  it("is true when an active line has a reservation start", () => {
    expect(
      cartHasReservationSlot([
        { cartQty: 1, reservationStart: "2026-08-13T18:00:00.000Z" },
      ]),
    ).toBe(true);
  });
});

describe("cartHasBuyerAccountItem", () => {
  it("is false without digital or recurring lines", () => {
    expect(cartHasBuyerAccountItem([])).toBe(false);
    expect(cartHasBuyerAccountItem([{ cartQty: 1, kind: "product" }])).toBe(
      false,
    );
  });

  it("is true for digital assets and recurring plans", () => {
    expect(
      cartHasBuyerAccountItem([{ cartQty: 1, kind: "digital_asset" }]),
    ).toBe(true);
    expect(
      cartHasBuyerAccountItem([{ cartQty: 1, kind: "service", is_recurring: true }]),
    ).toBe(true);
  });
});

describe("cart line edits", () => {
  const line = { id: "a", lineKey: "line-a", cartQty: 2, cartPrice: 80 };

  it("applies a percent off the selected line without compounding", () => {
    const once = cartWithDiscountPercent([line] as any, "line-a", 10);
    expect(once[0]).toMatchObject({
      cartPrice: 72,
      cartListPrice: 80,
      cartDiscountPercent: 10,
      cartQty: 2,
    });
    const twice = cartWithDiscountPercent(once, "line-a", 25);
    expect(twice[0]).toMatchObject({
      cartPrice: 60,
      cartListPrice: 80,
      cartDiscountPercent: 25,
    });
  });

  it("clears the line discount when price is overridden", () => {
    const discounted = cartWithDiscountPercent([line] as any, "line-a", 10);
    const priced = cartWithPrice(discounted, "line-a", 50);
    expect(priced[0]).toMatchObject({
      cartPrice: 50,
      cartListPrice: 50,
      cartDiscountPercent: 0,
    });
  });

  it("removes the line when qty delta reaches zero", () => {
    expect(cartWithQtyDelta([line] as any, "line-a", -2)).toEqual([]);
  });
});
