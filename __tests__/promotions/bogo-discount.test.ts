import {
  computeBogoDiscount,
  formatBogoLabel,
  formatPromotionDiscountLabel,
  lineUnitPrice,
} from "@/app/promotions/bogo-discount";

describe("computeBogoDiscount", () => {
  it("gives 1 free for 2 units (classic 2x1)", () => {
    const discount = computeBogoDiscount(
      [{ unitPrice: 120, quantity: 2, eligible: true }],
      1,
      1
    );
    expect(discount).toBe(120);
  });

  it("gives only 1 free for 3 units (odd unit is paid)", () => {
    const discount = computeBogoDiscount(
      [{ unitPrice: 120, quantity: 3, eligible: true }],
      1,
      1
    );
    expect(discount).toBe(120);
  });

  it("gives 2 free for 4 units", () => {
    const discount = computeBogoDiscount(
      [{ unitPrice: 100, quantity: 4, eligible: true }],
      1,
      1
    );
    expect(discount).toBe(200);
  });

  it("uses cheapest unit prices first across mixed lines", () => {
    const discount = computeBogoDiscount(
      [
        { unitPrice: 120, quantity: 1, eligible: true },
        { unitPrice: 100, quantity: 1, eligible: true },
        { unitPrice: 80, quantity: 1, eligible: true },
      ],
      1,
      1
    );
    expect(discount).toBe(80);
  });

  it("ignores ineligible lines", () => {
    const discount = computeBogoDiscount(
      [
        { unitPrice: 50, quantity: 2, eligible: true },
        { unitPrice: 200, quantity: 2, eligible: false },
      ],
      1,
      1
    );
    expect(discount).toBe(50);
  });

  it("supports Buy 2 Get 1", () => {
    // 3 units → 1 free (cheapest)
    expect(
      computeBogoDiscount(
        [
          { unitPrice: 30, quantity: 1, eligible: true },
          { unitPrice: 40, quantity: 1, eligible: true },
          { unitPrice: 50, quantity: 1, eligible: true },
        ],
        2,
        1
      )
    ).toBe(30);

    // 5 units → 1 free; 6 units → 2 free
    expect(
      computeBogoDiscount(
        [{ unitPrice: 10, quantity: 5, eligible: true }],
        2,
        1
      )
    ).toBe(10);
    expect(
      computeBogoDiscount(
        [{ unitPrice: 10, quantity: 6, eligible: true }],
        2,
        1
      )
    ).toBe(20);
  });

  it("returns 0 when not enough units", () => {
    expect(
      computeBogoDiscount(
        [{ unitPrice: 100, quantity: 1, eligible: true }],
        1,
        1
      )
    ).toBe(0);
  });
});

describe("formatBogoLabel", () => {
  it("formats 2x1 and Buy X Get Y", () => {
    expect(formatBogoLabel(1, 1)).toBe("2x1");
    expect(formatBogoLabel(2, 1)).toBe("Buy 2 Get 1");
  });
});

describe("formatPromotionDiscountLabel", () => {
  it("handles percent, fixed, and bogo", () => {
    expect(
      formatPromotionDiscountLabel({ discount_type: "percent", discount_value: 15 })
    ).toBe("15% OFF");
    expect(
      formatPromotionDiscountLabel({ discount_type: "fixed", discount_value: 20 })
    ).toBe("$20 OFF");
    expect(
      formatPromotionDiscountLabel({
        discount_type: "bogo",
        bogo_buy_qty: 1,
        bogo_get_qty: 1,
      })
    ).toBe("2x1");
  });

  it("localizes OFF labels via translator", () => {
    const t = (key: string, params?: Record<string, string | number>) => {
      const templates: Record<string, string> = {
        "promotions.badge.percentOff": "{{value}}% de descuento",
        "promotions.badge.fixedOff": "${{value}} de descuento",
        "promotions.badge.buyGet": "Compra {{buy}} llévate {{get}}",
      };
      const raw = templates[key] || key;
      if (!params) return raw;
      return Object.entries(params).reduce(
        (text, [name, value]) =>
          text.replace(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, "g"), String(value)),
        raw,
      );
    };
    expect(
      formatPromotionDiscountLabel(
        { discount_type: "percent", discount_value: 20 },
        t,
      ),
    ).toBe("20% de descuento");
    expect(
      formatPromotionDiscountLabel(
        { discount_type: "fixed", discount_value: 5 },
        t,
      ),
    ).toBe("$5 de descuento");
    expect(
      formatPromotionDiscountLabel(
        { discount_type: "bogo", bogo_buy_qty: 2, bogo_get_qty: 1 },
        t,
      ),
    ).toBe("Compra 2 llévate 1");
  });
});

describe("lineUnitPrice", () => {
  it("divides subtotal by quantity", () => {
    expect(lineUnitPrice(240, 2)).toBe(120);
    expect(lineUnitPrice(100, null)).toBe(100);
  });
});
