import { mapDocumentLineItems } from "@/app/documents/map-document-items"

describe("mapDocumentLineItems", () => {
  it("maps snake_case sale order items", () => {
    expect(
      mapDocumentLineItems([
        {
          name: "ChilapigS",
          quantity: 1,
          unit_price: 80,
          subtotal: 80,
          status: "new",
        },
      ])
    ).toEqual([
      {
        name: "ChilapigS",
        quantity: 1,
        unit_price: 80,
        subtotal: 80,
        status: "new",
      },
    ])
  })

  it("maps camelCase unitPrice from JSON items", () => {
    expect(
      mapDocumentLineItems([
        {
          name: "ChilapigS",
          quantity: 2,
          unitPrice: 40,
          subtotal: 80,
        },
      ])
    ).toEqual([
      {
        name: "ChilapigS",
        quantity: 2,
        unit_price: 40,
        subtotal: 80,
        status: null,
      },
    ])
  })

  it("computes subtotal when missing", () => {
    expect(
      mapDocumentLineItems([{ name: "Item", quantity: 3, unit_price: 10 }])
    ).toEqual([
      {
        name: "Item",
        quantity: 3,
        unit_price: 10,
        subtotal: 30,
        status: null,
      },
    ])
  })
})
