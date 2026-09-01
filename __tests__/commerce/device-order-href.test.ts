import { getDeviceOrderHref } from "@/app/commerce/device-order-href"
import type { DeviceOrder } from "@/app/commerce/device-order-storage"

const fromHref = "/shop/site-1"

function order(overrides: Partial<DeviceOrder> = {}): DeviceOrder {
  return {
    orderId: "ord-1",
    publicAccessToken: "tok_abc",
    status: "completed",
    items: [
      {
        name: "Hadestown",
        kind: "digital_asset",
        digital_subtype: "ticket",
        entitlementId: "ent-1",
        unitPrice: 70,
      },
    ],
    ...overrides,
  }
}

const soHref = "/so/tok_abc?from=%2Fshop%2Fsite-1"

describe("getDeviceOrderHref", () => {
  it("opens the ticket experience for a completed digital order with an entitlement", () => {
    expect(getDeviceOrderHref(order(), fromHref)).toBe("/buyer/ticket/ent-1")
  })

  it("opens downloads for a completed file entitlement", () => {
    expect(
      getDeviceOrderHref(
        order({
          items: [
            {
              name: "Pack",
              kind: "digital_asset",
              digital_subtype: "file",
              entitlementId: "ent-2",
            },
          ],
        }),
        fromHref
      )
    ).toBe("/buyer/downloads/ent-2")
  })

  it("falls back to the library filter when the entitlement id is missing", () => {
    expect(
      getDeviceOrderHref(
        order({
          items: [{ name: "Hadestown", kind: "digital_asset", digital_subtype: "ticket" }],
        }),
        fromHref
      )
    ).toBe("/buyer/library?subtype=ticket")
  })

  it("keeps the public sales order for pending digital orders", () => {
    expect(getDeviceOrderHref(order({ status: "pending" }), fromHref)).toBe(soHref)
  })

  it("keeps the public sales order for cancelled digital orders", () => {
    expect(getDeviceOrderHref(order({ status: "cancelled" }), fromHref)).toBe(soHref)
  })

  it("keeps the public sales order for physical items", () => {
    expect(
      getDeviceOrderHref(
        order({
          items: [{ name: "Coffee", kind: "product", unitPrice: 20 }],
        }),
        fromHref
      )
    ).toBe(soHref)
  })

  it("keeps the public sales order for mixed carts", () => {
    expect(
      getDeviceOrderHref(
        order({
          items: [
            { name: "Hadestown", kind: "digital_asset", digital_subtype: "ticket" },
            { name: "Coffee", kind: "product" },
          ],
        }),
        fromHref
      )
    ).toBe(soHref)
  })
})
