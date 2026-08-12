import {
  isPromotionAvailableForStorefront,
  isPromotionCurrentlyRunnable,
  isPromotionEligibleForStorefront,
} from "@/app/promotions/promotion-availability";
import {
  placeMarketplaceMerchandising,
  placeShopMerchandising,
  promoBadgeLabel,
} from "@/app/promotions/promotion-merchandising";

const base = {
  id: "p1",
  status: "active",
  channels: ["shop", "marketplace"],
  show_on_shop: true,
  show_on_marketplace: true,
  discount_type: "percent",
  discount_value: 20,
  name: "Twenty",
};

describe("isPromotionEligibleForStorefront", () => {
  it("requires show flag and active status, ignores weekdays", () => {
    expect(
      isPromotionEligibleForStorefront({
        promo: { ...base, show_on_marketplace: false },
        surface: "marketplace",
      }),
    ).toBe(false);
    expect(
      isPromotionEligibleForStorefront({
        promo: { ...base, active_weekdays: [1], status: "active" },
        surface: "marketplace",
      }),
    ).toBe(true);
    expect(
      isPromotionEligibleForStorefront({
        promo: { ...base, status: "paused" },
        surface: "marketplace",
      }),
    ).toBe(false);
  });
});

describe("isPromotionAvailableForStorefront", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-11T12:00:00Z")); // Tuesday
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("requires show flag for surface", () => {
    expect(
      isPromotionAvailableForStorefront({
        promo: { ...base, show_on_shop: false },
        surface: "shop",
      }),
    ).toBe(false);
    expect(
      isPromotionAvailableForStorefront({
        promo: { ...base, show_on_marketplace: false },
        surface: "marketplace",
      }),
    ).toBe(false);
  });

  it("rejects inactive and expired", () => {
    expect(
      isPromotionAvailableForStorefront({
        promo: { ...base, status: "paused" },
        surface: "shop",
      }),
    ).toBe(false);
    expect(
      isPromotionAvailableForStorefront({
        promo: { ...base, ends_at: "2026-08-01T00:00:00Z" },
        surface: "shop",
      }),
    ).toBe(false);
  });

  it("enforces weekday availability", () => {
    expect(
      isPromotionAvailableForStorefront({
        promo: { ...base, active_weekdays: [1, 3] },
        surface: "shop",
      }),
    ).toBe(false);
    expect(
      isPromotionAvailableForStorefront({
        promo: { ...base, active_weekdays: [2] },
        surface: "shop",
      }),
    ).toBe(true);
    expect(
      isPromotionCurrentlyRunnable({
        promo: { ...base, active_weekdays: [1] },
      }),
    ).toBe(false);
  });
});

describe("placeShopMerchandising", () => {
  it("splits general, item flags, and category cards", () => {
    const placement = placeShopMerchandising({
      promotions: [
        { ...base, id: "g1", applies_to: "all" },
        {
          ...base,
          id: "i1",
          applies_to: "selected_items",
          catalog_item_ids: ["item-a"],
          category_ids: [],
        },
        {
          ...base,
          id: "c1",
          applies_to: "selected_items",
          catalog_item_ids: [],
          category_ids: ["cat-1"],
        },
      ],
      hrefFor: (id) => `/shop/x/promo/${id}`,
    });

    expect(placement.general.map((p) => p.id)).toEqual(["g1"]);
    expect(placement.byItemId["item-a"]?.promotionId).toBe("i1");
    expect(placement.byItemId["item-a"]?.label).toContain("20");
    expect(placement.byCategoryId["cat-1"]?.[0]?.id).toBe("c1");
  });
});

describe("placeMarketplaceMerchandising", () => {
  it("puts all available promos in discounts feed and flags item-specific", () => {
    const placement = placeMarketplaceMerchandising({
      promotions: [
        { ...base, id: "g1", applies_to: "all" },
        {
          ...base,
          id: "i1",
          applies_to: "selected_items",
          catalog_item_ids: ["item-a"],
        },
        {
          ...base,
          id: "c1",
          applies_to: "selected_items",
          catalog_item_ids: [],
          category_ids: ["cat-1"],
        },
      ],
      hrefFor: (id) => `/marketplace/promo/${id}`,
    });

    expect(placement.discountsFeed.map((p) => p.id).sort()).toEqual([
      "c1",
      "g1",
      "i1",
    ]);
    expect(placement.byItemId["item-a"]?.promotionId).toBe("i1");
    expect(placement.byItemId["item-b"]).toBeUndefined();
  });
});

describe("promoBadgeLabel", () => {
  it("formats percent fixed and bogo", () => {
    expect(promoBadgeLabel({ ...base, discount_type: "percent", discount_value: 15 })).toBe(
      "15% OFF",
    );
    expect(promoBadgeLabel({ ...base, discount_type: "fixed", discount_value: 5 })).toBe(
      "$5 OFF",
    );
    expect(
      promoBadgeLabel({
        ...base,
        discount_type: "bogo",
        bogo_buy_qty: 1,
        bogo_get_qty: 1,
      }),
    ).toBe("2x1");
  });
});
