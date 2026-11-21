import { act, fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps, ReactNode } from "react"
import { SelfServiceHero } from "@/app/shop/[siteSlug]/self-service/SelfServiceHero"
import { LocalizationProvider } from "@/app/context/LocalizationContext"

jest.mock("@/app/components/ui/use-btn-glass-motion", () => {
  const setGlassNode = () => {}
  return { useBtnGlassMotion: () => setGlassNode }
})

const bareSite = { id: "site", name: "Coffee Shop" }
const site = { ...bareSite, settings: { shop: {
  hero_title: "Welcome to Coffee Shop", hero_subtitle: "Roasted daily", hero_cta_label: "Browse menu", hero_image_url: "/shop-cover.png",
  trust_badges: [{ title: "Local roasters" }],
} } }
const promos = ["Coffee deal", "Lunch deal"].map((name, index) => ({
  id: `offer-${index}`, name, discount_type: "percent", discount_value: 10, image_url: `/offer-${index}.png`, catalog_item_ids: [], category_ids: [],
}))
const baseProps = { site, locationId: "branch", searchQuery: "", promos }
const wrapper = ({ children }: { children: ReactNode }) => <LocalizationProvider preferredLocale="en">{children}</LocalizationProvider>
const renderHero = (props: Partial<ComponentProps<typeof SelfServiceHero>> = {}) => render(<SelfServiceHero {...baseProps} {...props} />, { wrapper })
const tick = (time = 5000) => act(() => { jest.advanceTimersByTime(time) })
const shopHeading = () => screen.getByRole("heading", { name: "Welcome to Coffee Shop", level: 1 })
const offerLink = (name: string) => screen.getByRole("link", { name: new RegExp(name) })
const control = (name: string) => screen.getByRole("button", { name })

let reducedMotion: boolean

beforeEach(() => {
  jest.useFakeTimers()
  reducedMotion = false
  jest.spyOn(window, "matchMedia").mockImplementation((media) => ({
    matches: reducedMotion, media, onchange: null, addListener: jest.fn(), removeListener: jest.fn(),
    addEventListener: jest.fn(), removeEventListener: jest.fn(), dispatchEvent: jest.fn(),
  }))
})

afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

it("starts with the configured Shop hero, rotates through offers in the same cover and loops back", () => {
  renderHero()
  const carousel = screen.getByRole("region", { name: "Featured banners" })
  expect(carousel).toHaveClass("h-[580px]", "md:h-[550px]", "-mt-[88px]", "md:-mt-[104px]")
  expect(shopHeading()).toHaveClass("md:text-6xl")
  expect(screen.getByText("Roasted daily")).toBeInTheDocument()
  expect(control("Browse menu")).toBeInTheDocument()
  expect(carousel.querySelector('img[src="/shop-cover.png"]')).toHaveClass("object-cover")
  expect(screen.queryByRole("link")).not.toBeInTheDocument()
  expect(carousel.querySelectorAll("[inert]")).toHaveLength(2)

  tick()
  expect(screen.getByRole("heading", { name: "Coffee deal" })).toHaveClass("md:text-6xl")
  expect(offerLink("Coffee deal")).toHaveAttribute("href", "/shop/branch/promo/offer-0")
  expect(carousel.querySelector('img[src="/offer-0.png"]')).toHaveClass("object-cover")
  expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  tick()
  expect(offerLink("Lunch deal")).toHaveAttribute("href", "/shop/branch/promo/offer-1")
  tick()
  expect(shopHeading()).toBeInTheDocument()
})

it("supports manual navigation and pausing", () => {
  renderHero()
  fireEvent.click(control("Next slide"))
  expect(offerLink("Coffee deal")).toBeInTheDocument()
  fireEvent.click(control("Previous slide"))
  expect(shopHeading()).toBeInTheDocument()
  fireEvent.click(control("Show slide 3"))
  expect(control("Show slide 3")).toHaveAttribute("aria-current", "true")
  fireEvent.click(control("Pause slideshow"))
  tick(10000)
  expect(offerLink("Lunch deal")).toBeInTheDocument()
  fireEvent.click(control("Play slideshow"))
  tick()
  expect(shopHeading()).toBeInTheDocument()
})

it("pauses while hovered, keyboard focused or in a hidden tab", () => {
  renderHero()
  const carousel = screen.getByRole("region", { name: "Featured banners" })
  const hidden = jest.spyOn(document, "hidden", "get").mockReturnValue(true)
  tick()
  expect(shopHeading()).toBeInTheDocument()
  hidden.mockReturnValue(false)
  fireEvent.mouseEnter(carousel)
  fireEvent.focus(control("Browse menu"))
  fireEvent.mouseLeave(carousel)
  tick()
  expect(shopHeading()).toBeInTheDocument()
  fireEvent.mouseEnter(carousel)
  fireEvent.blur(control("Browse menu"), { relatedTarget: null })
  tick()
  expect(shopHeading()).toBeInTheDocument()
  fireEvent.mouseLeave(carousel)
  tick()
  expect(offerLink("Coffee deal")).toBeInTheDocument()
})

it("respects reduced motion while retaining manual navigation", () => {
  reducedMotion = true
  renderHero({ promos: promos.slice(0, 1) })
  tick(10000)
  expect(shopHeading()).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Pause slideshow" })).not.toBeInTheDocument()
  fireEvent.click(control("Next slide"))
  expect(offerLink("Coffee deal")).toBeInTheDocument()
})

it("hides the whole hero during search and restores the original slide when cleared", () => {
  const { rerender } = renderHero()
  fireEvent.click(control("Next slide"))
  rerender(<SelfServiceHero {...baseProps} searchQuery="coffee" />)
  expect(screen.queryByRole("region")).not.toBeInTheDocument()
  expect(screen.queryByText("Local roasters")).not.toBeInTheDocument()
  rerender(<SelfServiceHero {...baseProps} searchQuery="  " />)
  expect(shopHeading()).toBeInTheDocument()
})

it("falls back to the available slides without blank placeholders or redundant controls", () => {
  const { rerender } = renderHero({ site: bareSite })
  fireEvent.click(control("Next slide"))
  expect(offerLink("Lunch deal")).toBeInTheDocument()
  rerender(<SelfServiceHero {...baseProps} site={bareSite} promos={promos.slice(0, 1)} />)
  expect(offerLink("Coffee deal")).toBeInTheDocument()
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  rerender(<SelfServiceHero {...baseProps} promos={[]} />)
  expect(shopHeading()).toBeInTheDocument()
  expect(screen.queryByRole("region")).not.toBeInTheDocument()
  rerender(<SelfServiceHero {...baseProps} site={bareSite} promos={[]} />)
  expect(screen.queryByRole("heading")).not.toBeInTheDocument()
})

it("keeps the original CTA in the kiosk when Shop is configured to open an external link", () => {
  const open = jest.spyOn(window, "open").mockImplementation(() => null)
  const scroll = jest.spyOn(window, "scrollBy").mockImplementation(() => {})
  renderHero({ site: { ...site, settings: { shop: {
    ...site.settings.shop, hero_cta_destination_type: "url", hero_cta_destination_value: "https://example.com/",
  } } } })
  fireEvent.click(control("Browse menu"))
  expect(open).not.toHaveBeenCalled()
  expect(scroll).toHaveBeenCalledWith({ top: window.innerHeight * 0.7, behavior: "smooth" })
})