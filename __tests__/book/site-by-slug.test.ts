import { toSiteSlug } from "@/app/book/site-by-slug"

describe("toSiteSlug", () => {
  it("slugifies a simple store name", () => {
    expect(toSiteSlug("Pigs")).toBe("pigs")
  })

  it("strips leading and trailing spaces so /shop/pigs matches 'Pigs '", () => {
    expect(toSiteSlug("Pigs ")).toBe("pigs")
    expect(toSiteSlug(" Pigs")).toBe("pigs")
    expect(toSiteSlug("  Pigs  ")).toBe("pigs")
  })

  it("collapses punctuation and hyphens without leaving edge dashes", () => {
    expect(toSiteSlug("Pigs, Inc.")).toBe("pigs-inc")
    expect(toSiteSlug("My Shop")).toBe("my-shop")
    expect(toSiteSlug("pigs-")).toBe("pigs")
    expect(toSiteSlug("-pigs")).toBe("pigs")
  })

  it("returns empty for names with no alphanumeric characters", () => {
    expect(toSiteSlug("   ")).toBe("")
    expect(toSiteSlug("---")).toBe("")
  })
})
