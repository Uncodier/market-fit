import { posSessionFromOrder } from "@/app/pos/order-session"

describe("posSessionFromOrder", () => {
  it("restores prior payments and fulfillment for an existing order", () => {
    const session = posSessionFromOrder(
      {
        id: "order-1",
        status: "pending",
        fulfillment_method: "pickup",
        origin_location_id: "location-1",
        sales: {
          amount: 100,
          amount_due: 60,
          status: "pending",
          payments: [{ amount: 25 }, { amount: 15 }],
        },
        sale_order_items: [
          {
            id: "line-1",
            catalog_item_id: "item-1",
            name: "Coffee",
            quantity: 1,
            unit_price: 100,
            status: "new",
          },
        ],
      },
      [{ id: "item-1", name: "Coffee" }] as any,
    )

    expect(session).toMatchObject({
      fulfillment: "pickup",
      originLocationId: "location-1",
      existingPaymentTotal: 40,
    })
  })

  it("derives prior payments from amount due for legacy sales", () => {
    const session = posSessionFromOrder(
      {
        id: "order-1",
        status: "pending",
        total: 100,
        sales: { amount: 100, amount_due: 75, status: "pending" },
        sale_order_items: [],
      },
      [],
    )

    expect(session?.existingPaymentTotal).toBe(25)
  })
})
