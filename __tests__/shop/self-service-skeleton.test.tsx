import { render, screen } from "@testing-library/react"
import ShopLoading from "@/app/shop/[siteSlug]/(home)/loading"
import ShopPdpLoading from "@/app/shop/[siteSlug]/[itemId]/loading"
import MarketplacePdpLoading from "@/app/marketplace/[itemId]/loading"
import { ShopIdentifierSkeleton } from "@/app/shop/[siteSlug]/ShopIdentifierSkeleton"
import { useOptionalSelfService } from "@/app/shop/[siteSlug]/self-service/SelfServiceProvider"
import { LocalizationProvider } from "@/app/context/LocalizationContext"
import { useSelectedLayoutSegments } from "next/navigation"

jest.mock("@testing-library/react", () => {
  const actual = jest.requireActual("@testing-library/react")
  return { ...actual, render: (ui: React.ReactNode) => actual.render(<LocalizationProvider preferredLocale="en">{ui}</LocalizationProvider>) }
})

jest.mock("@/app/shop/[siteSlug]/self-service/SelfServiceProvider", () => ({ useOptionalSelfService: jest.fn() }))
jest.mock("next/navigation", () => ({ useSelectedLayoutSegments: jest.fn(), usePathname: jest.fn() }))

it("replaces the kiosk loading message with header, full-width hero and product placeholders", () => {
  jest.mocked(useOptionalSelfService).mockReturnValue({ context: { site: { name: "Coffee Shop" } } } as ReturnType<typeof useOptionalSelfService>)
  render(<ShopLoading />)
  expect(screen.getByRole("status", { name: "Loading menu" })).toHaveAttribute("aria-busy", "true")
  expect(screen.queryByText("Loading menu…")).not.toBeInTheDocument()
  expect(document.querySelector("[data-commerce-shell-header]")).toBeInTheDocument()
  expect(screen.getByTestId("shop-skeleton-hero")).toHaveClass("h-[580px]", "md:h-[550px]", "-mt-[88px]")
  expect(screen.getByTestId("shop-skeleton-products").children).toHaveLength(8)
  expect(screen.queryByText("Sign In")).not.toBeInTheDocument()
})

it("preserves the regular storefront skeleton", () => {
  jest.mocked(useOptionalSelfService).mockReturnValue(null)
  render(<ShopLoading />)
  expect(screen.getByTestId("shop-home-skeleton")).toBeInTheDocument()
  expect(screen.getByTestId("shop-skeleton-products").children).toHaveLength(8)
})

it.each([
  [["(home)"], "shop-home-skeleton"],
  [["coffee"], "pdp-page-skeleton"],
])("selects the matching skeleton while resolving the identifier for %j", (segments, skeletonId) => {
  jest.mocked(useSelectedLayoutSegments).mockReturnValue(segments)
  render(<ShopIdentifierSkeleton />)
  expect(screen.getByTestId(skeletonId)).toHaveAttribute("aria-busy", "true")
})

it.each([ShopPdpLoading, MarketplacePdpLoading])("uses the same product skeleton for %p", (Loading) => {
  render(<Loading />)
  expect(screen.getByTestId("pdp-page-skeleton")).toHaveAttribute("aria-busy", "true")
})