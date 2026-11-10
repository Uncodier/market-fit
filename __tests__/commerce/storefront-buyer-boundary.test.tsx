import { render, screen } from "@testing-library/react"
import { StorefrontBuyerBoundary } from "@/app/components/commerce/StorefrontBuyerBoundary"

let auth: { user: { id: string; email?: string } | null; isLoading: boolean }
jest.mock("@/app/components/auth/auth-provider", () => ({ useAuthContext: () => auth }))

it("does not discard hydrated content on initialization or token-only updates", () => {
  auth = { user: null, isLoading: true }
  const { rerender } = render(<StorefrontBuyerBoundary><div>Catalog</div></StorefrontBuyerBoundary>)
  auth = { user: { id: "buyer" }, isLoading: false }
  rerender(<StorefrontBuyerBoundary><div>Catalog</div></StorefrontBuyerBoundary>)
  expect(screen.getByText("Catalog")).toBeInTheDocument()
  auth = { user: { id: "buyer" }, isLoading: false }
  rerender(<StorefrontBuyerBoundary><div>Catalog</div></StorefrontBuyerBoundary>)
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
})

it("hides the former customer's catalog immediately on logout", () => {
  // jsdom logs unsupported hard navigation; production performs a document reload.
  const log = jest.spyOn(console, "error").mockImplementation(() => undefined)
  auth = { user: { id: "buyer" }, isLoading: false }
  const { rerender } = render(<StorefrontBuyerBoundary><div>Personal price</div></StorefrontBuyerBoundary>)
  localStorage.setItem("market-cart-marketplace", JSON.stringify([{ id: "item", cartQty: 2, cartPrice: 12,
    target_sale_price: 12, modifiers: [{ catalogItemId: "extra", cartPrice: 3 }] }]))
  auth = { user: null, isLoading: false }
  rerender(<StorefrontBuyerBoundary><div>Personal price</div></StorefrontBuyerBoundary>)
  expect(screen.queryByText("Personal price")).not.toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("Refreshing prices")
  expect(JSON.parse(localStorage.getItem("market-cart-marketplace")!)[0]).toMatchObject({
    id: "item", cartQty: 2, cartPrice: 0, target_sale_price: null, modifiers: [{ cartPrice: 0 }],
  })
  localStorage.clear()
  log.mockRestore()
})