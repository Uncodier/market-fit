import { attachDemoOrderLineUnits } from "@/lib/demo-data/order-line-units"

describe("demo order-line units", () => {
  it("expands integer quantities into independently actionable units", () => {
    const result = attachDemoOrderLineUnits({
      sale_order_items: [
        {
          id: "line-1",
          site_id: "site-1",
          quantity: 3,
          status: "pending",
          created_at: "2026-09-21T18:00:00.000Z",
        },
      ],
    })

    expect(result.sale_order_item_units).toHaveLength(3)
    expect(result.sale_order_item_units).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ unit_index: 1, quantity: 1 }),
        expect.objectContaining({ unit_index: 2, quantity: 1 }),
        expect.objectContaining({ unit_index: 3, quantity: 1 }),
      ]),
    )
  })

  it("keeps fractional quantities in one operational unit", () => {
    const result = attachDemoOrderLineUnits({
      sale_order_items: [
        {
          id: "line-1",
          site_id: "site-1",
          quantity: 1.5,
          status: "pending",
          created_at: "2026-09-21T18:00:00.000Z",
        },
      ],
    })

    expect(result.sale_order_item_units).toEqual([
      expect.objectContaining({ unit_index: 1, quantity: 1.5 }),
    ])
  })
})
