import {
  formatAmount,
  formatProductList,
  mapSaleToActivity,
  mapTaskToActivity,
  mergeActivities,
  unwrapMany,
  unwrapOne,
  type Activity,
  type SaleInput,
} from "@/app/api/recent-activity/format"

function sale(overrides: Partial<SaleInput> = {}): SaleInput {
  return {
    id: "sale-1",
    amount: 1315,
    currency: "USD",
    created_at: "2026-08-11T15:00:00.000Z",
    source: "pos",
    campaign_id: "camp-1",
    lead_id: "lead-1",
    leads: { id: "lead-1", name: "Jane Doe", email: "jane@example.com" },
    campaigns: { id: "camp-1", title: "Summer Promo" },
    sale_orders: {
      id: "order-1",
      order_number: "SO-1",
      sale_order_items: [
        { name: "Espresso", quantity: 2, parent_sale_order_item_id: null },
        { name: "Latte", quantity: 1, parent_sale_order_item_id: null },
      ],
    },
    ...overrides,
  }
}

function activity(partial: Partial<Activity> & Pick<Activity, "id" | "date">): Activity {
  return {
    kind: "task",
    href: "/control-center/x",
    user: { id: "u", name: "User", email: "u@example.com", imageUrl: null },
    action: "email task",
    lead: { id: "l", name: "User" },
    segment: null,
    title: "Task",
    ...partial,
  }
}

describe("formatProductList", () => {
  it("skips modifier lines and omits ×1", () => {
    const label = formatProductList([
      { name: "Burger", quantity: 1, parent_sale_order_item_id: null },
      { name: "Cheese", quantity: 1, parent_sale_order_item_id: "parent-1" },
      { name: "Fries", quantity: 2, parent_sale_order_item_id: null },
    ])
    expect(label).toBe("Burger, Fries ×2")
  })

  it("falls back to product_name when there are no line items", () => {
    expect(formatProductList([], "Gift card")).toBe("Gift card")
    expect(formatProductList(null, "Gift card")).toBe("Gift card")
  })

  it("keeps the first two products and adds +N more", () => {
    const label = formatProductList([
      { name: "Espresso", quantity: 2 },
      { name: "Latte", quantity: 1 },
      { name: "Muffin", quantity: 1 },
      { name: "Water", quantity: 3 },
    ])
    expect(label).toBe("Espresso ×2, Latte +2 more")
  })
})

describe("formatAmount", () => {
  it("formats whole dollars like dashboard widgets", () => {
    expect(formatAmount(1315)).toBe("$1,315")
    expect(formatAmount("49.00")).toBe("$49")
  })

  it("returns $0 for invalid amounts", () => {
    expect(formatAmount(null)).toBe("$0")
    expect(formatAmount("n/a")).toBe("$0")
  })
})

describe("mapSaleToActivity", () => {
  it("uses campaign sold copy with customer products in the description", () => {
    const activity = mapSaleToActivity(sale())
    expect(activity.kind).toBe("sale")
    expect(activity.id).toBe("sale:sale-1")
    expect(activity.href).toBe("/orders/order-1")
    expect(activity.action).toBe("Summer Promo sold $1,315")
    expect(activity.description).toBe("Jane Doe bought Espresso ×2, Latte")
    expect(activity.campaign).toBe("Summer Promo")
    expect(activity.products).toBe("Espresso ×2, Latte")
  })

  it("prefers an explicit campaign title over the nested relation", () => {
    const activity = mapSaleToActivity(sale(), "Launch Ads")
    expect(activity.action).toBe("Launch Ads sold $1,315")
    expect(activity.campaign).toBe("Launch Ads")
  })

  it("uses customer bought copy when the sale has no campaign", () => {
    const activity = mapSaleToActivity(
      sale({ campaign_id: null, campaigns: null, source: "shop" }),
    )
    expect(activity.action).toBe("Jane Doe bought Espresso ×2, Latte")
    expect(activity.description).toBe("$1,315 · Shop")
    expect(activity.campaign).toBeNull()
  })

  it("falls back to sales.product_name when there are no order lines", () => {
    const activity = mapSaleToActivity(
      sale({
        product_name: "Consulting package",
        sale_orders: { id: "order-1", sale_order_items: [] },
      }),
    )
    expect(activity.description).toBe("Jane Doe bought Consulting package")
  })

  it("links to the lead when there is no order", () => {
    const activity = mapSaleToActivity(sale({ sale_orders: null }))
    expect(activity.href).toBe("/leads/lead-1")
  })

  it("unwraps array relations from supabase", () => {
    const activity = mapSaleToActivity(
      sale({
        leads: [{ id: "lead-1", name: "Jane Doe", email: "jane@example.com" }],
        sale_orders: [
          {
            id: "order-9",
            sale_order_items: [{ name: "Tea", quantity: 1 }],
          },
        ],
      }),
    )
    expect(activity.href).toBe("/orders/order-9")
    expect(activity.description).toBe("Jane Doe bought Tea")
  })
})

describe("mapTaskToActivity", () => {
  it("prefixes the id and points to control center", () => {
    const activity = mapTaskToActivity(
      {
        id: "task-1",
        title: "Follow up",
        type: "email",
        created_at: "2026-08-10T12:00:00.000Z",
        completed_date: "2026-08-10T13:00:00.000Z",
        stage: "consideration",
      },
      { id: "lead-1", name: "Alex", email: "alex@example.com", segment_id: "seg-1" },
      "SMB",
    )
    expect(activity.id).toBe("task:task-1")
    expect(activity.kind).toBe("task")
    expect(activity.href).toBe("/control-center/task-1")
    expect(activity.action).toBe("email task")
    expect(activity.date).toBe("2026-08-10T13:00:00.000Z")
    expect(activity.segment).toBe("SMB")
    expect(activity.journeyStage).toBe("Consideration")
  })
})

describe("mergeActivities", () => {
  it("sorts by date descending and slices to the limit", () => {
    const merged = mergeActivities(
      [
        activity({ id: "task:old", date: "2026-08-01T00:00:00.000Z", kind: "task" }),
        activity({
          id: "sale:new",
          date: "2026-08-12T00:00:00.000Z",
          kind: "sale",
          href: "/orders/1",
        }),
        activity({ id: "task:mid", date: "2026-08-05T00:00:00.000Z", kind: "task" }),
      ],
      2,
    )
    expect(merged.map((item) => item.id)).toEqual(["sale:new", "task:mid"])
  })

  it("defaults to 6 when the limit is invalid", () => {
    const items = Array.from({ length: 8 }, (_, i) =>
      activity({
        id: `task:${i}`,
        date: `2026-08-0${(i % 9) + 1}T00:00:00.000Z`,
      }),
    )
    expect(mergeActivities(items, 0)).toHaveLength(6)
  })
})

describe("unwrap helpers", () => {
  it("unwraps one and many relation shapes", () => {
    expect(unwrapOne(null)).toBeNull()
    expect(unwrapOne({ id: "1" })).toEqual({ id: "1" })
    expect(unwrapOne([{ id: "1" }, { id: "2" }])).toEqual({ id: "1" })
    expect(unwrapMany(null)).toEqual([])
    expect(unwrapMany({ id: "1" })).toEqual([{ id: "1" }])
    expect(unwrapMany([{ id: "1" }])).toEqual([{ id: "1" }])
  })
})
