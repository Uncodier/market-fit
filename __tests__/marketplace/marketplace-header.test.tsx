import type { ComponentProps } from "react"
import { useState } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { MarketplaceHeader } from "@/app/marketplace/MarketplaceHeader"

const mockSignInClick = jest.fn()

jest.mock("@/app/components/commerce/use-commerce-sign-in-href", () => ({
  useCommerceSignInHref: () => ({
    href: "/auth/signin?returnTo=%2Fmarketplace",
    onClick: mockSignInClick,
  }),
}))

jest.mock("@/app/components/commerce/CartButton", () => ({ CartButton: ({ onClick }: { onClick?: () => void }) => <button data-testid="cart" onClick={onClick}>Cart</button> }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => jest.requireActual("@/app/context/locale-catalog").localeMessages.en[key] || key }),
}))

const noop = () => undefined
const props: ComponentProps<typeof MarketplaceHeader> = {
  searchQuery: "",
  setSearchQuery: noop,
  searchPlaceholder: "Search products",
  searchLabel: "Search",
  mobileSearchOpen: false,
  setMobileSearchOpen: noop,
  locale: "en",
  setLocale: noop,
  cartCount: 0,
  subtotal: 0,
  onCartOpen: noop,
  session: null,
  signInLabel: "Sign In",
}

describe("MarketplaceHeader sign-in", () => {
  const originalResizeObserver = global.ResizeObserver
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
  beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = jest.fn()
    global.ResizeObserver = jest.fn(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }))
  })
  afterAll(() => {
    global.ResizeObserver = originalResizeObserver
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView
  })
  beforeEach(() => mockSignInClick.mockClear())

  it.each([null, { user: { user_metadata: {} } }])("only shows purchases for signed-in users and preserves the cart (%s)", (session) => {
    const onCartOpen = jest.fn()
    render(<MarketplaceHeader {...props} session={session} onCartOpen={onCartOpen} />)
    const purchases = screen.queryByRole("link", { name: "My purchases" })
    if (session) {
      expect(purchases).toHaveAttribute("href", "/home/orders")
      expect(purchases).toHaveClass("hidden", "lg:inline-flex")
    } else expect(purchases).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId("cart"))
    expect(onCartOpen).toHaveBeenCalledTimes(1)
  })

  it("uses the toolbar MuseoModerno font for the lowercase brand title", () => {
    render(<MarketplaceHeader {...props} />)
    const title = screen.getByText("marketplace")
    expect(title.closest("[data-toolbar-font]")).toHaveAttribute("href", "/marketplace")
    expect(screen.getByPlaceholderText("Search products").parentElement?.parentElement?.parentElement).toHaveClass("w-2/5", "absolute", "hidden", "md:block")
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument()
  })

  it("offers all supported languages without changing the header button styling", async () => {
    const setLocale = jest.fn()
    const scrollIntoView = jest.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {})
    render(<MarketplaceHeader {...props} setLocale={setLocale} />)
    fireEvent.keyDown(screen.getByRole("button", { name: "Change language" }), { key: "ArrowDown" })
    const options = await screen.findAllByRole("menuitem")
    expect(options.map((option) => option.textContent)).toEqual(["English", "Español", "Français", "Deutsch", "日本語"])
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "日本語" }), { key: "Enter" })
    expect(setLocale).toHaveBeenCalledWith("ja")
    scrollIntoView.mockRestore()
  })

  it("matches Shop's primary button dimensions while preserving navigation", () => {
    render(<MarketplaceHeader {...props} />)

    const links = screen.getAllByRole("link", { name: "Sign In" })
    const desktopLink = links.find((link) => link.classList.contains("btn-primary"))
    expect(desktopLink).toHaveAttribute("href", "/auth/signin?returnTo=%2Fmarketplace")
    expect(desktopLink).toHaveClass("h-9", "!min-w-0", "px-[15px]", "py-[7px]", "font-bold")
    expect(desktopLink?.parentElement).toHaveClass("btn-primary-well")
    expect(desktopLink?.parentElement?.parentElement).toHaveClass("hidden", "md:inline-flex", "ml-1")
    expect(desktopLink?.querySelector("button")).toBeNull()

    fireEvent.click(desktopLink!)
    expect(mockSignInClick).toHaveBeenCalledTimes(1)

    const mobileLink = links.find((link) => link.classList.contains("md:hidden"))
    expect(mobileLink).toHaveClass("h-9", "w-9")
    expect(mobileLink).not.toHaveClass("btn-primary")
    expect(mobileLink).toHaveAttribute("href", "/auth/signin?returnTo=%2Fmarketplace")
    fireEvent.click(mobileLink!)
    expect(mockSignInClick).toHaveBeenCalledTimes(2)
  })

  it("keeps the buyer avatar instead of sign-in buttons for signed-in users", () => {
    render(<MarketplaceHeader {...props} session={{ user: { user_metadata: {} } }} />)

    expect(screen.queryByRole("link", { name: "Sign In" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/buyer")
  })

  it.each([false, true])("clears search and keeps the input focused (mobile: %s)", (mobile) => {
    const setMobileSearchOpen = jest.fn()
    function SearchHeader() {
      const [searchQuery, setSearchQuery] = useState("")
      return <MarketplaceHeader {...props} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        mobileSearchOpen={mobile} setMobileSearchOpen={setMobileSearchOpen} />
    }
    render(<SearchHeader />)
    const input = screen.getAllByPlaceholderText("Search products").find((element) =>
      mobile ? element.id === "mobile-search-input" : element.id !== "mobile-search-input",
    )!
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: "coffee" } })
    expect(screen.getAllByPlaceholderText("Search products").every((element) =>
      (element as HTMLInputElement).value === "coffee",
    )).toBe(true)

    const searchField = input.parentElement!.parentElement!
    fireEvent.click(within(searchField).getByRole("button", { name: "Clear search" }))
    expect(input).toHaveValue("")
    expect(input).toHaveFocus()
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument()
    expect(setMobileSearchOpen).not.toHaveBeenCalled()
  })
})