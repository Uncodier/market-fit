import type { ComponentProps } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { MarketplaceHeader } from "@/app/marketplace/MarketplaceHeader"

const mockSignInClick = jest.fn()

jest.mock("@/app/components/commerce/use-commerce-sign-in-href", () => ({
  useCommerceSignInHref: () => ({
    href: "/auth/signin?returnTo=%2Fmarketplace",
    onClick: mockSignInClick,
  }),
}))

jest.mock("@/app/components/commerce/CartButton", () => ({ CartButton: () => null }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: () => "" }),
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
  beforeAll(() => {
    global.ResizeObserver = jest.fn(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }))
  })
  afterAll(() => { global.ResizeObserver = originalResizeObserver })
  beforeEach(() => mockSignInClick.mockClear())

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
    expect(screen.getByRole("link", { name: "Buyer account" })).toHaveAttribute("href", "/buyer")
  })
})