import { useState } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { SelfServiceHeader } from "@/app/shop/[siteSlug]/self-service/SelfServiceHeader"
import { SelfServiceShopClient } from "@/app/shop/[siteSlug]/self-service/SelfServiceShopClient"
import { ShopFulfillmentHeader } from "@/app/shop/[siteSlug]/ShopFulfillmentHeader"
import { useSelfService } from "@/app/shop/[siteSlug]/self-service/SelfServiceProvider"

jest.mock("@/app/shop/[siteSlug]/self-service/SelfServiceProvider", () => ({ useSelfService: jest.fn() }))
jest.mock("@/app/shop/[siteSlug]/self-service/SelfServiceCart", () => ({ SelfServiceCart: () => null }))
jest.mock("@/app/shop/[siteSlug]/self-service/SelfServiceConfirmation", () => ({ SelfServiceConfirmation: () => null }))
jest.mock("@/app/shop/[siteSlug]/ShopCatalogMain", () => ({ ShopCatalogMain: () => null }))
jest.mock("@/app/shop/[siteSlug]/ShopSiteFooter", () => ({ ShopSiteFooter: () => null }))
jest.mock("@/app/shop/[siteSlug]/useShopCatalog", () => ({ useShopCatalog: () => ({ catalogItems: [], categoryOffsets: [] }) }))
jest.mock("@/app/shop/[siteSlug]/self-service/BuyerIdentityScan", () => ({
  BuyerIdentityScan: ({ open }: { open: boolean }) => open ? <div role="dialog" aria-label="Scan buyer QR" /> : null,
}))
jest.mock("@/app/context/DisplayCurrencyContext", () => ({ useDisplayCurrency: () => ({ formatPrice: (value: number) => `$${value}` }) }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ locale: "en", t: (key: string, params?: Record<string, string | number>) => {
    const text = jest.requireActual("@/app/context/locale-catalog").localeMessages.en[key] || key
    return Object.entries(params || {}).reduce((value, [name, replacement]) => value.replaceAll(`{{${name}}}`, String(replacement)), text)
  } }),
}))

const startNewOrder = jest.fn()
const setIdentity = jest.fn()
const state = {
  context: { site: { id: "site", name: "Example Shop" }, location: { id: "branch", name: "Downtown" } },
  cart: [{ cartQty: 2 }], identity: null, startNewOrder, setIdentity,
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useSelfService).mockReturnValue(state as unknown as ReturnType<typeof useSelfService>)
})

it("uses the shared floating Shop shell with compact controls and location-only navigation", () => {
  const onOpenCart = jest.fn()
  render(<SelfServiceHeader onOpenCart={onOpenCart} />)
  const header = screen.getByRole("banner")
  expect(header).toHaveAttribute("data-commerce-shell-header")
  expect(header).toHaveClass("rounded-full")
  expect(screen.getByRole("link", { name: "Example Shop" })).toHaveAttribute("href", "/shop/branch")
  expect(screen.getByText("Example Shop")).toHaveClass("lowercase")
  const cart = screen.getByRole("button", { name: "Cart, 2 items" })
  expect(cart).not.toHaveClass("btn-primary")
  fireEvent.click(cart)
  expect(onOpenCart).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole("link", { name: /sign in|purchases/i })).not.toBeInTheDocument()
})

it("keeps the logo, back link and cart link in the location flow on detail pages", () => {
  jest.mocked(useSelfService).mockReturnValue({ ...state, context: { ...state.context,
    site: { ...state.context.site, logo_url: "/logo.png" } } } as unknown as ReturnType<typeof useSelfService>)
  render(<SelfServiceHeader backHref="/shop/branch" />)
  expect(screen.getByRole("img", { name: "Example Shop" })).toHaveAttribute("src", "/logo.png")
  expect(screen.getByRole("link", { name: "Back to menu" })).toHaveAttribute("href", "/shop/branch")
  expect(screen.getByRole("link", { name: "Cart, 2 items" })).toHaveAttribute("href", "/shop/branch?cart=1")
})

it("places the kiosk hero directly after the toolbar and hides it when the customer searches", () => {
  jest.mocked(useSelfService).mockReturnValue({ ...state, cart: [], fulfillment: "pickup",
    context: { ...state.context, fulfillmentOptions: ["pickup"] },
  } as unknown as ReturnType<typeof useSelfService>)
  const promos = [{ id: "offer", name: "Coffee deal", catalog_item_ids: [], category_ids: [] }]
  render(<SelfServiceShopClient initialCatalog={[]} initialCount={0} initialCategoryOffsets={[]} promos={promos} promoBadgesByItemId={{}} />)
  const hero = screen.getByRole("region", { name: "Featured banners" })
  expect(screen.getByRole("banner").closest(".sticky")?.nextElementSibling).toBe(hero)
  expect(screen.getByRole("link", { name: /Coffee deal/ })).toHaveAttribute("href", "/shop/branch/promo/offer")
  const search = screen.getByRole("textbox", { name: "Search menu" })
  fireEvent.change(search, { target: { value: "coffee" } })
  expect(screen.queryByRole("region", { name: "Featured banners" })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }))
  expect(screen.getByRole("region", { name: "Featured banners" })).toBeInTheDocument()
})

it("matches Shop and Marketplace's centered search geometry and action spacing", () => {
  render(<SelfServiceHeader searchQuery="" onSearchChange={jest.fn()} onOpenCart={jest.fn()} />)
  const header = screen.getByRole("banner")
  const input = screen.getByRole("textbox", { name: "Search menu" })
  const centeredSearch = input.closest(".absolute.left-1\\/2")
  expect(centeredSearch).toHaveClass("hidden", "md:block", "top-1/2", "w-2/5", "-translate-x-1/2", "-translate-y-1/2", "z-[15]")
  expect(header).toContainElement(centeredSearch as HTMLElement)
  expect(input).toHaveClass("h-9", "rounded-full")
  const actions = header.querySelector("[data-commerce-shell-actions-core]")
  expect(actions).toHaveClass("gap-4", "justify-end", "min-w-0")
  expect(actions).toContainElement(screen.getByRole("button", { name: "Scan buyer QR" }))
  expect(actions).toContainElement(screen.getByRole("button", { name: "Start new order" }))
  expect(actions).toContainElement(screen.getByRole("button", { name: "Cart, 2 items" }))
  expect(actions).not.toContainElement(screen.getByRole("button", { name: "Search menu" }))
  expect(screen.getByText("Example Shop")).toHaveClass("max-w-[150px]", "md:max-w-none")
})

it("preserves optional QR identification and identity removal", () => {
  const { rerender } = render(<SelfServiceHeader />)
  fireEvent.click(screen.getByRole("button", { name: "Scan buyer QR" }))
  expect(screen.getByRole("dialog", { name: "Scan buyer QR" })).toBeInTheDocument()
  jest.mocked(useSelfService).mockReturnValue({ ...state, identity: { name: "Alex", code: "signed" } } as unknown as ReturnType<typeof useSelfService>)
  rerender(<SelfServiceHeader />)
  fireEvent.click(screen.getByRole("button", { name: "Not Alex? Remove" }))
  expect(setIdentity).toHaveBeenCalledWith(null)
})

it("shares clearable desktop/mobile search and resets it for the next customer", () => {
  function Header() {
    const [search, setSearch] = useState("")
    return <SelfServiceHeader searchQuery={search} onSearchChange={setSearch} />
  }
  render(<Header />)
  const input = screen.getByRole("textbox", { name: "Search menu" })
  fireEvent.change(input, { target: { value: "coffee" } })
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }))
  expect(input).toHaveValue("")
  expect(input).toHaveFocus()
  fireEvent.change(input, { target: { value: "tea" } })
  fireEvent.click(screen.getByRole("button", { name: "Search menu" }))
  const mobile = document.getElementById("mobile-search-input")!
  expect(mobile).toHaveValue("tea")
  fireEvent.change(mobile, { target: { value: "milk" } })
  expect(screen.getByRole("textbox", { name: "Search menu" })).toHaveValue("milk")
  fireEvent.keyDown(mobile, { key: "Enter" })
  fireEvent.click(screen.getByRole("button", { name: "Start new order" }))
  expect(startNewOrder).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("textbox", { name: "Search menu" })).toHaveValue("")
})

it("reuses Shop fulfillment segments without offering scheduling or shipping", () => {
  const setFulfillment = jest.fn()
  const { rerender } = render(<ShopFulfillmentHeader allowedOptions={["pickup", "dine_in"]} fulfillment="pickup" setFulfillment={setFulfillment} showSingleOption />)
  const group = screen.getByRole("radiogroup")
  expect(within(group).getAllByRole("radio")).toHaveLength(2)
  fireEvent.click(screen.getByRole("radio", { name: "Dine-in" }))
  expect(setFulfillment).toHaveBeenCalledWith("dine_in")
  expect(screen.queryByRole("button", { name: /schedule/i })).not.toBeInTheDocument()
  rerender(<ShopFulfillmentHeader allowedOptions={["pickup"]} fulfillment="pickup" setFulfillment={setFulfillment} showSingleOption />)
  expect(screen.getByRole("radio", { name: "Pickup" })).toHaveAttribute("aria-checked", "true")
})