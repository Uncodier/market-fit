/**
 * @jest-environment jsdom
 */

import {
  getDeviceOrders,
  setDeviceOrders,
} from "@/app/commerce/device-order-storage"

describe("device-order-storage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("persists cancelled status for anonymous device orders", () => {
    setDeviceOrders("site-1", [
      {
        orderId: "ord-1",
        publicAccessToken: "tok_abc",
        orderNumber: "SO-1",
        status: "cancelled",
        total: 20,
        currency: "USD",
        items: [{ name: "Coffee", imageUrl: "/c.jpg", unitPrice: 20 }],
      },
    ])

    expect(getDeviceOrders("site-1")[0].status).toBe("cancelled")
  })
})
