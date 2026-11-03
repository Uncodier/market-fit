export const READ_SITE = "11111111-1111-4111-8111-111111111111";
export const catalogReadFixture = () => ({
  catalogItems: [{ id: "item", site_id: READ_SITE, name: "Product", kind: "product", status: "active", target_sale_price: 10, availability_mode: "always" }],
  categories: [], locations: [], leads: [], priceLists: [], priceListItems: [],
  taxesByItem: {}, promotions: [], modifierGroupsByHostId: {},
  inventorySnapshot: { policy: "block", levels: [{ catalog_item_id: "item", location_id: "location", quantity: 3 }] },
  pulledAt: "2026-10-01T00:00:00Z", replaceLeads: false,
});
export const ordersReadFixture = () => [{
  id: "order", site_id: READ_SITE, sale_id: "sale", status: "pending",
  created_at: "2026-10-01T00:00:00Z", total: 10,
  sale_order_items: [{ id: "line", catalog_item_id: "item", unit_price: 10, quantity: 1, name: "Product", metadata: null }],
  sales: { amount: 10, amount_due: 10, leads: null }, leads: null,
}];