import { groupOrderLineModifiers } from "@/app/order-lines/modifiers"

describe("order-line modifiers", () => {
  it("links modifiers by parent item id", () => {
    const grouped = groupOrderLineModifiers([
      { id: "parent", name: "Burger", quantity: 2 },
      {
        id: "modifier",
        parent_sale_order_item_id: "parent",
        name: "Extra cheese",
        quantity: 2,
      },
    ])

    expect(grouped.get("parent")).toEqual([
      expect.objectContaining({ id: "modifier", name: "Extra cheese" }),
    ])
  })

  it("supports legacy client-line metadata links", () => {
    const grouped = groupOrderLineModifiers([
      {
        id: "parent",
        name: "Burger",
        metadata: { client_line_key: "line-1" },
      },
      {
        id: "modifier",
        name: "No onions",
        metadata: {
          is_modifier: true,
          parent_client_line_key: "line-1",
        },
      },
    ])

    expect(grouped.get("parent")?.[0].name).toBe("No onions")
  })
})
