import { buildPromoDetailFacts } from "@/app/promotions/promo-detail-facts";

const t = (key: string, params?: Record<string, string | number>) => {
  const map: Record<string, string> = {
    "common.days.short.sun": "Sun",
    "common.days.short.mon": "Mon",
    "common.days.short.tue": "Tue",
    "common.days.short.wed": "Wed",
    "common.days.short.thu": "Thu",
    "common.days.short.fri": "Fri",
    "common.days.short.sat": "Sat",
    "shop.promo.fact.validDays": `Valid on ${params?.days}`,
    "shop.promo.fact.validFromTo": `Valid ${params?.from} – ${params?.to}`,
    "shop.promo.fact.validFrom": `Valid from ${params?.from}`,
    "shop.promo.fact.validUntil": `Valid until ${params?.to}`,
    "shop.promo.fact.minOrder": `Minimum order ${params?.amount}`,
    "shop.promo.fact.usageLimit": `Limited to ${params?.count} total uses`,
    "shop.promo.fact.usageLimitPerUser": `Limited to ${params?.count} uses per customer`,
    "shop.promo.fact.requiresAll": "Requires all of",
    "shop.promo.fact.requiresAny": "Requires any of",
    "shop.promo.fact.requiredItem": `${params?.name} (qty ${params?.qty})`,
    "shop.promo.fact.requiredCategory": `${params?.name} category (qty ${params?.qty})`,
    "shop.promo.fact.discount": String(params?.label ?? ""),
    "shop.promo.fact.code": `Code ${params?.code}`,
    "shop.promo.fact.appliesEntireOrder": "Applies to the entire order",
    "shop.promo.fact.appliesSelected":
      "Applies to specific products or categories",
    "promotions.badge.percentOff": `${params?.value}% OFF`,
    "promotions.badge.fixedOff": `$${params?.value} OFF`,
    "promotions.badge.buyGet": `Buy ${params?.buy} Get ${params?.get}`,
  };
  return map[key] || key;
};

describe("buildPromoDetailFacts", () => {
  it("builds restrictions for weekdays, min order, and usage limits", () => {
    const facts = buildPromoDetailFacts(
      {
        active_weekdays: [1, 3, 5],
        min_order_amount: 500,
        usage_limit: 100,
        usage_limit_per_user: 1,
        currency: "MXN",
      },
      {
        t,
        formatPrice: (amount, currency) => `${currency} ${amount}`,
      },
    );

    expect(facts.restrictions).toEqual([
      "Valid on Mon, Wed, Fri",
      "Minimum order MXN 500",
      "Limited to 100 total uses",
      "Limited to 1 uses per customer",
    ]);
  });

  it("builds schedule restriction from start and end dates", () => {
    const facts = buildPromoDetailFacts(
      {
        starts_at: "2026-08-01T00:00:00.000Z",
        ends_at: "2026-08-31T00:00:00.000Z",
      },
      { t, locale: "en-US" },
    );

    expect(facts.restrictions[0]).toMatch(/Valid .+ – .+/);
  });

  it("builds conditions for required items and categories with mode", () => {
    const allFacts = buildPromoDetailFacts(
      {
        required_items_mode: "all",
        required_items: [
          {
            catalog_item_id: "i1",
            min_quantity: 2,
            item: { name: "Widget" },
          },
        ],
        required_categories: [
          {
            catalog_category_id: "c1",
            min_quantity: 1,
            category: { name: "Snacks" },
          },
        ],
      },
      { t },
    );

    expect(allFacts.conditions).toEqual([
      "Requires all of: Widget (qty 2), Snacks category (qty 1)",
    ]);

    const anyFacts = buildPromoDetailFacts(
      {
        required_items_mode: "any",
        required_items: [
          {
            catalog_item_id: "i1",
            min_quantity: 1,
            item: { name: "Widget" },
          },
        ],
      },
      { t },
    );

    expect(anyFacts.conditions[0]).toContain("Requires any of");
  });

  it("builds specifications for discount, code, and applies_to", () => {
    const entire = buildPromoDetailFacts(
      {
        discount_type: "percent",
        discount_value: 20,
        code: "NEWPIG20",
        applies_to: "all",
      },
      { t },
    );

    expect(entire.specifications).toEqual([
      "20% OFF",
      "Code NEWPIG20",
      "Applies to the entire order",
    ]);

    const selected = buildPromoDetailFacts(
      {
        discount_type: "bogo",
        bogo_buy_qty: 1,
        bogo_get_qty: 1,
        applies_to: "selected_items",
      },
      { t },
    );

    expect(selected.specifications).toContain("2x1");
    expect(selected.specifications).toContain(
      "Applies to specific products or categories",
    );
  });

  it("omits empty sections when fields are unset", () => {
    const facts = buildPromoDetailFacts(
      {
        discount_type: "percent",
        discount_value: 10,
      },
      { t },
    );

    expect(facts.restrictions).toEqual([]);
    expect(facts.conditions).toEqual([]);
    expect(facts.specifications).toEqual(["10% OFF"]);
  });
});
