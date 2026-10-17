import { localizeMarketplaceRegion } from "@/app/marketplace/marketplace-region-label"

describe("marketplace country display labels", () => {
  it.each(["en", "es", "fr", "de", "ja"] as const)("localizes canonical countries for %s without changing filter values", (locale) => {
    const country = "united states"
    expect(localizeMarketplaceRegion(country, "United States", locale)).toBe(
      new Intl.DisplayNames([locale], { type: "region" }).of("US"),
    )
    expect(localizeMarketplaceRegion("MX", "Mexico", locale)).toBe(
      new Intl.DisplayNames([locale], { type: "region" }).of("MX"),
    )
    expect(country).toBe("united states")
  })

  it("preserves unknown labels instead of inventing a region", () => {
    expect(localizeMarketplaceRegion("country-7", "Country-7", "ja")).toBe("Country-7")
  })
})