import {
  displayPromotionUsageCount,
  mapPromotionRedemption,
} from "../../app/promotions/redemption-map";

describe("mapPromotionRedemption", () => {
  it("flattens nested promotion and lead relations", () => {
    const mapped = mapPromotionRedemption({
      id: "ord-1",
      order_number: "POS-12",
      created_at: "2026-08-12T18:00:00.000Z",
      discount_total: "15.5",
      total: "40",
      currency: "MXN",
      status: "completed",
      promotion_id: "promo-1",
      promotions: { name: "2x1 en papas", code: "PAPAS" },
      sales: { source: "pos", leads: { name: "Ana" } },
    });

    expect(mapped).toEqual({
      id: "ord-1",
      orderNumber: "POS-12",
      createdAt: "2026-08-12T18:00:00.000Z",
      discountTotal: 15.5,
      total: 40,
      currency: "MXN",
      status: "completed",
      promotionId: "promo-1",
      promotionName: "2x1 en papas",
      promotionCode: "PAPAS",
      customerName: "Ana",
      source: "pos",
    });
  });

  it("accepts array-shaped supabase joins", () => {
    const mapped = mapPromotionRedemption({
      id: "ord-2",
      order_number: "POS-13",
      created_at: "2026-08-12T18:01:00.000Z",
      discount_total: 0,
      total: 20,
      currency: null,
      status: "pending",
      promotion_id: "promo-1",
      promotions: [{ name: "2x1 en papas", code: null }],
      sales: [{ source: "shop", leads: [{ name: "Luis" }] }],
    });

    expect(mapped.currency).toBe("USD");
    expect(mapped.promotionCode).toBeNull();
    expect(mapped.customerName).toBe("Luis");
    expect(mapped.source).toBe("shop");
  });
});

describe("displayPromotionUsageCount", () => {
  it("uses the higher of stored usage and listed redemptions", () => {
    expect(displayPromotionUsageCount(0, 4)).toBe(4);
    expect(displayPromotionUsageCount(7, 2)).toBe(7);
    expect(displayPromotionUsageCount(null, 0)).toBe(0);
  });
});
