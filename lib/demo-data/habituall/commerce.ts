import {
  isoDaysAgo,
  isoDaysFromNow,
  isoNow,
  makeCatalogItemTax,
  makeCategory,
  makeItem,
  makeLinkedOrder,
  makeLocation,
  makePriceList,
  makePriceListItem,
  makeTax,
  weekdaySchedule,
} from "../factories"

const SITE = "demo-habituall"
const USER = "demo-user-123"
const MXN = "MXN"

const categories = [
  makeCategory("cat-hab-classes", SITE, "Classes", 0),
  makeCategory("cat-hab-passes", SITE, "Passes", 1),
  makeCategory("cat-hab-memberships", SITE, "Memberships", 2),
  makeCategory("cat-hab-cafe", SITE, "Cafe", 3),
]

const items = [
  makeItem("item-hab-yoga", SITE, {
    name: "Yoga 60m",
    kind: "service",
    category_id: "cat-hab-classes",
    target_sale_price: 220,
    currency: MXN,
    is_reservation: true,
    is_pos_available: true,
    description: "Studio yoga class with mats included.",
  }),
  makeItem("item-hab-spin", SITE, {
    name: "Spin 45m",
    kind: "service",
    category_id: "cat-hab-classes",
    target_sale_price: 240,
    currency: MXN,
    is_reservation: true,
    description: "Indoor cycling class.",
    sort_order: 1,
  }),
  makeItem("item-hab-pass-10", SITE, {
    name: "10-class pass",
    kind: "digital_asset",
    digital_subtype: "pass",
    category_id: "cat-hab-passes",
    target_sale_price: 1800,
    currency: MXN,
    pass_uses: 10,
    pass_validity_days: 90,
    description: "Redeem against any studio class.",
    sort_order: 2,
  }),
  makeItem("item-hab-membership", SITE, {
    name: "Monthly membership",
    kind: "service",
    category_id: "cat-hab-memberships",
    target_sale_price: 1490,
    currency: MXN,
    is_recurring: true,
    description: "Unlimited classes and coworking access.",
    sort_order: 3,
  }),
  makeItem("item-hab-daypass", SITE, {
    name: "Day pass",
    kind: "service",
    category_id: "cat-hab-passes",
    target_sale_price: 350,
    currency: MXN,
    is_pos_available: true,
    description: "One-day coworking and cafe access.",
    sort_order: 4,
  }),
  makeItem("item-hab-espresso", SITE, {
    name: "Espresso",
    kind: "product",
    category_id: "cat-hab-cafe",
    target_sale_price: 45,
    currency: MXN,
    is_pos_available: true,
    sort_order: 5,
  }),
  makeItem("item-hab-smoothie", SITE, {
    name: "Green smoothie",
    kind: "product",
    category_id: "cat-hab-cafe",
    target_sale_price: 85,
    currency: MXN,
    is_pos_available: true,
    sort_order: 6,
  }),
]

const locations = [
  makeLocation("loc-hab-roma", SITE, "Studio Roma", { is_default: true, city: "CDMX" }),
  makeLocation("loc-hab-centro", SITE, "Coworking Centro", { city: "CDMX" }),
]

const priceLists = [
  makePriceList("pl-hab-pos", SITE, "Studio POS", { is_default: true, currency: MXN, channels: ["pos", "shop"] }),
]

const priceListItems = items
  .filter((item) => item.is_pos_available)
  .map((item, index) =>
    makePriceListItem(`pli-hab-${index}`, SITE, "pl-hab-pos", item.id, item.target_sale_price)
  )

const taxes = [makeTax("tax-hab-iva", SITE, "IVA 16%", 16)]
const catalogItemTaxes = items.map((item, index) =>
  makeCatalogItemTax(`cit-hab-${index}`, SITE, item.id, "tax-hab-iva")
)

const cafeOrder = makeLinkedOrder({
  siteId: SITE,
  prefix: "hab-pos-1",
  leadId: "lead-habituall-1",
  locationId: "loc-hab-roma",
  status: "completed",
  fulfillment: "dine_in",
  daysAgo: 1,
  currency: MXN,
  items: [
    { catalogItemId: "item-hab-espresso", name: "Espresso", qty: 2, unitPrice: 45 },
    { catalogItemId: "item-hab-smoothie", name: "Green smoothie", qty: 1, unitPrice: 85 },
  ],
})

const dayPassOrder = makeLinkedOrder({
  siteId: SITE,
  prefix: "hab-pos-2",
  leadId: "lead-habituall-2",
  locationId: "loc-hab-centro",
  status: "pending",
  fulfillment: "pickup",
  daysAgo: 0,
  currency: MXN,
  paymentStatus: "unpaid",
  items: [{ catalogItemId: "item-hab-daypass", name: "Day pass", qty: 1, unitPrice: 350 }],
})

const passOrder = makeLinkedOrder({
  siteId: SITE,
  prefix: "hab-pass-1",
  leadId: "lead-habituall-4",
  locationId: "loc-hab-roma",
  status: "completed",
  fulfillment: "none",
  source: "online",
  daysAgo: 12,
  currency: MXN,
  items: [{ catalogItemId: "item-hab-pass-10", name: "10-class pass", qty: 1, unitPrice: 1800 }],
})

const now = isoNow()

export const habituallCommerce = {
  settingsPatch: {
    commerce: { decrement_stock_on: "sale", default_availability_mode: "always" },
    visits: {
      enabled_physical: true,
      enabled_online: false,
      require_signature: false,
      require_photo: false,
      require_id: false,
      terms_text: "I agree to studio house rules.",
      default_duration_minutes: 60,
    },
  },
  catalog_categories: categories,
  catalog_items: items,
  locations,
  price_lists: priceLists,
  price_list_items: priceListItems,
  taxes,
  catalog_item_taxes: catalogItemTaxes,
  sales: [cafeOrder.sale, dayPassOrder.sale, passOrder.sale],
  sale_orders: [cafeOrder.order, dayPassOrder.order, passOrder.order],
  sale_order_items: [...cafeOrder.items, ...dayPassOrder.items, ...passOrder.items],
  pass_redeemable_items: [
    {
      id: "prd-hab-1",
      site_id: SITE,
      pass_catalog_item_id: "item-hab-pass-10",
      reservable_catalog_item_id: "item-hab-yoga",
      created_at: now,
      updated_at: now,
    },
    {
      id: "prd-hab-2",
      site_id: SITE,
      pass_catalog_item_id: "item-hab-pass-10",
      reservable_catalog_item_id: "item-hab-spin",
      created_at: now,
      updated_at: now,
    },
  ],
  reservation_schedules: [
    {
      id: "sch-hab-yoga",
      name: "Yoga weekdays",
      site_id: SITE,
      catalog_item_id: "item-hab-yoga",
      duration_minutes: 60,
      capacity: 16,
      timezone: "America/Mexico_City",
      days: weekdaySchedule(),
      created_at: now,
      updated_at: now,
    },
    {
      id: "sch-hab-spin",
      name: "Spin weekdays",
      site_id: SITE,
      catalog_item_id: "item-hab-spin",
      duration_minutes: 45,
      capacity: 20,
      timezone: "America/Mexico_City",
      days: weekdaySchedule(),
      created_at: now,
      updated_at: now,
    },
  ],
  reservations: [
    {
      id: "res-hab-1",
      site_id: SITE,
      lead_id: "lead-habituall-1",
      catalog_item_id: "item-hab-yoga",
      location_id: "loc-hab-roma",
      resource_type: "catalog_item",
      channel: "physical",
      status: "confirmed",
      start_time: isoDaysFromNow(1).replace(/T.*/, "T08:00:00.000Z"),
      end_time: isoDaysFromNow(1).replace(/T.*/, "T09:00:00.000Z"),
      quantity: 1,
      amount: 220,
      created_at: now,
      updated_at: now,
    },
    {
      id: "res-hab-2",
      site_id: SITE,
      lead_id: "lead-habituall-2",
      catalog_item_id: "item-hab-spin",
      location_id: "loc-hab-roma",
      resource_type: "catalog_item",
      channel: "physical",
      status: "confirmed",
      start_time: isoDaysFromNow(2).replace(/T.*/, "T18:00:00.000Z"),
      end_time: isoDaysFromNow(2).replace(/T.*/, "T18:45:00.000Z"),
      quantity: 1,
      amount: 240,
      created_at: now,
      updated_at: now,
    },
    {
      id: "res-hab-3",
      site_id: SITE,
      lead_id: "lead-habituall-4",
      catalog_item_id: "item-hab-yoga",
      location_id: "loc-hab-roma",
      resource_type: "catalog_item",
      channel: "physical",
      status: "completed",
      start_time: isoDaysAgo(3).replace(/T.*/, "T08:00:00.000Z"),
      end_time: isoDaysAgo(3).replace(/T.*/, "T09:00:00.000Z"),
      quantity: 1,
      amount: 0,
      entitlement_id: "ent-hab-pass",
      created_at: isoDaysAgo(4),
      updated_at: isoDaysAgo(3),
    },
  ],
  subscriptions: [
    {
      id: "sub-hab-1",
      site_id: SITE,
      lead_id: "lead-habituall-4",
      catalog_item_id: "item-hab-membership",
      status: "active",
      start_date: isoDaysAgo(20).slice(0, 10),
      next_billing_date: isoDaysFromNow(10).slice(0, 10),
      amount: 1490,
      billing_interval: "month",
      created_at: isoDaysAgo(20),
      updated_at: now,
    },
    {
      id: "sub-hab-2",
      site_id: SITE,
      lead_id: "lead-habituall-2",
      catalog_item_id: "item-hab-membership",
      status: "paused",
      start_date: isoDaysAgo(60).slice(0, 10),
      next_billing_date: null,
      amount: 1490,
      billing_interval: "month",
      created_at: isoDaysAgo(60),
      updated_at: now,
    },
  ],
  entitlements: [
    {
      id: "ent-hab-pass",
      site_id: SITE,
      buyer_user_id: USER,
      catalog_item_id: "item-hab-pass-10",
      source_type: "purchase",
      source_id: "so-hab-pass-1",
      status: "active",
      granted_at: isoDaysAgo(12),
      uses_total: 10,
      uses_remaining: 8,
      created_at: isoDaysAgo(12),
      updated_at: now,
    },
  ],
}
