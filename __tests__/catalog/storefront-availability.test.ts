import { applyStorefrontAvailability, isStorefrontAvailable, STOREFRONT_AVAILABILITY_OR } from "@/app/catalog/storefront-availability"

describe("isStorefrontAvailable", () => {
  it("shows always-available items regardless of status", () => {
    expect(isStorefrontAvailable({ availability_mode: "always", availability_status: "unavailable" })).toBe(true)
    expect(isStorefrontAvailable({ availability_mode: "always", availability_status: "sold_out" })).toBe(true)
    expect(isStorefrontAvailable({ availability_mode: "always", availability_status: "available" })).toBe(true)
  })

  it("shows inventory-mode items regardless of status", () => {
    expect(isStorefrontAvailable({ availability_mode: "inventory", availability_status: "unavailable" })).toBe(true)
    expect(isStorefrontAvailable({ availability_mode: "inventory", availability_status: "sold_out" })).toBe(true)
    expect(isStorefrontAvailable({ availability_mode: "inventory", availability_status: "available" })).toBe(true)
  })

  it("shows null-mode items (same as JS !== manual)", () => {
    expect(isStorefrontAvailable({ availability_mode: null, availability_status: "unavailable" })).toBe(true)
    expect(isStorefrontAvailable({ availability_status: "unavailable" })).toBe(true)
  })

  it("shows manual items that are available", () => {
    expect(isStorefrontAvailable({ availability_mode: "manual", availability_status: "available" })).toBe(true)
  })

  it("hides manual items that are unavailable or sold out", () => {
    expect(isStorefrontAvailable({ availability_mode: "manual", availability_status: "unavailable" })).toBe(false)
    expect(isStorefrontAvailable({ availability_mode: "manual", availability_status: "sold_out" })).toBe(false)
    expect(isStorefrontAvailable({ availability_mode: "manual", availability_status: null })).toBe(false)
  })
})

describe("applyStorefrontAvailability", () => {
  it("adds the storefront availability or-filter", () => {
    const query = { or: jest.fn().mockReturnThis() }
    const result = applyStorefrontAvailability(query)
    expect(query.or).toHaveBeenCalledWith(STOREFRONT_AVAILABILITY_OR)
    expect(result).toBe(query)
  })
})
