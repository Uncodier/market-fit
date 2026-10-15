import {
  marketplaceMetadata, marketplaceActionAllowed, providerAccepted, postMarketplaceAction,
  safeTrackingUrl, validateMarketplaceAction,
} from "@/lib/marketplace/presentation"

const pending = { provider: "uber_eats", state: "pending", sync_status: "confirmed", totals_provisional: false,
  capabilities: { accept: true, reject: true, request_delivery: true, cancel_delivery: true }, delivery_mode: "marketplace_managed" }

describe("native marketplace presentation safety", () => {
  it("preserves legacy metadata and fails closed for malformed external metadata", () => {
    expect(marketplaceMetadata({ is_modifier: true })).toBeNull()
    expect(providerAccepted({ other: true })).toBe(true)
    expect(marketplaceMetadata({ marketplace: "malformed" })).toEqual({})
    expect(providerAccepted({ marketplace: "malformed" })).toBe(false)
    expect(marketplaceActionAllowed({}, "accept")).toBe(false)
  })
  it("requires explicit confirmed acceptance for printing", () => {
    expect(providerAccepted({ marketplace: pending })).toBe(false)
    expect(providerAccepted({ marketplace: { ...pending, state: "accepted" } })).toBe(true)
    for (const patch of [{ sync_status: "unknown" }, { operation: { status: "unknown" } }, { totals_provisional: true }, { state: "rejected" }]) {
      expect(providerAccepted({ marketplace: { ...pending, state: "accepted", ...patch } })).toBe(false)
    }
  })
  it("requires explicit capabilities and never offers marketplace-managed delivery mutations", () => {
    expect(marketplaceActionAllowed(pending, "accept")).toBe(true)
    expect(marketplaceActionAllowed({ ...pending, capabilities: { accept: "true" } }, "accept")).toBe(false)
    expect(marketplaceActionAllowed({ ...pending, sync_status: "unknown" }, "accept")).toBe(false)
    expect(marketplaceActionAllowed({ ...pending, totals_provisional: true }, "accept")).toBe(false)
    expect(marketplaceActionAllowed(pending, "request", "shipments")).toBe(false)
    expect(marketplaceActionAllowed(pending, "cancel", "shipments")).toBe(false)
    expect(marketplaceActionAllowed({ ...pending, delivery_mode: "merchant_managed" }, "request", "shipments")).toBe(true)
  })
  it("validates the contracted duration and reason", () => {
    expect(validateMarketplaceAction("accept", "20", "")).toBeNull()
    for (const value of ["", "0", "121", "2.5", "abc"]) expect(validateMarketplaceAction("accept", value, "")).not.toBeNull()
    expect(validateMarketplaceAction("reject", "20", " ")).toBe("Enter a reason.")
    expect(validateMarketplaceAction("cancel", "20", "a".repeat(501))).not.toBeNull()
  })
  it("only allows credential-free HTTPS tracking links", () => {
    expect(safeTrackingUrl("https://tracking.example.test/order")).toBe("https://tracking.example.test/order")
    for (const value of ["javascript:alert(1)", "http://tracking.example.test", "not a URL"]) expect(safeTrackingUrl(value)).toBeNull()
  })
})

describe("marketplace action client", () => {
  beforeEach(() => jest.mocked(fetch).mockReset())
  it("uses same-origin JSON without tenant IDs and accepts only explicit confirmation", async () => {
    jest.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, operation: { status: "confirmed", action: "accept" } }) } as Response)
    expect(await postMarketplaceAction("orders", "order/id", { action: "accept", cooking_time_minutes: 20 })).toMatchObject({ status: "confirmed" })
    expect(fetch).toHaveBeenCalledWith("/api/marketplace/orders/order%2Fid/actions", expect.objectContaining({
      method: "POST", credentials: "same-origin", body: JSON.stringify({ action: "accept", cooking_time_minutes: 20 }),
    }))
  })
  it("keeps HTTP202 unknown distinct from success", async () => {
    jest.mocked(fetch).mockResolvedValue({ ok: true, status: 202, json: async () => ({ success: false, operation: { status: "unknown" } }) } as Response)
    expect(await postMarketplaceAction("orders", "order", { action: "accept" })).toMatchObject({ status: "unknown", message: expect.stringContaining("Do not repeat") })
  })
  it("treats timeout, malformed acknowledgements and server failures as unknown without retry", async () => {
    jest.mocked(fetch).mockRejectedValue(new Error("timeout"))
    expect((await postMarketplaceAction("orders", "order", { action: "accept" })).status).toBe("unknown")
    expect(fetch).toHaveBeenCalledTimes(1)
    jest.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) } as Response)
    expect((await postMarketplaceAction("orders", "order", { action: "accept" })).status).toBe("unknown")
    jest.mocked(fetch).mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: "Unavailable" }) } as Response)
    expect((await postMarketplaceAction("orders", "order", { action: "accept" })).status).toBe("unknown")
  })
  it("surfaces authorization denial as failure, never acceptance", async () => {
    jest.mocked(fetch).mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: "Permission denied" }) } as Response)
    expect(await postMarketplaceAction("orders", "order", { action: "accept" })).toEqual({ status: "failed", message: "Permission denied" })
  })
})