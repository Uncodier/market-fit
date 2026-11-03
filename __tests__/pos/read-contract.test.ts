import { parsePosCatalogRead, parsePosOrdersRead } from "@/app/pos/read-contract";
import { READ_SITE, catalogReadFixture, ordersReadFixture } from "./read-fixtures";
import { hasPosOrderCartSnapshot, posSessionFromOrder } from "@/app/pos/order-session";

it.each([
  ["catalogItems", [null]], ["categories", [{}]], ["locations", ["location"]],
  ["leads", [{ name: "No identity" }]], ["priceLists", [{ id: "p", name: "List", is_active: "true" }]],
  ["priceListItems", [{ id: "p", price_list_id: "list", catalog_item_id: "item", unit_price: "10" }]],
  ["taxesByItem", { item: [{ id: "tax", name: "Tax", rate: "16" }] }],
  ["promotions", [{ id: "promo", name: "Promo", discount_value: "20" }]],
  ["modifierGroupsByHostId", { item: [{ id: "group", name: "Group", items: null }] }],
  ["inventorySnapshot", { policy: "unknown", levels: [] }],
  ["pulledAt", "yesterday"], ["replaceLeads", "false"],
] as const)("rejects malformed snapshot %s before returning a replacement", (field, value) => {
  expect(parsePosCatalogRead({ data: { ...catalogReadFixture(), [field]: value } }, READ_SITE)).toBeNull();
});

it("preserves extensible catalog fields rather than silently dropping current contracts", () => {
  const data = catalogReadFixture();
  const value = { ...data, catalogItems: [{ ...data.catalogItems[0], variant_values: { size: "M" } }] };
  expect(parsePosCatalogRead({ data: value }, READ_SITE)).toEqual(value);
});

it.each([
  { sales: { amount_due: "10" } }, { sales: null }, { sale_order_items: null },
  { status: "cancelled" }, { site_id: "other-site" }, { created_at: "bad-date" },
  { sale_order_items: [{ id: "line", unit_price: Infinity }] },
  { sales: { amount_due: 10, leads: { id: "lead", site_id: "other-site" } } },
])("rejects malformed/foreign order data %j", (changes) => {
  expect(parsePosOrdersRead({ data: [{ ...ordersReadFixture()[0], ...changes }] }, READ_SITE)).toBeNull();
});

it("accepts empty complete snapshots and order lists, not missing collections", () => {
  expect(parsePosCatalogRead({ data: { ...catalogReadFixture(), catalogItems: [] } }, READ_SITE)).not.toBeNull();
  expect(parsePosOrdersRead({ data: [] }, READ_SITE)).toEqual([]);
  expect(parsePosOrdersRead({ data: [], error: "denied" }, READ_SITE)).toBeNull();
});

it("does not interpret arbitrary order metadata as a tenant boundary", () => {
  const data = ordersReadFixture();
  const rows = [{ ...data[0], sale_order_items: [{ ...data[0].sale_order_items[0], metadata: { site_id: "business-context" } }] }];
  expect(parsePosOrdersRead({ data: rows }, READ_SITE)).toEqual(rows);
});

it("supports nullable legacy location and price-list fields", () => {
  expect(parsePosCatalogRead({ data: { ...catalogReadFixture(),
    locations: [{ id: "location", name: "Store", is_default: null, is_active: null }],
    priceLists: [{ id: "list", name: "List", is_active: true, is_default: null, channels: null }],
  } }, READ_SITE)).not.toBeNull();
});

it("retains cancelled history and children of cancelled parents without making them payable", () => {
  const base = ordersReadFixture()[0];
  const active = { ...base.sale_order_items[0], parent_sale_order_item_id: null };
  const history = [
    { id: "cancelled-parent", status: "cancelled", parent_sale_order_item_id: null,
      catalog_item_id: null, name: null, unit_price: null, quantity: null, metadata: null },
    { id: "historical-child", status: "sent", catalog_item_id: null, parent_sale_order_item_id: "cancelled-parent" },
    { id: "cancelled-child", status: "cancelled", parent_sale_order_item_id: active.id,
      catalog_item_id: null, name: null, unit_price: null, quantity: null, metadata: null },
  ];
  const parsed = parsePosOrdersRead({ data: [{ ...base, sale_order_items: [active, ...history] }] }, READ_SITE);
  expect(parsed).not.toBeNull();
  expect(parsed?.[0].sale_order_items.slice(1)).toEqual(history);
  expect(hasPosOrderCartSnapshot(parsed?.[0])).toBe(true);
  expect(posSessionFromOrder(parsed?.[0], [])?.cart).toMatchObject([{ id: "item", cartQty: 1, cartPrice: 10, modifiers: [] }]);
  expect(posSessionFromOrder(parsed?.[0], [])?.cart).toHaveLength(1);
});

it("normalizes finite numeric strings for active parents and modifiers without mutating input", () => {
  const base = ordersReadFixture()[0];
  const lines = [
    { ...base.sale_order_items[0], parent_sale_order_item_id: null, unit_price: "0", quantity: "1.5" },
    { ...base.sale_order_items[0], id: "modifier", parent_sale_order_item_id: "line", unit_price: "2.50", quantity: "3" },
  ];
  const parsed = parsePosOrdersRead({ data: [{ ...base, sale_order_items: lines }] }, READ_SITE);
  expect(parsed?.[0].sale_order_items).toMatchObject([{ unit_price: 0, quantity: 1.5 }, { unit_price: 2.5, quantity: 3 }]);
  expect(hasPosOrderCartSnapshot(parsed?.[0])).toBe(true);
  expect(lines[0].quantity).toBe("1.5");
});

it.each([null, undefined, "", " ", "invalid", "Infinity", Infinity, NaN, true, [], {}])(
  "rejects invalid active numeric values %j even beside cancelled history", (invalid) => {
    const base = ordersReadFixture()[0];
    for (const field of ["quantity", "unit_price"]) {
      expect(parsePosOrdersRead({ data: [{ ...base, sale_order_items: [
        { ...base.sale_order_items[0], [field]: invalid },
        { id: "history", status: "cancelled", catalog_item_id: null },
      ] }] }, READ_SITE)).toBeNull();
    }
  },
);

it("does not exempt malformed active lines with an unknown or active parent", () => {
  const base = ordersReadFixture()[0];
  for (const parent of ["unknown", base.sale_order_items[0].id]) {
    expect(parsePosOrdersRead({ data: [{ ...base, sale_order_items: [
      ...base.sale_order_items, { id: "child", status: "sent", parent_sale_order_item_id: parent, catalog_item_id: null },
    ] }] }, READ_SITE)).toBeNull();
  }
});

it("retains tenant checks for historical lines", () => {
  const base = ordersReadFixture()[0];
  expect(parsePosOrdersRead({ data: [{ ...base, sale_order_items: [
    ...base.sale_order_items, { id: "history", status: "cancelled", site_id: "foreign", catalog_item_id: null },
  ] }] }, READ_SITE)).toBeNull();
});