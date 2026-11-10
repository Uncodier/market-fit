import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useSearchParams } from "next/navigation"
import CheckoutClient from "@/app/cart/checkout/CheckoutClient"
import { getCartItems, setCartItems } from "@/app/commerce/cart-storage"
import { getStorefrontCartPrices } from "@/app/commerce/storefront-cart-prices"

jest.mock("@/app/commerce/storefront-cart-prices", () => ({ getStorefrontCartPrices: jest.fn() }))
jest.mock("@/app/inventory/actions", () => ({ listPublicLocations: jest.fn(async () => ({ data: [] })) }))
jest.mock("@/app/book/actions", () => ({ getSiteInfoBySlug: jest.fn(async () => null) }))
jest.mock("@/app/components/auth/auth-provider", () => ({ useAuthContext: () => ({ user: null, isLoading: false }) }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: () => "", locale: "en", applyUnresolvedLocale: jest.fn() }),
}))
jest.mock("@/app/hooks/useSiteTracking", () => ({ useSiteTracking: () => ({ identifyLead: jest.fn() }) }))
jest.mock("@/app/commerce/use-guest-checkout-prefill", () => ({ useGuestCheckoutPrefill: jest.fn() }))
jest.mock("@/app/cart/checkout/use-checkout-submission", () => ({
  useCheckoutSubmission: () => ({ handleCheckout: jest.fn(), checkoutLoading: false }),
}))
jest.mock("@/app/cart/checkout/CheckoutForm", () => ({ CheckoutForm: () => <form aria-label="Payment" /> }))
jest.mock("@/app/cart/checkout/OrderSummary", () => ({ OrderSummary: () => <div>Verified order summary</div> }))
jest.mock("@/app/cart/checkout/CheckoutStates", () => ({
  CheckoutLoadingState: () => <div>Loading</div>, CheckoutEmptyState: () => <div>Cart is empty</div>,
}))

const host = { id: "host", site_id: "seller", name: "Coffee", cartQty: 2, cartPrice: 987.65,
  currency: "USD", lineKey: "with-extra", modifiers: [
    { groupId: "group", catalogItemId: "extra", name: "Milk", cartQty: 1, cartPrice: 876.54 },
  ] }
const healthy = { ...host, name: "Plain coffee", lineKey: "plain", modifiers: [] }
const prices = { items: [{ id: "host", site_id: "seller", price: 10, currency: "USD", dynamic: false }], rates: {} }

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  window.history.replaceState({}, "", "/cart/checkout")
  jest.mocked(getStorefrontCartPrices).mockResolvedValue(prices)
})

it.each([
  ["shop", "cart"], ["marketplace", "cart"], ["shop", "buynow"],
] as const)("persists removal for %s/%s and restores only healthy lines on remount", async (source, mode) => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ source, mode, siteId: "seller" }) as ReturnType<typeof useSearchParams>)
  setCartItems(mode, source, "seller", [host, healthy])
  const view = render(<CheckoutClient />)
  await screen.findByText(/Option unavailable/)
  expect(screen.getAllByText("Quantity: 2")).toHaveLength(2)
  expect(screen.queryByRole("form", { name: "Payment" })).not.toBeInTheDocument()
  expect(view.container.textContent).not.toMatch(/987|876/)
  fireEvent.click(screen.getByRole("button", { name: "Remove affected items" }))
  await screen.findByText("Verified order summary")
  expect(getCartItems(mode, source, "seller").map(line => line.lineKey)).toEqual(["plain"])
  view.unmount()
  render(<CheckoutClient />)
  await screen.findByText("Verified order summary")
  expect(screen.queryByText(/Option unavailable/)).not.toBeInTheDocument()
  expect(getStorefrontCartPrices).toHaveBeenLastCalledWith({ channel: source, ids: ["host"], modifierIds: [] })
})

it("persists clearing an unavailable host and shows the empty state", async () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ source: "marketplace" }) as ReturnType<typeof useSearchParams>)
  setCartItems("cart", "marketplace", null, [host])
  jest.mocked(getStorefrontCartPrices).mockResolvedValue({ items: [], rates: {} })
  render(<CheckoutClient />)
  await screen.findByText("Product unavailable")
  fireEvent.click(screen.getByRole("button", { name: "Clear cart" }))
  await screen.findByText("Cart is empty")
  expect(getCartItems("cart", "marketplace")).toEqual([])
})

it("keeps checkout hidden during a transient failure and restores it after retry", async () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ source: "marketplace" }) as ReturnType<typeof useSearchParams>)
  setCartItems("cart", "marketplace", null, [healthy])
  jest.mocked(getStorefrontCartPrices).mockRejectedValueOnce(new Error("Network unavailable"))
  render(<CheckoutClient />)
  await waitFor(() => expect(screen.getByRole("button", { name: "Retry prices" })).toBeEnabled())
  expect(screen.queryByText("Verified order summary")).not.toBeInTheDocument()
  expect(screen.queryByText("Product unavailable")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Retry prices" }))
  await screen.findByText("Verified order summary")
  expect(getStorefrontCartPrices).toHaveBeenCalledTimes(2)
})