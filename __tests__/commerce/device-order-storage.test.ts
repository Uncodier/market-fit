/**
 * @jest-environment jsdom
 */

import {
  getDeviceOrders,
  getGuestCheckoutPrefill,
  rememberDeviceOrder,
  setDeviceOrders,
  toDeviceOrderItem,
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

  it("persists guest identity for the next anonymous checkout", () => {
    rememberDeviceOrder("site-1", {
      orderId: "ord-1",
      publicAccessToken: "tok_abc",
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",
      shippingAddress: {
        line1: "1 Main St",
        line2: "Apt 2",
        city: "Austin",
        state: "TX",
        zip: "78701",
        country: "US",
      },
    })

    expect(getGuestCheckoutPrefill("site-1")).toEqual({
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",
      shippingAddress: {
        line1: "1 Main St",
        line2: "Apt 2",
        city: "Austin",
        state: "TX",
        zip: "78701",
        country: "US",
      },
    })
  })

  it("prefills from another site cache when the current shop has none", () => {
    rememberDeviceOrder("site-a", {
      orderId: "ord-a",
      publicAccessToken: "tok_a",
      createdAt: "2026-08-01T00:00:00.000Z",
      customerName: "Ana",
      customerEmail: "ana@example.com",
    })

    expect(getGuestCheckoutPrefill("site-b")).toEqual({
      customerName: "Ana",
      customerEmail: "ana@example.com",
      shippingAddress: undefined,
    })
  })

  it("returns null when there is no guest cache", () => {
    rememberDeviceOrder("site-1", {
      orderId: "ord-1",
      publicAccessToken: "tok_abc",
    })

    expect(getGuestCheckoutPrefill("site-1")).toBeNull()
  })

  it("persists digital type and entitlement on cached items", () => {
    rememberDeviceOrder("site-1", {
      orderId: "ord-1",
      publicAccessToken: "tok_abc",
      items: [
        {
          name: "Hadestown",
          imageUrl: "/h.jpg",
          unitPrice: 70,
          kind: "digital_asset",
          digital_subtype: "ticket",
          catalogItemId: "cat-1",
          entitlementId: "ent-1",
        },
      ],
    })

    expect(getDeviceOrders("site-1")[0].items).toEqual([
      {
        name: "Hadestown",
        imageUrl: "/h.jpg",
        unitPrice: 70,
        kind: "digital_asset",
        digital_subtype: "ticket",
        catalogItemId: "cat-1",
        entitlementId: "ent-1",
      },
    ])
  })

  it("maps cart lines into cached device-order items", () => {
    expect(
      toDeviceOrderItem({
        id: "cat-1",
        name: "Proshot",
        image_url: "/p.jpg",
        cartPrice: 70,
        kind: "digital_asset",
        digital_subtype: "ticket",
      })
    ).toEqual({
      name: "Proshot",
      imageUrl: "/p.jpg",
      unitPrice: 70,
      kind: "digital_asset",
      digital_subtype: "ticket",
      catalogItemId: "cat-1",
    })
  })

  it("keeps guest identity when rewriting device orders", () => {
    setDeviceOrders("site-1", [
      {
        orderId: "ord-1",
        publicAccessToken: "tok_abc",
        status: "pending",
        customerName: "Jane Doe",
        customerEmail: "jane@example.com",
      },
    ])
    setDeviceOrders("site-1", [
      {
        ...getDeviceOrders("site-1")[0],
        status: "cancelled",
      },
    ])

    expect(getGuestCheckoutPrefill("site-1")).toMatchObject({
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",
    })
  })
})
