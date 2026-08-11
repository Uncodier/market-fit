import { resolvePromotionDiscountLocal } from "@/app/pos/local/resolve-promo-local";
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
      applies_to: "selected",
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
});
