import { resolveUnitPriceLocal } from "@/app/pos/local/resolve-unit-price-local";

describe("resolveUnitPriceLocal", () => {
  const priceLists = [
    {
      id: "pl-default",
      site_id: "site-1",
      name: "Default",
      is_active: true,
      is_default: true,
    },
    {
      id: "pl-vip",
      site_id: "site-1",
      name: "VIP",
      is_active: true,
      is_default: false,
    },
    {
      id: "pl-off",
      site_id: "site-1",
      name: "Off",
      is_active: false,
      is_default: false,
    },
  ];

  const priceListItems = [
    {
      id: "pli-1",
      price_list_id: "pl-default",
      catalog_item_id: "item-1",
      unit_price: 10,
    },
    {
      id: "pli-2",
      price_list_id: "pl-vip",
      catalog_item_id: "item-1",
      unit_price: 8,
    },
  ];

  it("uses explicit price list item when active", () => {
    const res = resolveUnitPriceLocal({
      catalogItemId: "item-1",
      targetSalePrice: 20,
      priceListId: "pl-vip",
      priceLists,
      priceListItems,
    });
    expect(res.price).toBe(8);
    expect(res.priceListId).toBe("pl-vip");
  });

  it("falls back to default price list", () => {
    const res = resolveUnitPriceLocal({
      catalogItemId: "item-1",
      targetSalePrice: 20,
      priceLists,
      priceListItems,
    });
    expect(res.price).toBe(10);
    expect(res.priceListId).toBe("pl-default");
  });

  it("falls back to target sale price when no list item", () => {
    const res = resolveUnitPriceLocal({
      catalogItemId: "item-2",
      targetSalePrice: 20,
      priceListId: "pl-vip",
      priceLists,
      priceListItems,
    });
    expect(res.price).toBe(20);
  });

  it("ignores inactive price lists", () => {
    const res = resolveUnitPriceLocal({
      catalogItemId: "item-1",
      targetSalePrice: 20,
      priceListId: "pl-off",
      priceLists,
      priceListItems: [
        ...priceListItems,
        {
          id: "pli-3",
          price_list_id: "pl-off",
          catalog_item_id: "item-1",
          unit_price: 1,
        },
      ],
    });
    expect(res.price).toBe(20);
  });
});
