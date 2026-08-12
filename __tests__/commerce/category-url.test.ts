import {
  buildMarketplaceCategorySearch,
  parseMarketplaceKind,
  parseMarketplaceSubtype,
} from "@/app/marketplace/marketplace-category-url"
import { matchShopCategory } from "@/app/shop/[siteSlug]/shop-category-url"

describe("marketplace category URL", () => {
  it("parses known kinds and subtypes", () => {
    expect(parseMarketplaceKind("product")).toBe("product")
    expect(parseMarketplaceKind("nope")).toBe("all")
    expect(parseMarketplaceSubtype("course")).toBe("course")
    expect(parseMarketplaceSubtype("nope")).toBe("all")
  })

  it("writes filter/subtype while preserving other params", () => {
    const qs = buildMarketplaceCategorySearch("ownerSiteId=abc&cart=1", {
      kind: "digital_asset",
      subtype: "ticket",
    })
    const params = new URLSearchParams(qs)
    expect(params.get("ownerSiteId")).toBe("abc")
    expect(params.get("cart")).toBe("1")
    expect(params.get("filter")).toBe("digital_asset")
    expect(params.get("subtype")).toBe("ticket")
  })

  it("clears filter/subtype for all", () => {
    const qs = buildMarketplaceCategorySearch("filter=product&subtype=course&cart=1", {
      kind: "all",
      subtype: "course",
    })
    const params = new URLSearchParams(qs)
    expect(params.has("filter")).toBe(false)
    expect(params.has("subtype")).toBe(false)
    expect(params.get("cart")).toBe("1")
  })

  it("drops subtype when leaving digital_asset", () => {
    const qs = buildMarketplaceCategorySearch("filter=digital_asset&subtype=pass", {
      kind: "product",
      subtype: "pass",
    })
    const params = new URLSearchParams(qs)
    expect(params.get("filter")).toBe("product")
    expect(params.has("subtype")).toBe(false)
  })
})

describe("shop category URL", () => {
  it("matches category names case-insensitively", () => {
    const cats = ["Coffee", "Pastries", "Other"]
    expect(matchShopCategory("Pastries", cats)).toBe("Pastries")
    expect(matchShopCategory("pastries", cats)).toBe("Pastries")
    expect(matchShopCategory("all", cats)).toBeNull()
    expect(matchShopCategory("Missing", cats)).toBeNull()
  })
})
