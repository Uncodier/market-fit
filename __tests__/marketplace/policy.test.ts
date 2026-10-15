import { actionAllowed, confirmedActionState, marketplaceCapabilities } from "@/lib/marketplace/policy"

describe("marketplace operational policy", () => {
  it("does not create or cancel a second marketplace delivery", () => {
    for (const provider of ["rappi", "uber_eats"] as const) {
      for (const state of ["pending", "accepted", "ready", "scheduled", "cancelled", "completed"] as const) {
        const capabilities = marketplaceCapabilities(provider, state, true)
        expect(capabilities.request_delivery).toBe(false)
        expect(capabilities.cancel_delivery).toBe(false)
      }
    }
  })
  it("only exposes documented and configured provider actions", () => {
    expect(marketplaceCapabilities("rappi", "accepted").ready).toBe(false)
    expect(marketplaceCapabilities("rappi", "accepted", true).ready).toBe(true)
    expect(marketplaceCapabilities("rappi", "accepted", true).cancel).toBe(false)
    expect(marketplaceCapabilities("uber_eats", "accepted", true).ready).toBe(false)
    expect(marketplaceCapabilities("uber_eats", "accepted").cancel).toBe(true)
    expect(confirmedActionState("reject")).toBe("rejected")
  })
  it("fails closed for missing, pending, unknown, expired or provisional state", () => {
    const now = Date.now()
    const eligible = { state: "pending", sync_status: "confirmed", capabilities: { accept: true } }
    expect(actionAllowed(eligible, "accept", now)).toBe(true)
    expect(actionAllowed({}, "accept", now)).toBe(false)
    for (const sync_status of ["unknown", "pending"]) {
      expect(actionAllowed({ ...eligible, sync_status }, "accept", now)).toBe(false)
    }
    expect(actionAllowed({ ...eligible, totals_provisional: true }, "accept", now)).toBe(false)
    expect(actionAllowed({ ...eligible, state: "scheduled" }, "accept", now)).toBe(false)
    expect(actionAllowed({ ...eligible, accept_by: new Date(now - 1).toISOString() }, "accept", now)).toBe(false)
    expect(actionAllowed({ ...eligible, accept_by: "invalid" }, "accept", now)).toBe(false)
  })
})