import {
  findMatchingConditionPromotionLocal,
  promotionRequiresIdentifiableBuyer,
  resolvePromotionDiscountLocal,
} from "@/app/pos/local/resolve-promo-local";
import type { LocalPromotion } from "@/app/pos/local/types";

const basePromo: LocalPromotion = {
  id: "promo-1",
  site_id: "site-1",
  name: "Ten Off",
  code: "TEN",
  status: "active",
  discount_type: "percent",
  discount_value: 10,
  applies_to: "all",
  channels: ["pos"],
  location_ids: [],
};

describe("resolvePromotionDiscountLocal", () => {
  it("applies percent discount to all lines", () => {
    const res = resolvePromotionDiscountLocal({
      code: "ten",
      promotions: [basePromo],
      lines: [
        { catalogItemId: "a", subtotal: 50 },
        { catalogItemId: "b", subtotal: 50 },
      ],
      locationId: "loc-1",
    });
    expect("data" in res && res.data.discount).toBe(10);
  });

  it("includes per-user usage limit on the match", () => {
    const promo: LocalPromotion = {
      ...basePromo,
      usage_limit_per_user: 1,
    };
    const res = resolvePromotionDiscountLocal({
      code: "TEN",
      promotions: [promo],
      lines: [{ catalogItemId: "a", subtotal: 100 }],
    });
    expect("data" in res && res.data.usageLimitPerUser).toBe(1);
  });

  it("rejects inactive codes", () => {
    const res = resolvePromotionDiscountLocal({
      code: "NOPE",
      promotions: [basePromo],
      lines: [{ catalogItemId: "a", subtotal: 50 }],
    });
    expect("error" in res).toBe(true);
  });

  it("scopes item-level promos", () => {
    const promo: LocalPromotion = {
      ...basePromo,
      applies_to: "selected_items",
      catalog_item_ids: ["a"],
      category_ids: [],
    };
    const res = resolvePromotionDiscountLocal({
      code: "TEN",
      promotions: [promo],
      lines: [
        { catalogItemId: "a", subtotal: 80 },
        { catalogItemId: "b", subtotal: 20 },
      ],
    });
    expect("data" in res && res.data.discount).toBe(8);
  });

  it("treats selected_items with no targets as entire order", () => {
    const promo: LocalPromotion = {
      ...basePromo,
      applies_to: "selected_items",
      catalog_item_ids: [],
      category_ids: [],
    };
    const res = resolvePromotionDiscountLocal({
      code: "TEN",
      promotions: [promo],
      lines: [
        { catalogItemId: "a", subtotal: 80 },
        { catalogItemId: "b", subtotal: 20 },
      ],
    });
    expect("data" in res && res.data.discount).toBe(10);
  });

  it("auto-matches required category condition promos", () => {
    const promo: LocalPromotion = {
      ...basePromo,
      id: "papas-2x1",
      name: "2x1 en papas",
      code: null,
      discount_type: "percent",
      discount_value: 50,
      required_items_mode: "all",
      required_categories: [
        { catalog_category_id: "papigs", min_quantity: 2 },
      ],
    };
    const match = findMatchingConditionPromotionLocal({
      promotions: [promo],
      lines: [
        {
          catalogItemId: "boneless",
          categoryId: "papigs",
          subtotal: 240,
          quantity: 2,
        },
      ],
      locationId: "loc-1",
    });
    expect(match).toMatchObject({
      promotionId: "papas-2x1",
      discount: 120,
      byConditions: true,
    });
  });

  it("applies BOGO 2x1 with cheapest free (3 units → 1 free)", () => {
    const promo: LocalPromotion = {
      ...basePromo,
      id: "bogo-papas",
      name: "2x1 papas",
      code: "BOGO",
      discount_type: "bogo",
      discount_value: 0,
      bogo_buy_qty: 1,
      bogo_get_qty: 1,
      applies_to: "selected_items",
      catalog_item_ids: [],
      category_ids: ["papigs"],
    };
    const res = resolvePromotionDiscountLocal({
      code: "BOGO",
      promotions: [promo],
      lines: [
        {
          catalogItemId: "a",
          categoryId: "papigs",
          subtotal: 80,
          quantity: 1,
        },
        {
          catalogItemId: "b",
          categoryId: "papigs",
          subtotal: 100,
          quantity: 1,
        },
        {
          catalogItemId: "c",
          categoryId: "papigs",
          subtotal: 120,
          quantity: 1,
        },
        {
          catalogItemId: "drink",
          categoryId: "drinks",
          subtotal: 40,
          quantity: 1,
        },
      ],
    });
    expect("data" in res && res.data.discount).toBe(80);
  });

  it("rejects BOGO when only one eligible unit", () => {
    const promo: LocalPromotion = {
      ...basePromo,
      code: "BOGO",
      discount_type: "bogo",
      discount_value: 0,
      bogo_buy_qty: 1,
      bogo_get_qty: 1,
    };
    const res = resolvePromotionDiscountLocal({
      code: "BOGO",
      promotions: [promo],
      lines: [{ catalogItemId: "a", subtotal: 100, quantity: 1 }],
    });
    expect(res).toEqual({
      error: "Not enough eligible items for this promotion",
    });
  });

  it("rejects if weekday is restricted", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-11T12:00:00Z")); // Tuesday
    const promo: LocalPromotion = {
      ...basePromo,
      active_weekdays: [1, 3], // Mon, Wed
    };
    const res = resolvePromotionDiscountLocal({
      code: "TEN",
      promotions: [promo],
      lines: [{ catalogItemId: "a", subtotal: 100 }],
    });
    expect(res).toEqual({ error: "Promotion is not active today" });
    jest.useRealTimers();
  });

  it("checks required products", () => {
    const promo: LocalPromotion = {
      ...basePromo,
      required_items_mode: "all",
      required_items: [{ catalog_item_id: "req-1", min_quantity: 2 }],
    };

    let res = resolvePromotionDiscountLocal({
      code: "TEN",
      promotions: [promo],
      lines: [{ catalogItemId: "a", subtotal: 100, quantity: 1 }],
    });
    expect("error" in res).toBe(true);

    res = resolvePromotionDiscountLocal({
      code: "TEN",
      promotions: [promo],
      lines: [
        { catalogItemId: "a", subtotal: 100, quantity: 1 },
        { catalogItemId: "req-1", subtotal: 50, quantity: 2 },
      ],
    });
    expect("data" in res && res.data.discount).toBe(15);
  });
});

describe("findMatchingConditionPromotionLocal", () => {
  const autoPromo: LocalPromotion = {
    id: "auto-1",
    site_id: "site-1",
    name: "Combo Deal",
    code: null,
    status: "active",
    discount_type: "fixed",
    discount_value: 5,
    applies_to: "all",
    channels: ["pos"],
    location_ids: [],
    required_items_mode: "all",
    required_items: [{ catalog_item_id: "combo-a", min_quantity: 1 }],
  };

  it("returns null when no automatic promos match", () => {
    const match = findMatchingConditionPromotionLocal({
      promotions: [autoPromo, basePromo],
      lines: [{ catalogItemId: "other", subtotal: 20, quantity: 1 }],
      locationId: "loc-1",
    });
    expect(match).toBeNull();
  });

  it("matches codeless promo when required items are present", () => {
    const match = findMatchingConditionPromotionLocal({
      promotions: [autoPromo, basePromo],
      lines: [
        { catalogItemId: "combo-a", subtotal: 30, quantity: 1 },
        { catalogItemId: "other", subtotal: 20, quantity: 1 },
      ],
      locationId: "loc-1",
    });
    expect(match).toMatchObject({
      promotionId: "auto-1",
      promotionName: "Combo Deal",
      discount: 5,
      byConditions: true,
      code: null,
    });
  });

  it("picks the largest matching automatic discount", () => {
    const bigger: LocalPromotion = {
      ...autoPromo,
      id: "auto-2",
      name: "Bigger Deal",
      discount_value: 12,
    };
    const match = findMatchingConditionPromotionLocal({
      promotions: [autoPromo, bigger],
      lines: [{ catalogItemId: "combo-a", subtotal: 100, quantity: 1 }],
      locationId: "loc-1",
    });
    expect(match?.promotionId).toBe("auto-2");
    expect(match?.discount).toBe(12);
  });
});

describe("promotionRequiresIdentifiableBuyer", () => {
  it("is true when limited to one use per user", () => {
    expect(promotionRequiresIdentifiableBuyer(1)).toBe(true);
  });

  it("is true for any positive per-user limit", () => {
    expect(promotionRequiresIdentifiableBuyer(2)).toBe(true);
  });

  it("is false when unlimited", () => {
    expect(promotionRequiresIdentifiableBuyer(null)).toBe(false);
    expect(promotionRequiresIdentifiableBuyer(undefined)).toBe(false);
    expect(promotionRequiresIdentifiableBuyer(0)).toBe(false);
  });
});
