import { act, fireEvent, render, screen } from "@testing-library/react"
import { SelfServiceCoupons } from "@/app/shop/[siteSlug]/self-service/SelfServiceCoupons"
import type { StorefrontPromoCard } from "@/app/promotions/promotion-merchandising"
import { LocalizationProvider } from "@/app/context/LocalizationContext"

jest.mock("@testing-library/react", () => {
  const actual = jest.requireActual("@testing-library/react")
  return { ...actual, render: (ui: React.ReactNode) => actual.render(ui, { wrapper: ({ children }: { children: React.ReactNode }) => <LocalizationProvider preferredLocale="en">{children}</LocalizationProvider> }) }
})

const promos: StorefrontPromoCard[] = ["Coffee deal", "Lunch deal"].map((name, index) => ({
  id: `offer-${index}`, name, discount_type: "percent", discount_value: 10, catalog_item_ids: [], category_ids: [],
}))
let reducedMotion = false

beforeEach(() => {
  jest.useFakeTimers()
  reducedMotion = false
  jest.spyOn(window, "matchMedia").mockImplementation((media) => ({
    matches: reducedMotion, media, onchange: null, addListener: jest.fn(), removeListener: jest.fn(),
    addEventListener: jest.fn(), removeEventListener: jest.fn(), dispatchEvent: jest.fn(),
  }))
})

afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

it("slides automatically, loops and only exposes the active location-scoped offer", () => {
  render(<SelfServiceCoupons promos={promos} locationId="branch" />)
  expect(screen.getByRole("link")).toHaveAttribute("href", "/shop/branch/promo/offer-0")
  expect(screen.getByRole("link", { hidden: true, name: /Lunch deal/ }).closest("[inert]")).toBeInTheDocument()
  act(() => { jest.advanceTimersByTime(5000) })
  expect(screen.getByRole("link")).toHaveAttribute("href", "/shop/branch/promo/offer-1")
  act(() => { jest.advanceTimersByTime(5000) })
  expect(screen.getByRole("link")).toHaveAttribute("href", "/shop/branch/promo/offer-0")
})

it("supports manual navigation and pausing", () => {
  render(<SelfServiceCoupons promos={promos} locationId="branch" />)
  fireEvent.click(screen.getByRole("button", { name: "Next offer" }))
  expect(screen.getByRole("link")).toHaveAttribute("href", "/shop/branch/promo/offer-1")
  fireEvent.click(screen.getByRole("button", { name: "Previous offer" }))
  expect(screen.getByRole("link")).toHaveAttribute("href", "/shop/branch/promo/offer-0")
  fireEvent.click(screen.getByRole("button", { name: "Show offer 2" }))
  fireEvent.click(screen.getByRole("button", { name: "Pause offers" }))
  act(() => { jest.advanceTimersByTime(10000) })
  expect(screen.getByRole("link")).toHaveAttribute("href", "/shop/branch/promo/offer-1")
  fireEvent.click(screen.getByRole("button", { name: "Play offers" }))
  act(() => { jest.advanceTimersByTime(5000) })
  expect(screen.getByRole("link")).toHaveAttribute("href", "/shop/branch/promo/offer-0")
})

it("pauses during hover and keyboard interaction", () => {
  render(<SelfServiceCoupons promos={promos} locationId="branch" />)
  const carousel = screen.getByRole("region", { name: "Offers" })
  fireEvent.mouseEnter(carousel)
  act(() => { jest.advanceTimersByTime(5000) })
  expect(screen.getByRole("link")).toHaveAttribute("href", "/shop/branch/promo/offer-0")
  fireEvent.mouseLeave(carousel)
  fireEvent.focus(screen.getByRole("link"))
  act(() => { jest.advanceTimersByTime(5000) })
  expect(screen.getByRole("link")).toHaveAttribute("href", "/shop/branch/promo/offer-0")
  fireEvent.blur(screen.getByRole("link"), { relatedTarget: null })
  act(() => { jest.advanceTimersByTime(5000) })
  expect(screen.getByRole("link")).toHaveAttribute("href", "/shop/branch/promo/offer-1")
})

it("respects reduced motion while retaining manual navigation", () => {
  reducedMotion = true
  render(<SelfServiceCoupons promos={promos} locationId="branch" />)
  act(() => { jest.advanceTimersByTime(10000) })
  expect(screen.getByRole("link")).toHaveAttribute("href", "/shop/branch/promo/offer-0")
  expect(screen.queryByRole("button", { name: "Pause offers" })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Next offer" }))
  expect(screen.getByRole("link")).toHaveAttribute("href", "/shop/branch/promo/offer-1")
})

it("handles one, zero and shrinking offer lists without empty slides", () => {
  const { rerender } = render(<SelfServiceCoupons promos={promos} locationId="branch" />)
  fireEvent.click(screen.getByRole("button", { name: "Next offer" }))
  rerender(<SelfServiceCoupons promos={promos.slice(0, 1)} locationId="branch" />)
  expect(screen.getByRole("link")).toHaveAttribute("href", "/shop/branch/promo/offer-0")
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  rerender(<SelfServiceCoupons promos={[]} locationId="branch" />)
  expect(screen.queryByRole("region")).not.toBeInTheDocument()
})