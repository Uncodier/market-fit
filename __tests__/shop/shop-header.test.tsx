import type { ComponentProps } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { ShopHeader } from "@/app/shop/[siteSlug]/ShopHeader"

const mockSignInClick = jest.fn()

jest.mock("@/app/components/commerce/use-commerce-sign-in-href", () => ({
  useCommerceSignInHref: () => ({
    href: "/auth/signin?returnTo=%2Fshop%2Fexample",
    onClick: mockSignInClick,
  }),
}))

jest.mock("@/app/components/commerce/CartButton", () => ({ CartButton: () => null }))
jest.mock("@/app/components/commerce/CommerceShareControl", () => ({ CommerceShareControl: () => null }))
jest.mock("@/app/shop/[siteSlug]/CartSidebar", () => ({ CartSidebar: () => null }))

const noop = () => undefined
const props: ComponentProps<typeof ShopHeader> = {
  site: { id: "site-1", name: "Example Shop" },
  siteSlug: "example",
  searchQuery: "",
  setSearchQuery: noop,
  searchPlaceholder: "Search products",
  searchLabel: "Search",
  mobileSearchOpen: false,
  setMobileSearchOpen: noop,
  session: null,
  signInLabel: "Sign In",
  cart: [],
  cartCount: 0,
  subtotal: 0,
  isCartOpen: false,
  setIsCartOpen: noop,
  updateQty: noop,
  customerName: "",
  setCustomerName: noop,
  customerEmail: "",
  setCustomerEmail: noop,
  fulfillment: "none",
  setFulfillment: noop,
  originLocationId: "",
  setOriginLocationId: noop,
  locations: [],
  promotionCode: "",
  setPromotionCode: noop,
  promoDiscount: 0,
  setPromoDiscount: noop,
  shippingAddress: { line1: "", line2: "", city: "", state: "", zip: "", country: "" },
  setShippingAddress: noop,
  ownerSiteId: null,
  setOwnerSiteId: noop,
  handleCheckout: noop,
  checkoutLoading: false,
  paymentMethod: "card",
  setPaymentMethod: noop,
}

describe("ShopHeader sign-in", () => {
  beforeEach(() => mockSignInClick.mockClear())

  it("uses the primary button while preserving compact dimensions and navigation", () => {
    render(<ShopHeader {...props} />)

    const links = screen.getAllByRole("link", { name: "Sign In" })
    const desktopLink = links.find((link) => link.classList.contains("btn-primary"))
    expect(desktopLink).toHaveAttribute("href", "/auth/signin?returnTo=%2Fshop%2Fexample")
    expect(desktopLink).toHaveClass("h-9", "!min-w-0", "px-[15px]", "py-[7px]", "font-bold")
    expect(desktopLink?.parentElement).toHaveClass("btn-primary-well")
    expect(desktopLink?.parentElement?.parentElement).toHaveClass("hidden", "md:inline-flex", "ml-1")
    expect(desktopLink?.querySelector("button")).toBeNull()

    fireEvent.click(desktopLink!)
    expect(mockSignInClick).toHaveBeenCalledTimes(1)

    const mobileLink = links.find((link) => link.classList.contains("md:hidden"))
    expect(mobileLink).toHaveClass("h-9", "w-9")
    expect(mobileLink).not.toHaveClass("btn-primary")
  })

  it("keeps the buyer avatar instead of sign-in buttons for signed-in users", () => {
    render(<ShopHeader {...props} session={{ user: { user_metadata: {} } }} />)

    expect(screen.queryByRole("link", { name: "Sign In" })).not.toBeInTheDocument()
    expect(screen.getAllByRole("link").some((link) => link.getAttribute("href") === "/buyer")).toBe(true)
  })
})