import { fireEvent, render, screen, within } from "@testing-library/react"
import { CartPricingRecovery } from "@/app/components/commerce/CartPricingRecovery"

const props = {
  items: [
    { id: "host", lineKey: "configured", name: "Coffee", cartQty: 2, cartPrice: 987.65,
      modifiers: [{ catalogItemId: "extra", name: "Milk", cartQty: 3, cartPrice: 876.54 }] },
    { id: "host", lineKey: "plain", name: "Plain coffee", cartQty: 1, cartPrice: 765.43 },
  ],
  pricingError: "An option is unavailable.",
  pricingAffectedLineIds: ["configured"],
  pricingUnavailableItemIds: ["extra"],
  retryPricing: jest.fn(),
  onRemoveLines: jest.fn(),
}

beforeEach(() => jest.clearAllMocks())

it("shows names, quantities and affected options without stale prices or payment controls", () => {
  const { container } = render(<CartPricingRecovery {...props} />)
  expect(screen.getByText("Coffee")).toBeInTheDocument()
  expect(screen.getByText("Quantity: 2")).toBeInTheDocument()
  expect(screen.getByText(/Milk — Quantity: 3 — Option unavailable/)).toBeInTheDocument()
  const healthy = screen.getByText("Plain coffee").closest("li")!
  expect(within(healthy).queryByText(/needs attention/)).not.toBeInTheDocument()
  expect(container.textContent).not.toMatch(/987|876|765|\$/)
  expect(container.querySelector("form")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Remove Coffee" }))
  expect(props.onRemoveLines).toHaveBeenLastCalledWith(["configured"])
  fireEvent.click(screen.getByRole("button", { name: "Remove affected items" }))
  expect(props.onRemoveLines).toHaveBeenLastCalledWith(["configured"])
  fireEvent.click(screen.getByRole("button", { name: "Clear cart" }))
  expect(props.onRemoveLines).toHaveBeenLastCalledWith(["configured", "plain"])
  fireEvent.click(screen.getByRole("button", { name: "Retry prices" }))
  expect(props.retryPricing).toHaveBeenCalledTimes(1)
})

it("keeps removal available while retrying but disables duplicate retry", () => {
  render(<CartPricingRecovery {...props} pricingError={undefined}
    pricingAffectedLineIds={[]} pricingUnavailableItemIds={[]} />)
  expect(screen.getByRole("status")).toHaveTextContent("Checking current prices")
  expect(screen.getByRole("button", { name: "Retry prices" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Remove Coffee" })).toBeEnabled()
  expect(screen.queryByText(/Option unavailable/)).not.toBeInTheDocument()
})

it("offers a price-free way to reopen a closed recovery sheet", () => {
  const onOpenChange = jest.fn()
  const { rerender } = render(<CartPricingRecovery {...props} open={false} onOpenChange={onOpenChange} />)
  fireEvent.click(screen.getByRole("button", { name: "Review cart" }))
  expect(onOpenChange).toHaveBeenCalledWith(true)
  rerender(<CartPricingRecovery {...props} open onOpenChange={onOpenChange} />)
  expect(screen.getByRole("dialog")).toBeInTheDocument()
  expect(screen.getByText("Coffee")).toBeInTheDocument()
})