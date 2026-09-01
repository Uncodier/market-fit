import {
  applyDeviceOrderSnapshots,
  attachPurchaseEntitlements,
  mapDeviceOrderSnapshot,
  mergeDeviceOrderSnapshot,
} from "@/app/commerce/device-order-sync"
import type { DeviceOrder } from "@/app/commerce/device-order-storage"

const cached: DeviceOrder = {
  orderId: "ord-1",
  publicAccessToken: "tok_abc",
  orderNumber: "SO-1",
  status: "pending",
  total: 20,
  currency: "USD",
  createdAt: "2026-08-01T00:00:00.000Z",
  items: [{ name: "Coffee", imageUrl: "/c.jpg", unitPrice: 20 }],
}

describe("device-order-sync", () => {
  it("maps cancelled status from a public snapshot row", () => {
    const snapshot = mapDeviceOrderSnapshot({
      id: "ord-1",
      public_access_token: "tok_abc",
      order_number: "SO-1",
      status: "cancelled",
      total: 20,
      currency: "USD",
      created_at: "2026-08-01T00:00:00.000Z",
      sale_order_items: [
        {
          name: "Coffee",
          unit_price: 20,
          catalog_item: { name: "Coffee", image_url: "/c.jpg" },
        },
      ],
    })

    expect(snapshot.status).toBe("cancelled")
    expect(snapshot.items).toEqual([
      { name: "Coffee", imageUrl: "/c.jpg", unitPrice: 20 },
    ])
  })

  it("updates cached device orders when the live status is cancelled", () => {
    const { orders, changed } = applyDeviceOrderSnapshots(
      [cached],
      [{ ...cached, status: "cancelled" }]
    )

    expect(changed).toBe(true)
    expect(orders[0].status).toBe("cancelled")
    expect(orders[0].items).toEqual(cached.items)
  })

  it("keeps cached thumbs when the snapshot has no line items", () => {
    const merged = mergeDeviceOrderSnapshot(cached, {
      ...cached,
      status: "cancelled",
      items: [],
    })

    expect(merged.status).toBe("cancelled")
    expect(merged.items).toEqual(cached.items)
  })

  it("keeps guest identity when applying a public snapshot", () => {
    const withGuest = {
      ...cached,
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",
    }
    const merged = mergeDeviceOrderSnapshot(withGuest, {
      ...cached,
      status: "completed",
    })

    expect(merged.customerName).toBe("Jane Doe")
    expect(merged.customerEmail).toBe("jane@example.com")
    expect(merged.status).toBe("completed")
  })

  it("maps catalog type from a public snapshot row", () => {
    const snapshot = mapDeviceOrderSnapshot({
      id: "ord-1",
      public_access_token: "tok_abc",
      order_number: "ORD-1",
      status: "completed",
      sale_order_items: [
        {
          name: "Hadestown",
          unit_price: 70,
          catalog_item_id: "cat-1",
          catalog_item: {
            name: "Hadestown",
            image_url: "/h.jpg",
            kind: "digital_asset",
            digital_subtype: "ticket",
          },
        },
      ],
    })

    expect(snapshot.items).toEqual([
      {
        name: "Hadestown",
        imageUrl: "/h.jpg",
        unitPrice: 70,
        catalogItemId: "cat-1",
        kind: "digital_asset",
        digital_subtype: "ticket",
      },
    ])
  })

  it("attaches purchase entitlements to matching catalog items", () => {
    const [order] = attachPurchaseEntitlements(
      [
        {
          ...cached,
          items: [
            {
              name: "Hadestown",
              catalogItemId: "cat-1",
              kind: "digital_asset",
              digital_subtype: "ticket",
            },
          ],
        },
      ],
      [{ id: "ent-1", source_id: "ord-1", catalog_item_id: "cat-1" }]
    )

    expect(order.items?.[0].entitlementId).toBe("ent-1")
  })

  it("does not mark unchanged snapshots as dirty", () => {
    const { changed, orders } = applyDeviceOrderSnapshots([cached], [cached])
    expect(changed).toBe(false)
    expect(orders[0]).toBe(cached)
  })
})
