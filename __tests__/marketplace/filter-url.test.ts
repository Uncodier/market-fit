import { buildMarketplaceListingFilterSearch, parseMarketplaceListingFilters } from "@/app/marketplace/marketplace-filter-url"

it("defaults to all regions and no listing filters", () => {
  expect(parseMarketplaceListingFilters(undefined)).toEqual({})
  expect(parseMarketplaceListingFilters("regionCountry=&nearMe=false&availableOnly=1&minPrice=&maxPrice=-2")).toEqual({})
})

it("parses nonnegative bounds, normalized region slugs and applied currency", () => {
  expect(parseMarketplaceListingFilters("regionCountry=United+States&minPrice=0&maxPrice=12.50&availableOnly=true&priceCurrency=mxn")).toEqual({
    regionCountry: "united states", minPrice: 0, maxPrice: 12.5, availableOnly: true, priceCurrency: "MXN",
  })
})

it("normalizes country ISO aliases and discards unknown country input", () => {
  expect(parseMarketplaceListingFilters("regionCountry=MX")).toEqual({ regionCountry: "mexico" })
  expect(parseMarketplaceListingFilters("regionCountry=Not+a+country")).toEqual({})
  expect(parseMarketplaceListingFilters("minPrice=1000000001")).toEqual({})
})

it("makes near me mutually exclusive with region country", () => {
  expect(parseMarketplaceListingFilters("regionCountry=mexico&nearMe=true&country=France&city=Paris")).toEqual({ nearMe: true })
  expect(new URLSearchParams(buildMarketplaceListingFilterSearch("country=France", {
    nearMe: true, regionCountry: "mexico",
  })).get("regionCountry")).toBeNull()
})

it.each(["minPrice=NaN&maxPrice=Infinity", "minPrice=30&maxPrice=20", "minPrice=-1&maxPrice=-5"])(
  "ignores invalid or inverted bounds: %s", (search) => {
    expect(parseMarketplaceListingFilters(`${search}&priceCurrency=USD`)).toEqual({})
  },
)

it("does not persist a currency without a range and ignores invalid currency codes", () => {
  expect(parseMarketplaceListingFilters("priceCurrency=MXN")).toEqual({})
  expect(parseMarketplaceListingFilters("minPrice=1&priceCurrency=USD<script>")).toEqual({ minPrice: 1 })
})

it("sets and clears only listing filters without modifying sort, category, buyer geography or checkout", () => {
  const original = "filter=digital_asset&subtype=course&sort=newest&city=Celaya&country=Mexico&ownerSiteId=buyer&returnTo=%2Fpurchases&regionCountry=france&availableOnly=true"
  const next = new URLSearchParams(buildMarketplaceListingFilterSearch(original, { nearMe: true, maxPrice: 100, priceCurrency: "USD" }))
  expect(next.get("nearMe")).toBe("true")
  expect(next.get("regionCountry")).toBeNull()
  expect(next.get("availableOnly")).toBeNull()
  expect(next.get("maxPrice")).toBe("100")
  const cleared = new URLSearchParams(buildMarketplaceListingFilterSearch(next, {}))
  expect(Object.fromEntries(cleared)).toEqual({
    filter: "digital_asset", subtype: "course", sort: "newest", city: "Celaya", country: "Mexico",
    ownerSiteId: "buyer", returnTo: "/purchases",
  })
})