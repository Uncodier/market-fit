import { mapSaleOrderItemToDeltaLine } from "@/lib/printer/core/order-delta"
import { providerAccepted } from "@/lib/marketplace/presentation"

describe("marketplace kitchen safety", () => {
  it("keeps item instructions visible on the existing kitchen ticket", () => {
    const line = mapSaleOrderItemToDeltaLine({ id: "test-line", name: "Salad", description: "No vinegar", quantity: 1 })
    expect(line.name).toContain("No vinegar")
  })
  it("blocks pending, provisional and uncertain orders before printing", () => {
    const confirmed = { marketplace: { state: "accepted", sync_status: "confirmed", totals_provisional: false } }
    expect(providerAccepted(confirmed)).toBe(true)
    expect(providerAccepted({ marketplace: { ...confirmed.marketplace, state: "pending" } })).toBe(false)
    expect(providerAccepted({ marketplace: { ...confirmed.marketplace, totals_provisional: true } })).toBe(false)
    expect(providerAccepted({ marketplace: { ...confirmed.marketplace, operation: { status: "unknown" } } })).toBe(false)
  })
})