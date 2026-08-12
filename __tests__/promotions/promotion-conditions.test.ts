import {
  checkPromotionWeekday,
  checkPromotionRequiredItems,
} from "../../app/promotions/promotion-conditions";

describe("checkPromotionWeekday", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-09T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns null when no activeWeekdays are set", () => {
    expect(checkPromotionWeekday({ activeWeekdays: [] })).toBeNull();
    expect(checkPromotionWeekday({ activeWeekdays: null })).toBeNull();
  });

  it("returns null when current weekday is included", () => {
    expect(checkPromotionWeekday({ activeWeekdays: [0, 1] })).toBeNull();
  });

  it("returns error when current weekday is not included", () => {
    expect(checkPromotionWeekday({ activeWeekdays: [1, 2] })).toBe(
      "Promotion is not active today"
    );
  });
});

describe("checkPromotionRequiredItems", () => {
  const reqItems = [
    { catalog_item_id: "A", min_quantity: 2 },
    { catalog_item_id: "B", min_quantity: 1 },
  ];

  const reqCategories = [
    { catalog_category_id: "cat-drinks", min_quantity: 2 },
  ];

  it("returns null when no required items or categories", () => {
    expect(
      checkPromotionRequiredItems({ requiredItems: [], lines: [] })
    ).toBeNull();
  });

  it("mode: all - fails when missing items", () => {
    const lines = [{ catalogItemId: "A", quantity: 2 }];
    expect(
      checkPromotionRequiredItems({
        mode: "all",
        requiredItems: reqItems,
        lines,
      })
    ).toBe(
      "Order does not include all required products or categories for this promotion"
    );
  });

  it("mode: all - fails when quantity insufficient", () => {
    const lines = [
      { catalogItemId: "A", quantity: 1 },
      { catalogItemId: "B", quantity: 1 },
    ];
    expect(
      checkPromotionRequiredItems({
        mode: "all",
        requiredItems: reqItems,
        lines,
      })
    ).toBe(
      "Order does not include all required products or categories for this promotion"
    );
  });

  it("mode: all - passes when all items and quantities met", () => {
    const lines = [
      { catalogItemId: "A", quantity: 3 },
      { catalogItemId: "B", quantity: 1 },
    ];
    expect(
      checkPromotionRequiredItems({
        mode: "all",
        requiredItems: reqItems,
        lines,
      })
    ).toBeNull();
  });

  it("mode: any - fails when no items present", () => {
    const lines = [{ catalogItemId: "C", quantity: 5 }];
    expect(
      checkPromotionRequiredItems({
        mode: "any",
        requiredItems: reqItems,
        lines,
      })
    ).toBe(
      "Order must include at least one required product or category for this promotion"
    );
  });

  it("mode: any - fails when quantity insufficient for any", () => {
    const lines = [{ catalogItemId: "A", quantity: 1 }];
    expect(
      checkPromotionRequiredItems({
        mode: "any",
        requiredItems: reqItems,
        lines,
      })
    ).toBe(
      "Order must include at least one required product or category for this promotion"
    );
  });

  it("mode: any - passes when at least one item meets quantity", () => {
    const lines = [{ catalogItemId: "B", quantity: 1 }];
    expect(
      checkPromotionRequiredItems({
        mode: "any",
        requiredItems: reqItems,
        lines,
      })
    ).toBeNull();
  });

  it("defaults quantity to 1 if missing in lines", () => {
    const lines = [
      { catalogItemId: "A" },
      { catalogItemId: "A" },
      { catalogItemId: "B" },
    ];
    expect(
      checkPromotionRequiredItems({
        mode: "all",
        requiredItems: reqItems,
        lines,
      })
    ).toBeNull();
  });

  it("mode: all - requires category quantity across lines", () => {
    const lines = [
      { catalogItemId: "x", categoryId: "cat-drinks", quantity: 1 },
    ];
    expect(
      checkPromotionRequiredItems({
        mode: "all",
        requiredCategories: reqCategories,
        lines,
      })
    ).toBe(
      "Order does not include all required products or categories for this promotion"
    );

    const okLines = [
      { catalogItemId: "x", categoryId: "cat-drinks", quantity: 1 },
      { catalogItemId: "y", categoryId: "cat-drinks", quantity: 1 },
    ];
    expect(
      checkPromotionRequiredItems({
        mode: "all",
        requiredCategories: reqCategories,
        lines: okLines,
      })
    ).toBeNull();
  });

  it("mode: any - passes with category when products fail", () => {
    const lines = [
      { catalogItemId: "x", categoryId: "cat-drinks", quantity: 2 },
    ];
    expect(
      checkPromotionRequiredItems({
        mode: "any",
        requiredItems: reqItems,
        requiredCategories: reqCategories,
        lines,
      })
    ).toBeNull();
  });

  it("mode: all - requires both products and categories", () => {
    const lines = [
      { catalogItemId: "A", categoryId: "cat-drinks", quantity: 2 },
      { catalogItemId: "B", categoryId: "other", quantity: 1 },
    ];
    // drinks qty = 2 from A only — ok for category; products ok
    expect(
      checkPromotionRequiredItems({
        mode: "all",
        requiredItems: reqItems,
        requiredCategories: reqCategories,
        lines,
      })
    ).toBeNull();

    const missingCat = [
      { catalogItemId: "A", categoryId: "other", quantity: 2 },
      { catalogItemId: "B", categoryId: "other", quantity: 1 },
    ];
    expect(
      checkPromotionRequiredItems({
        mode: "all",
        requiredItems: reqItems,
        requiredCategories: reqCategories,
        lines: missingCat,
      })
    ).toBe(
      "Order does not include all required products or categories for this promotion"
    );
  });
});
