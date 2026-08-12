import {
  formatShippingAddressLines,
  resolveSalePaymentMethod,
  translateFulfillmentMethod,
  translatePaymentMethod,
} from "@/app/documents/document-meta"

describe("document-meta", () => {
  it("resolves latest payment method from sale payments", () => {
    expect(
      resolveSalePaymentMethod({
        payment_method: "cash",
        payments: [
          { date: "2026-08-01T00:00:00Z", method: "cash" },
          { date: "2026-08-10T00:00:00Z", method: "stripe" },
        ],
      })
    ).toBe("stripe")
  })

  it("translates fulfillment and payment labels", () => {
    expect(translateFulfillmentMethod("es", "dine_in")).toBe("En local")
    expect(translateFulfillmentMethod("en", "pickup")).toBe("Pickup")
    expect(translatePaymentMethod("en", "cash")).toBe("Cash")
    expect(translatePaymentMethod("en", "stripe")).toBe("Stripe")
  })

  it("formats shipping address lines", () => {
    expect(
      formatShippingAddressLines({
        line1: "Calle 1",
        city: "Celaya",
        state: "GTO",
        zip: "38000",
        country: "MX",
      })
    ).toEqual(["Calle 1", "Celaya, GTO, 38000", "MX"])
  })
})
