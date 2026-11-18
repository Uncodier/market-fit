import { render, screen } from "@testing-library/react"
import ShopLoading from "@/app/shop/[siteSlug]/(home)/loading"
import { useOptionalSelfService } from "@/app/shop/[siteSlug]/self-service/SelfServiceProvider"
import { LocalizationProvider } from "@/app/context/LocalizationContext"

jest.mock("@testing-library/react", () => {
  const actual = jest.requireActual("@testing-library/react")
  return { ...actual, render: (ui: React.ReactNode) => actual.render(<LocalizationProvider preferredLocale="en">{ui}</LocalizationProvider>) }
})

jest.mock("@/app/shop/[siteSlug]/self-service/SelfServiceProvider", () => ({ useOptionalSelfService: jest.fn() }))
jest.mock("@/app/shop/[siteSlug]/ShopHomeSkeleton", () => ({ ShopHomeSkeleton: () => <div data-testid="normal-shop-skeleton" /> }))

it("replaces the kiosk loading message with header, offers and product placeholders", () => {
  jest.mocked(useOptionalSelfService).mockReturnValue({} as ReturnType<typeof useOptionalSelfService>)
  render(<ShopLoading />)
  expect(screen.getByRole("status", { name: "Loading menu" })).toHaveAttribute("aria-busy", "true")
  expect(screen.queryByText("Loading menu…")).not.toBeInTheDocument()
  expect(document.querySelector("[data-commerce-shell-header]")).toBeInTheDocument()
  expect(screen.getByTestId("self-service-skeleton-offers")).toBeInTheDocument()
  expect(screen.getByTestId("self-service-skeleton-products").children).toHaveLength(8)
  expect(screen.queryByTestId("normal-shop-skeleton")).not.toBeInTheDocument()
})

it("preserves the regular storefront skeleton", () => {
  jest.mocked(useOptionalSelfService).mockReturnValue(null)
  render(<ShopLoading />)
  expect(screen.getByTestId("normal-shop-skeleton")).toBeInTheDocument()
})