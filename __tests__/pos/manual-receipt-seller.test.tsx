import { act, fireEvent, render, screen } from "@testing-library/react"
import { CartPanel, type PosCartItem } from "@/app/pos/components/CartPanel"
import { loadCartSession } from "@/app/pos/local/cart-session"
import { printPosReceiptManually } from "@/app/pos/print-after-checkout"

jest.mock("@/app/context/DisplayCurrencyContext", () => ({ useDisplayCurrency: () => ({ formatPrice: String }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { name: "Store" } }) }))
jest.mock("@/app/pos/components/PosCustomerSelect", () => ({ PosCustomerSelect: () => null }))
jest.mock("@/app/pos/components/PosCustomerPickerDialog", () => ({ PosCustomerPickerDialog: () => null }))
jest.mock("@/app/pos/components/PosCartLines", () => ({ PosCartLines: () => null }))
jest.mock("@/app/pos/register/CashRegisterOptions", () => ({ CashRegisterOptions: () => null }))
jest.mock("@/app/pos/local/cart-session", () => ({ loadCartSession: jest.fn(async () => ({ sellerName: "Stale seller" })) }))
jest.mock("@/app/printer/actions", () => ({ markKitchenItemsPrinted: jest.fn() }))
jest.mock("@/app/pos/print-after-checkout", () => ({
  ...jest.requireActual("@/app/pos/print-after-checkout"),
  printPosReceiptManually: jest.fn(async () => "printer"),
}))

const props: Parameters<typeof CartPanel>[0] = {
  siteId: "site-A", cart: [{ id: "coffee", name: "Coffee", cartQty: 2, cartPrice: 5 } as PosCartItem],
  subtotal: 10, taxTotal: 1, shippingTotal: 0, total: 11, siteCurrency: "EUR", sellerName: "Restored seller",
  activeOrderId: "order-A", pendingOrders: [], updateQty: jest.fn(), setItemQty: jest.fn(),
  setItemPrice: jest.fn(), setItemDiscount: jest.fn(), selectedCartItemId: null, setSelectedCartItemId: jest.fn(),
  leadValue: null, setLeadValue: jest.fn(), fulfillment: "pickup", setFulfillment: jest.fn(), originLocationId: "store",
  setOriginLocationId: jest.fn(), priceListId: "none", handlePriceListChange: jest.fn(), priceLists: [], promoCode: "",
  setPromoCode: jest.fn(), appliedPromo: null, promoDiscount: 0, validatePromotion: jest.fn(), clearAppliedPromo: jest.fn(),
  handleCheckout: jest.fn(), checkoutLoading: false, leads: [], locations: [], handleOrderSelect: jest.fn(),
  onSplitBill: jest.fn(), t: key => key,
}

async function print() {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Print Receipt" })) })
}

it("prints the current cart's seller without re-reading the device session on mount, change or print", async () => {
  const view = render(<CartPanel {...props} />)
  expect(loadCartSession).not.toHaveBeenCalled()
  expect(printPosReceiptManually).not.toHaveBeenCalled()
  await print()
  expect(printPosReceiptManually).toHaveBeenLastCalledWith(expect.objectContaining({ receipt: expect.objectContaining({
    requestedByName: "Restored seller", subtotal: 10, total: 11, taxTotal: 1, currency: "EUR",
  }) }))

  view.rerender(<CartPanel {...props} sellerName="Selected seller" />)
  await print()
  expect(printPosReceiptManually).toHaveBeenLastCalledWith(expect.objectContaining({ receipt: expect.objectContaining({
    requestedByName: "Selected seller",
  }) }))
  view.rerender(<CartPanel {...props} siteId="site-B" activeOrderId="order-B" sellerName={null} />)
  await print()
  expect(printPosReceiptManually).toHaveBeenLastCalledWith(expect.objectContaining({ receipt: expect.objectContaining({
    requestedByName: null,
  }) }))
  view.rerender(<CartPanel {...props} cart={[]} activeOrderId="new" />)
  expect(screen.getByRole("button", { name: "Print Receipt" })).toBeDisabled()
  expect(loadCartSession).not.toHaveBeenCalled()
  expect(props.handleCheckout).not.toHaveBeenCalled()
})