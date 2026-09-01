import {
  isoDaysAgo,
  isoNow,
  makeCatalogItemTax,
  makeCategory,
  makeInventoryLevel,
  makeItem,
  makeLinkedOrder,
  makeLocation,
  makePriceList,
  makePriceListItem,
  makeTax,
} from "../factories"

const SITE = "demo-ecom-es-456"
const USER = "demo-user-456"
const EUR = "EUR"
const now = isoNow()

const categories = [
  makeCategory("cat-ecom-women", SITE, "Women", 0),
  makeCategory("cat-ecom-men", SITE, "Men", 1),
  makeCategory("cat-ecom-acc", SITE, "Accessories", 2),
]

const items = [
  makeItem("item-ecom-dress", SITE, {
    name: "Linen midi dress",
    kind: "product",
    category_id: "cat-ecom-women",
    target_sale_price: 59,
    currency: EUR,
    sku: "W-DRESS-01",
    track_inventory: true,
    availability_mode: "inventory",
    is_pos_available: true,
    description: "Breathable linen dress for spring.",
  }),
  makeItem("item-ecom-tee", SITE, {
    name: "Essential tee",
    kind: "product",
    category_id: "cat-ecom-women",
    target_sale_price: 24,
    currency: EUR,
    sku: "W-TEE-00",
    track_inventory: true,
    availability_mode: "inventory",
    is_pos_available: true,
    sort_order: 1,
  }),
  makeItem("item-ecom-tee-s", SITE, {
    name: "Essential tee / S",
    kind: "product",
    category_id: "cat-ecom-women",
    parent_id: "item-ecom-tee",
    target_sale_price: 24,
    currency: EUR,
    sku: "W-TEE-S",
    track_inventory: true,
    availability_mode: "inventory",
    is_pos_available: true,
    sort_order: 2,
  }),
  makeItem("item-ecom-tee-m", SITE, {
    name: "Essential tee / M",
    kind: "product",
    category_id: "cat-ecom-women",
    parent_id: "item-ecom-tee",
    target_sale_price: 24,
    currency: EUR,
    sku: "W-TEE-M",
    track_inventory: true,
    availability_mode: "inventory",
    is_pos_available: true,
    sort_order: 3,
  }),
  makeItem("item-ecom-jacket", SITE, {
    name: "Denim jacket",
    kind: "product",
    category_id: "cat-ecom-men",
    target_sale_price: 79,
    currency: EUR,
    sku: "M-JKT-01",
    track_inventory: true,
    availability_mode: "inventory",
    is_pos_available: true,
    sort_order: 4,
  }),
  makeItem("item-ecom-chino", SITE, {
    name: "Slim chino",
    kind: "product",
    category_id: "cat-ecom-men",
    target_sale_price: 49,
    currency: EUR,
    sku: "M-PNT-01",
    track_inventory: true,
    availability_mode: "inventory",
    is_pos_available: true,
    sort_order: 5,
  }),
  makeItem("item-ecom-bag", SITE, {
    name: "Canvas tote",
    kind: "product",
    category_id: "cat-ecom-acc",
    target_sale_price: 29,
    currency: EUR,
    sku: "A-BAG-01",
    track_inventory: true,
    availability_mode: "inventory",
    is_pos_available: true,
    sort_order: 6,
  }),
  makeItem("item-ecom-belt", SITE, {
    name: "Leather belt",
    kind: "product",
    category_id: "cat-ecom-acc",
    target_sale_price: 35,
    currency: EUR,
    sku: "A-BLT-01",
    track_inventory: true,
    availability_mode: "inventory",
    is_pos_available: true,
    sort_order: 7,
  }),
]

const locations = [
  makeLocation("loc-ecom-cdmx", SITE, "Warehouse CDMX", { is_default: true, city: "Mexico City" }),
  makeLocation("loc-ecom-polanco", SITE, "Store Polanco", { city: "Mexico City" }),
]

const inventory_levels = [
  makeInventoryLevel("il-ecom-1", SITE, "item-ecom-dress", "loc-ecom-cdmx", 42),
  makeInventoryLevel("il-ecom-2", SITE, "item-ecom-tee-s", "loc-ecom-cdmx", 18),
  makeInventoryLevel("il-ecom-3", SITE, "item-ecom-tee-m", "loc-ecom-cdmx", 26),
  makeInventoryLevel("il-ecom-4", SITE, "item-ecom-jacket", "loc-ecom-cdmx", 14),
  makeInventoryLevel("il-ecom-5", SITE, "item-ecom-chino", "loc-ecom-polanco", 9),
  makeInventoryLevel("il-ecom-6", SITE, "item-ecom-bag", "loc-ecom-polanco", 31),
  makeInventoryLevel("il-ecom-7", SITE, "item-ecom-belt", "loc-ecom-polanco", 12),
]

const priceLists = [
  makePriceList("pl-ecom-retail", SITE, "Retail", { is_default: true, currency: EUR, channels: ["shop", "pos", "marketplace"] }),
  makePriceList("pl-ecom-wholesale", SITE, "Wholesale", { currency: EUR, channels: ["shop"] }),
]

const sellable = items.filter((item) => item.parent_id || item.id === "item-ecom-dress" || item.id === "item-ecom-jacket" || item.id === "item-ecom-chino" || item.id === "item-ecom-bag" || item.id === "item-ecom-belt")

const priceListItems = [
  ...items.map((item, index) =>
    makePriceListItem(`pli-ecom-ret-${index}`, SITE, "pl-ecom-retail", item.id, item.target_sale_price)
  ),
  ...sellable.map((item, index) =>
    makePriceListItem(`pli-ecom-ws-${index}`, SITE, "pl-ecom-wholesale", item.id, Math.round(item.target_sale_price * 0.65))
  ),
]

const taxes = [makeTax("tax-ecom-iva", SITE, "IVA 16%", 16)]
const catalogItemTaxes = items.map((item, index) =>
  makeCatalogItemTax(`cit-ecom-${index}`, SITE, item.id, "tax-ecom-iva")
)

const onlineOrder = makeLinkedOrder({
  siteId: SITE,
  prefix: "ecom-web-1",
  leadId: "lead-ecom-1",
  locationId: "loc-ecom-cdmx",
  status: "completed",
  fulfillment: "ship",
  source: "online",
  daysAgo: 6,
  currency: EUR,
  items: [
    { catalogItemId: "item-ecom-dress", name: "Linen midi dress", qty: 1, unitPrice: 59 },
    { catalogItemId: "item-ecom-bag", name: "Canvas tote", qty: 1, unitPrice: 29 },
  ],
})

const openOrder = makeLinkedOrder({
  siteId: SITE,
  prefix: "ecom-web-2",
  leadId: "lead-ecom-2",
  locationId: "loc-ecom-cdmx",
  status: "pending",
  fulfillment: "ship",
  source: "online",
  daysAgo: 1,
  currency: EUR,
  paymentStatus: "paid",
  items: [
    { catalogItemId: "item-ecom-jacket", name: "Denim jacket", qty: 1, unitPrice: 79 },
    { catalogItemId: "item-ecom-tee-m", name: "Essential tee / M", qty: 2, unitPrice: 24 },
  ],
})

const posOrder = makeLinkedOrder({
  siteId: SITE,
  prefix: "ecom-pos-1",
  leadId: "lead-ecom-3",
  locationId: "loc-ecom-polanco",
  status: "completed",
  fulfillment: "pickup",
  daysAgo: 2,
  currency: EUR,
  items: [
    { catalogItemId: "item-ecom-chino", name: "Slim chino", qty: 1, unitPrice: 49 },
    { catalogItemId: "item-ecom-belt", name: "Leather belt", qty: 1, unitPrice: 35 },
  ],
})

export const ecomCommerce = {
  settingsPatch: {
    commerce: { decrement_stock_on: "ship", default_availability_mode: "inventory" },
    visits: {
      enabled_physical: true,
      enabled_online: false,
      require_signature: false,
      require_photo: false,
      require_id: false,
      terms_text: "I confirm pickup of this order.",
      default_duration_minutes: 15,
    },
  },
  catalog_categories: categories,
  catalog_items: items,
  locations,
  inventory_levels,
  price_lists: priceLists,
  price_list_items: priceListItems,
  taxes,
  catalog_item_taxes: catalogItemTaxes,
  promotions: [
    {
      id: "promo-ecom-20",
      site_id: SITE,
      campaign_id: "camp-ecom-1",
      name: "Summer 20%",
      description: "Twenty percent off selected pieces.",
      code: "VERANO20",
      discount_type: "percent",
      discount_value: 20,
      applies_to: "all",
      channels: ["pos", "shop"],
      location_ids: [],
      usage_count: 14,
      status: "active",
      starts_at: isoDaysAgo(10),
      ends_at: null,
      show_on_shop: true,
      user_id: USER,
      created_at: isoDaysAgo(10),
      updated_at: now,
    },
  ],
  promotion_catalog_items: [],
  promotion_catalog_categories: [],
  sales: [onlineOrder.sale, openOrder.sale, posOrder.sale],
  sale_orders: [onlineOrder.order, openOrder.order, posOrder.order],
  sale_order_items: [...onlineOrder.items, ...openOrder.items, ...posOrder.items],
  shipments: [
    {
      id: "shp-ecom-1",
      site_id: SITE,
      sale_order_id: "so-ecom-web-1",
      sale_id: "sale-ecom-web-1",
      lead_id: "lead-ecom-1",
      origin_location_id: "loc-ecom-cdmx",
      status: "delivered",
      carrier: "DHL",
      tracking_number: "DHL123456MX",
      stock_decremented: true,
      shipped_at: isoDaysAgo(5),
      delivered_at: isoDaysAgo(3),
      user_id: USER,
      assigned_to: USER,
      created_at: isoDaysAgo(6),
      updated_at: isoDaysAgo(3),
    },
    {
      id: "shp-ecom-2",
      site_id: SITE,
      sale_order_id: "so-ecom-web-2",
      sale_id: "sale-ecom-web-2",
      lead_id: "lead-ecom-2",
      origin_location_id: "loc-ecom-cdmx",
      status: "preparing",
      carrier: "Estafeta",
      tracking_number: null,
      stock_decremented: false,
      user_id: USER,
      assigned_to: USER,
      created_at: isoDaysAgo(1),
      updated_at: now,
    },
  ],
}
