import { matchesBuyerArea, rankMarketplaceCandidates } from "@/app/marketplace/marketplace-ranking"
import { parseMarketplaceProductsRequest } from "@/app/marketplace/marketplace-products-request"

const items = [
  { id: "new", site_id: "site", created_at: "2026-10-15", target_sale_price: 100, currency: "MXN" },
  { id: "global", site_id: "site", created_at: "2026-10-01", target_sale_price: 10, currency: "USD" },
  { id: "local", site_id: "site", created_at: "2026-09-01", target_sale_price: 200, currency: "MXN" },
]
const scores = new Map([
  ["global", { global: 100, local: 0 }],
  ["local", { global: 10, local: 10 }],
])
const ids = (rows: typeof items) => rows.map(item => item.id)

describe("marketplace product ranking", () => {
  it("features local top sales ahead of global best sellers without mutating input", () => {
    expect(ids(rankMarketplaceCandidates(items, "featured", scores))).toEqual(["local", "global", "new"])
    expect(ids(items)).toEqual(["new", "global", "local"])
  })
  it("uses global sales when no local sales exist", () => {
    const globalScores = new Map([...scores].map(([id, score]) => [id, { ...score, local: 0 }]))
    expect(ids(rankMarketplaceCandidates(items, "featured", globalScores))).toEqual(["global", "local", "new"])
  })
  it("best selling ignores geography and newest ignores sales", () => {
    expect(ids(rankMarketplaceCandidates(items, "best_selling", scores))).toEqual(["global", "local", "new"])
    expect(ids(rankMarketplaceCandidates(items, "newest", scores))).toEqual(["new", "global", "local"])
  })
  it("falls back to deterministic newest-first ordering when no sales exist", () => {
    expect(ids(rankMarketplaceCandidates(items, "featured"))).toEqual(["new", "global", "local"])
    const tied = [{ ...items[0], id: "b" }, { ...items[0], id: "a" }]
    expect(ids(rankMarketplaceCandidates(tied, "featured"))).toEqual(["a", "b"])
  })
  it("compares prices in a common currency and puts unknown prices last", () => {
    expect(ids(rankMarketplaceCandidates(items, "price_asc", scores, { MXN: 20 }))).toEqual(["new", "global", "local"])
    expect(ids(rankMarketplaceCandidates(items, "price_desc", scores, { MXN: 10 }))).toEqual(["local", "new", "global"])
    expect(ids(rankMarketplaceCandidates(items, "price_asc"))).toEqual(["global", "new", "local"])
  })
  it("matches city names and country aliases without broadening city to country", () => {
    expect(matchesBuyerArea({ city: " LEÓN ", country: "MX" }, { city: "Leon", country: "Mexico" })).toBe(true)
    expect(matchesBuyerArea({ city: "Leon", country: "US" }, { city: "Leon", country: "Mexico" })).toBe(false)
    expect(matchesBuyerArea({ country: "MX" }, { city: "Leon", country: "MX" })).toBe(false)
    expect(matchesBuyerArea({ country: "MX" }, { country: "Mexico" })).toBe(true)
    expect(matchesBuyerArea({ zip: "12345" }, { zip: "12345" })).toBe(true)
    expect(matchesBuyerArea({ state: "Guanajuato" }, { state: "Guanajuato" })).toBe(true)
    expect(matchesBuyerArea({}, {})).toBe(false)
  })
})

describe("public marketplace input validation", () => {
  it("defaults to featured and bounded pagination", () => {
    expect(parseMarketplaceProductsRequest(new URLSearchParams())).toMatchObject({ sort: "featured", page: 1, limit: 36 })
  })
  it.each(["page=0", "page=1.5", "page=abc", "limit=101", "limit=-1", "sort=popular", "siteId=other", "kind=secret", "digitalSubtype=other", "latitude=91", "longitude=-181"])("rejects %s", value => {
    expect(parseMarketplaceProductsRequest(new URLSearchParams(value))).toBeNull()
  })
  it("accepts location as a ranking preference and preserves category filters", () => {
    expect(parseMarketplaceProductsRequest(new URLSearchParams("sort=price_asc&kind=digital_asset&digitalSubtype=course&city=Leon&country=MX&is_recurring=true")))
      .toMatchObject({ sort: "price_asc", kind: "digital_asset", digitalSubtype: "course", isRecurring: true, buyerGeo: { city: "Leon", country: "MX" } })
  })
})