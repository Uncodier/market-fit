import { buildOrderPrintTicket } from "@/app/orders/order-printing"

describe("buildOrderPrintTicket", () => {
  it("builds a full ticket and records the current printed quantities", () => {
    const ticket = buildOrderPrintTicket(
      [
        {
          id: "burger",
          name: "Burger",
          quantity: 2,
          status: "new",
          metadata: { client_line_key: "burger-line" },
        },
        {
          id: "cheese",
          name: "Cheese",
          quantity: 2,
          status: "new",
          parent_sale_order_item_id: "burger",
          metadata: { client_line_key: "cheese-line", is_modifier: true },
        },
      ],
      "full",
    )

    expect(ticket.delta.kind).toBe("full")
    expect(ticket.lines).toEqual([
      expect.objectContaining({
        name: "Burger",
        quantity: 2,
        modifiers: [{ name: "Cheese", quantity: 2 }],
      }),
    ])
    expect(ticket.printedItems).toEqual([{ id: "burger", quantity: 2 }])
  })

  it("builds adds, quantity changes, and voids from printed quantities", () => {
    const ticket = buildOrderPrintTicket(
      [
        {
          id: "new",
          name: "Fries",
          quantity: 1,
          status: "new",
          metadata: { printed_quantity: 0 },
        },
        {
          id: "changed",
          name: "Burger",
          quantity: 3,
          status: "preparing",
          metadata: { printed_quantity: 2 },
        },
        {
          id: "removed",
          name: "Soup",
          quantity: 1,
          status: "cancelled",
          metadata: { printed_quantity: 1 },
        },
      ],
      "delta",
    )

    expect(ticket.delta).toMatchObject({
      kind: "delta",
      adds: [expect.objectContaining({ itemId: "new", quantity: 1 })],
      qtyChanges: [
        expect.objectContaining({ itemId: "changed", from: 2, to: 3 }),
      ],
      voids: [expect.objectContaining({ itemId: "removed", quantity: 1 })],
    })
    expect(ticket.printedItems).toEqual([
      { id: "new", quantity: 1 },
      { id: "changed", quantity: 3 },
      { id: "removed", quantity: 0 },
    ])
  })

  it("treats legacy new items as unprinted and other legacy items as unchanged", () => {
    const ticket = buildOrderPrintTicket(
      [
        { id: "new", name: "New item", quantity: 1, status: "new" },
        {
          id: "preparing",
          name: "Already preparing",
          quantity: 1,
          status: "preparing",
        },
      ],
      "delta",
    )

    expect(ticket.delta.adds.map((line) => line.itemId)).toEqual(["new"])
    expect(ticket.delta.qtyChanges).toHaveLength(0)
    expect(ticket.delta.voids).toHaveLength(0)
  })
})
