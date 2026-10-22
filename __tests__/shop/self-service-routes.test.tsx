import { resolveSelfServiceLocation } from "@/app/commerce/self-service"
import { getShopSite } from "@/app/shop/[siteSlug]/actions"
import { getShopRouteContext } from "@/app/shop/[siteSlug]/shop-route-context"
import ShopBookingPage from "@/app/shop/[siteSlug]/[itemId]/book/page"
import { redirect } from "next/navigation"

jest.mock("@/app/commerce/self-service", () => ({ resolveSelfServiceLocation: jest.fn() }))
jest.mock("@/app/shop/[siteSlug]/actions", () => ({ getShopSite: jest.fn() }))
jest.mock("@/app/shop/[siteSlug]/[itemId]/book/ShopBookingClient", () => ({ __esModule: true, default: () => null }))
jest.mock("next/navigation", () => ({ redirect: jest.fn() }))

const locationId = "00000000-0000-0000-0000-000000000001"
const site = { id: "00000000-0000-0000-0000-000000000002", name: "Coffee Shop", logo_url: null }
const selfService = { site, location: { id: locationId, site_id: site.id, name: "Downtown" }, fulfillmentOptions: ["pickup", "dine_in"] as Array<"pickup" | "dine_in"> }

beforeEach(() => { jest.clearAllMocks() })

it("resolves a location UUID first without treating it as a site identifier", async () => {
  jest.mocked(resolveSelfServiceLocation).mockResolvedValue(selfService)
  expect(await getShopRouteContext(locationId)).toEqual({ site, selfService })
  expect(resolveSelfServiceLocation).toHaveBeenCalledWith(locationId)
  expect(getShopSite).not.toHaveBeenCalled()
})

it("preserves normal site slugs and legacy site UUID routes unchanged", async () => {
  jest.mocked(resolveSelfServiceLocation).mockResolvedValue(null)
  jest.mocked(getShopSite).mockResolvedValue(site)
  expect(await getShopRouteContext("coffee-shop")).toEqual({ site, selfService: null })
  expect(getShopSite).toHaveBeenCalledWith("coffee-shop")
  expect(await getShopRouteContext(site.id)).toEqual({ site, selfService: null })
  expect(getShopSite).toHaveBeenCalledWith(site.id)
})

it("does not invent a fallback shop when neither location nor slug exists", async () => {
  jest.mocked(resolveSelfServiceLocation).mockResolvedValue(null)
  jest.mocked(getShopSite).mockResolvedValue(null)
  expect(await getShopRouteContext("missing")).toBeNull()
})

it("redirects nested kiosk bookings to the location menu, never login or standalone checkout", async () => {
  jest.mocked(resolveSelfServiceLocation).mockResolvedValue(selfService)
  jest.mocked(redirect).mockImplementation(() => { throw new Error("redirect") })
  await expect(ShopBookingPage({ params: Promise.resolve({ siteSlug: locationId, itemId: "item" }), searchParams: Promise.resolve({}) })).rejects.toThrow("redirect")
  expect(redirect).toHaveBeenCalledWith(`/shop/${locationId}`)
})