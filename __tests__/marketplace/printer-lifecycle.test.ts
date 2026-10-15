import { buildOrderPrintTicket } from "@/app/orders/order-printing"
import { computeKitchenDelta, mapSaleOrderItemsToDeltaLines, kitchenModifiersFor } from "@/lib/printer/core/order-delta"
import { cancellationOnlyDelta, isRecentKitchenOrder } from "@/lib/printer/core/marketplace-printing"
import { providerAccepted, providerCancellationConfirmed } from "@/lib/marketplace/presentation"

const metadata = (state: string, extra = {}) => ({ marketplace: { state, sync_status: "confirmed", ...extra } })
const items = [
  { id: "meal", name: "Meal", quantity: 2, status: "new", metadata: { printed_quantity: 2 } },
  { id: "side", name: "Side", quantity: 1, status: "new", parent_sale_order_item_id: "meal" },
  { id: "option", name: "No peanuts", quantity: 1, status: "new", parent_sale_order_item_id: "side" },
]

describe("native marketplace printer lifecycle", () => {
  it("allows only confirmed cancellation notifications, never initial preparation", () => {
    expect(providerAccepted(metadata("cancelled"))).toBe(false)
    expect(providerCancellationConfirmed(metadata("cancelled"))).toBe(true)
    for (const state of ["pending", "scheduled", "rejected", "accepted"]) {
      expect(providerCancellationConfirmed(metadata(state))).toBe(false)
    }
    for (const status of ["pending", "unknown"]) {
      expect(providerCancellationConfirmed(metadata("cancelled", { operation: { status } }))).toBe(false)
      expect(providerCancellationConfirmed(metadata("cancelled", { sync_status: status }))).toBe(false)
    }
    expect(providerCancellationConfirmed(null)).toBe(false)
  })

  it("produces a VOID for prior work, but no additions or quantity changes", () => {
    const previous = mapSaleOrderItemsToDeltaLines(items)
    const delta = cancellationOnlyDelta(computeKitchenDelta(previous, []))
    expect(delta.kind).toBe("delta")
    expect(delta.voids).toEqual([expect.objectContaining({ itemId: "meal", quantity: 2 })])
    expect(delta.adds).toEqual([])
    expect(delta.qtyChanges).toEqual([])
    expect(cancellationOnlyDelta(computeKitchenDelta([], previous))).toEqual({ kind: "none", adds: [], qtyChanges: [], voids: [] })
    const cancelled = items.map(item => ({ ...item, status: "cancelled" }))
    expect(cancellationOnlyDelta(computeKitchenDelta(mapSaleOrderItemsToDeltaLines(cancelled), []))).toEqual({ kind: "none", adds: [], qtyChanges: [], voids: [] })
    const manual = buildOrderPrintTicket(cancelled, "delta")
    expect(manual.delta.voids[0]).toMatchObject({ itemId: "meal", quantity: 2 })
    expect(manual.printedItems).toEqual([{ id: "meal", quantity: 0 }])
  })

  it("preserves nested modifier context on full, manual delta and realtime delta tickets", () => {
    const expected = [{ name: "Side", quantity: 1 }, { name: "Side → No peanuts", quantity: 1 }]
    expect(buildOrderPrintTicket(items, "full").delta.adds[0].modifiers).toEqual(expected)
    const changed = [{ ...items[0], quantity: 3 }, ...items.slice(1)]
    expect(buildOrderPrintTicket(changed, "delta").delta.qtyChanges[0].modifiers).toEqual(expected)
    expect(computeKitchenDelta(mapSaleOrderItemsToDeltaLines(items), mapSaleOrderItemsToDeltaLines(changed)).qtyChanges[0].modifiers).toEqual(expected)
  })

  it("matches unmapped marketplace lines by durable row ID without duplicate ADD/VOID", () => {
    const lines = mapSaleOrderItemsToDeltaLines(items)
    expect(computeKitchenDelta(lines, lines)).toEqual({ kind: "none", adds: [], qtyChanges: [], voids: [] })
  })

  it("terminates malformed cyclic modifier graphs", () => {
    const lines = [
      { key: "a", name: "A", quantity: 1, parentKey: "b" },
      { key: "b", name: "B", quantity: 1, parentKey: "a" },
    ]
    expect(kitchenModifiersFor(lines[0], lines)).toEqual([{ name: "B", quantity: 1 }])
  })

  it("uses confirmed acceptance time, not early import age, retaining the historical-print guard", () => {
    const now = Date.parse("2026-10-20T12:00:00Z")
    const old = "2026-10-17T12:00:00Z"
    const recent = "2026-10-20T11:00:00Z"
    expect(isRecentKitchenOrder({ created_at: old, metadata: metadata("accepted", { accepted_at: recent }) }, now)).toBe(true)
    expect(isRecentKitchenOrder({ created_at: old, metadata: metadata("accepted", { accepted_at: old }) }, now)).toBe(false)
    expect(isRecentKitchenOrder({ created_at: old, metadata: metadata("accepted", { accepted_at: "invalid" }) }, now)).toBe(false)
    expect(isRecentKitchenOrder({ created_at: old, metadata: metadata("accepted", { accepted_at: "2026-10-20T11:00:00" }) }, now)).toBe(false)
    expect(isRecentKitchenOrder({ created_at: old }, now)).toBe(false)
    expect(isRecentKitchenOrder({ created_at: recent }, now)).toBe(true)
    expect(providerAccepted(metadata("scheduled", { scheduled_at: recent }))).toBe(false)
  })
})