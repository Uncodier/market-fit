import { applyStorefrontAvailability, filterReservablePickerItems, isStorefrontAvailable, STOREFRONT_AVAILABILITY_OR } from "@/app/catalog/storefront-availability"

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

describe("filterReservablePickerItems", () => {
  const available = {
    id: "svc-available",
    parent_id: null,
    availability_mode: "manual",
    availability_status: "available",
  }
  const unavailable = {
    id: "svc-unavailable",
    parent_id: null,
    availability_mode: "manual",
    availability_status: "unavailable",
  }
  const soldOut = {
    id: "svc-sold-out",
    parent_id: null,
    availability_mode: "manual",
    availability_status: "sold_out",
  }
  const alwaysOn = {
    id: "svc-always",
    parent_id: null,
    availability_mode: "always",
    availability_status: "unavailable",
  }
  const child = {
    id: "svc-child",
    parent_id: "svc-unavailable",
    availability_mode: "manual",
    availability_status: "available",
  }

  it("hides unavailable parent services and variants", () => {
    expect(
      filterReservablePickerItems([available, unavailable, soldOut, alwaysOn, child]).map((i) => i.id),
    ).toEqual(["svc-available", "svc-always"])
  })

  it("keeps the current parent when editing an unavailable service", () => {
    expect(
      filterReservablePickerItems(
        [available, unavailable, soldOut],
        "svc-unavailable",
      ).map((i) => i.id),
    ).toEqual(["svc-available", "svc-unavailable"])
  })

  it("keeps the parent when the current item is an unavailable variant", () => {
    expect(
      filterReservablePickerItems(
        [available, unavailable, child],
        "svc-child",
      ).map((i) => i.id),
    ).toEqual(["svc-available", "svc-unavailable"])
  })
})
