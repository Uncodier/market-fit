import {
  isoDaysAgo,
  isoDaysFromNow,
  isoNow,
  makeCategory,
  makeItem,
  makeLinkedOrder,
  makeLocation,
  makePriceList,
  makePriceListItem,
} from "../factories"

const SITE = "demo-saas-en-123"
const USD = "USD"
const now = isoNow()

const categories = [
  makeCategory("cat-saas-plans", SITE, "Plans", 0),
  makeCategory("cat-saas-addons", SITE, "Add-ons", 1),
  makeCategory("cat-saas-services", SITE, "Services", 2),
]

const items = [
  makeItem("item-saas-starter", SITE, {
    name: "Starter",
    kind: "service",
    category_id: "cat-saas-plans",
    target_sale_price: 49,
    currency: USD,
    is_recurring: true,
    description: "For small teams getting started.",
  }),
  makeItem("item-saas-pro", SITE, {
    name: "Pro",
    kind: "service",
    category_id: "cat-saas-plans",
    target_sale_price: 149,
    currency: USD,
    is_recurring: true,
    description: "Automation, seats, and priority support.",
    sort_order: 1,
  }),
  makeItem("item-saas-enterprise", SITE, {
    name: "Enterprise",
    kind: "service",
    category_id: "cat-saas-plans",
    target_sale_price: 799,
    currency: USD,
    is_recurring: true,
    description: "SSO, SLA, and dedicated success.",
    sort_order: 2,
  }),
  makeItem("item-saas-api", SITE, {
    name: "API access add-on",
    kind: "service",
    category_id: "cat-saas-addons",
    target_sale_price: 99,
    currency: USD,
    is_recurring: true,
    description: "Production API quota and webhooks.",
    sort_order: 3,
  }),
  makeItem("item-saas-onboarding", SITE, {
    name: "Onboarding package",
    kind: "service",
    category_id: "cat-saas-services",
    target_sale_price: 2500,
    currency: USD,
    is_pos_available: true,
    description: "Two-week implementation workshop.",
    sort_order: 4,
  }),
]

const locations = [makeLocation("loc-saas-hq", SITE, "HQ Remote", { is_default: true, city: "Austin" })]

const priceLists = [
  makePriceList("pl-saas-standard", SITE, "Standard", { is_default: true, currency: USD, channels: ["shop", "pos"] }),
  makePriceList("pl-saas-ent", SITE, "Enterprise", { currency: USD, channels: ["shop"] }),
]

const priceListItems = [
  ...items.map((item, index) =>
    makePriceListItem(`pli-saas-std-${index}`, SITE, "pl-saas-standard", item.id, item.target_sale_price)
  ),
  makePriceListItem("pli-saas-ent-0", SITE, "pl-saas-ent", "item-saas-enterprise", 699),
  makePriceListItem("pli-saas-ent-1", SITE, "pl-saas-ent", "item-saas-onboarding", 2000),
]

const quoteItems = [
  {
    id: "qi-saas-1-0",
    quotation_id: "quote-saas-1",
    catalog_item_id: "item-saas-enterprise",
    name: "Enterprise",
    quantity: 1,
    unit_price: 799,
    subtotal: 799,
  },
  {
    id: "qi-saas-1-1",
    quotation_id: "quote-saas-1",
    catalog_item_id: "item-saas-onboarding",
    name: "Onboarding package",
    quantity: 1,
    unit_price: 2500,
    subtotal: 2500,
  },
  {
    id: "qi-saas-2-0",
    quotation_id: "quote-saas-2",
    catalog_item_id: "item-saas-pro",
    name: "Pro",
    quantity: 8,
    unit_price: 149,
    subtotal: 1192,
  },
]

const onboardingOrder = makeLinkedOrder({
  siteId: SITE,
  prefix: "saas-svc-1",
  leadId: "lead-saas-4",
  locationId: "loc-saas-hq",
  status: "completed",
  fulfillment: "none",
  source: "online",
  daysAgo: 18,
  currency: USD,
  items: [{ catalogItemId: "item-saas-onboarding", name: "Onboarding package", qty: 1, unitPrice: 2500 }],
})

export const saasCommerce = {
  settingsPatch: {
    commerce: { decrement_stock_on: "sale", default_availability_mode: "always" },
    visits: {
      enabled_physical: false,
      enabled_online: true,
      require_signature: false,
      require_photo: false,
      require_id: false,
      terms_text: "I agree to the customer success session terms.",
      default_duration_minutes: 45,
    },
  },
  catalog_categories: categories,
  catalog_items: items,
  locations,
  price_lists: priceLists,
  price_list_items: priceListItems,
  sales: [onboardingOrder.sale],
  sale_orders: [onboardingOrder.order],
  sale_order_items: onboardingOrder.items,
  quotations: [
    {
      id: "quote-saas-1",
      site_id: SITE,
      deal_id: "deal-saas-1",
      lead_id: "lead-saas-1",
      price_list_id: "pl-saas-ent",
      status: "sent",
      valid_until: isoDaysFromNow(14).slice(0, 10),
      currency: USD,
      notes: "Annual enterprise + onboarding.",
      subtotal: 3299,
      discount_total: 0,
      tax_total: 0,
      total: 3299,
      created_at: isoDaysAgo(4),
      updated_at: now,
    },
    {
      id: "quote-saas-2",
      site_id: SITE,
      deal_id: "deal-saas-2",
      lead_id: "lead-saas-3",
      price_list_id: "pl-saas-standard",
      status: "draft",
      valid_until: isoDaysFromNow(21).slice(0, 10),
      currency: USD,
      notes: "8 Pro seats.",
      subtotal: 1192,
      discount_total: 0,
      tax_total: 0,
      total: 1192,
      created_at: isoDaysAgo(1),
      updated_at: now,
    },
    {
      id: "quote-saas-3",
      site_id: SITE,
      deal_id: "deal-saas-6",
      lead_id: "lead-saas-4",
      status: "accepted",
      valid_until: isoDaysAgo(5).slice(0, 10),
      currency: USD,
      notes: "Converted onboarding quote.",
      subtotal: 2500,
      discount_total: 0,
      tax_total: 0,
      total: 2500,
      created_at: isoDaysAgo(25),
      updated_at: isoDaysAgo(18),
    },
  ],
  quotation_items: [
    ...quoteItems,
    {
      id: "qi-saas-3-0",
      quotation_id: "quote-saas-3",
      catalog_item_id: "item-saas-onboarding",
      name: "Onboarding package",
      quantity: 1,
      unit_price: 2500,
      subtotal: 2500,
    },
  ],
  subscriptions: [
    {
      id: "sub-saas-1",
      site_id: SITE,
      lead_id: "lead-saas-4",
      catalog_item_id: "item-saas-enterprise",
      status: "active",
      start_date: isoDaysAgo(40).slice(0, 10),
      next_billing_date: isoDaysFromNow(20).slice(0, 10),
      amount: 799,
      billing_interval: "month",
      created_at: isoDaysAgo(40),
      updated_at: now,
    },
    {
      id: "sub-saas-2",
      site_id: SITE,
      lead_id: "lead-saas-4",
      catalog_item_id: "item-saas-api",
      status: "active",
      start_date: isoDaysAgo(40).slice(0, 10),
      next_billing_date: isoDaysFromNow(20).slice(0, 10),
      amount: 99,
      billing_interval: "month",
      created_at: isoDaysAgo(40),
      updated_at: now,
    },
    {
      id: "sub-saas-3",
      site_id: SITE,
      lead_id: "lead-saas-2",
      catalog_item_id: "item-saas-pro",
      status: "cancelled",
      start_date: isoDaysAgo(120).slice(0, 10),
      end_date: isoDaysAgo(15).slice(0, 10),
      amount: 149,
      billing_interval: "month",
      created_at: isoDaysAgo(120),
      updated_at: isoDaysAgo(15),
    },
  ],
}
