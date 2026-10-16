import {
  MARKETPLACE_SORT_VALUES, parseMarketplaceSort, buildMarketplaceSortSearch,
} from "@/app/marketplace/marketplace-sort"
import { buildMarketplaceCategorySearch } from "@/app/marketplace/marketplace-category-url"

describe("marketplace sort URL", () => {
  it.each(MARKETPLACE_SORT_VALUES)("accepts the agreed %s sort", (sort) => {
    expect(parseMarketplaceSort(sort)).toBe(sort)
  })

  it.each([null, undefined, "", "invalid", "PRICE_ASC", "javascript:alert(1)"])(
    "defaults unknown sort %s to featured", (value) => {
      expect(parseMarketplaceSort(value)).toBe("featured")
    },
  )

  it("updates sort without changing category, geo or checkout parameters", () => {
    const original = new URLSearchParams({
      filter: "digital_asset", subtype: "course", search: "Coffee & tea",
      ownerSiteId: "buyer-one", returnTo: "/purchases/orders?tab=open", cart: "1",
      city: "San Miguel", state: "Guanajuato", country: "Mexico", zip: "00123",
      latitude: "0", longitude: "-100.25", sort: "newest",
    })
    original.append("tag", "one")
    original.append("tag", "two")
    const params = new URLSearchParams(buildMarketplaceSortSearch(original, "price_asc"))
    expect(params.get("sort")).toBe("price_asc")
    expect(original.get("sort")).toBe("newest")
    params.delete("sort")
    const expected = new URLSearchParams(original)
    expected.delete("sort")
    expect(params.toString()).toBe(expected.toString())
  })

  it("canonicalizes featured and invalid values by removing only sort", () => {
    for (const value of ["featured", "unknown"]) {
      expect(buildMarketplaceSortSearch("sort=newest&filter=product&cart=1", value))
        .toBe("filter=product&cart=1")
    }
    expect(buildMarketplaceSortSearch(null, "featured")).toBe("")
    expect(buildMarketplaceSortSearch(undefined, "best_selling")).toBe("sort=best_selling")
  })

  it("keeps the selected sort when changing categories or visiting Discounts", () => {
    const discounts = buildMarketplaceCategorySearch("sort=price_desc&city=Celaya", {
      kind: "discounts", subtype: "all",
    })
    expect(new URLSearchParams(discounts).get("sort")).toBe("price_desc")
    const products = buildMarketplaceCategorySearch(discounts, { kind: "product", subtype: "all" })
    expect(new URLSearchParams(products).get("sort")).toBe("price_desc")
  })
})