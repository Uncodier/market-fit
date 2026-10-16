import { fireEvent, render, screen } from "@testing-library/react";
import { CartPanel } from "@/app/pos/components/CartPanel";

jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({ formatPrice: (amount: number) => `$${amount}` }),
}));
jest.mock("@/app/pos/components/PosOrderSelect", () => ({ PosOrderSelect: () => null }));
jest.mock("@/app/pos/components/PosCustomerSelect", () => ({ PosCustomerSelect: () => null }));
jest.mock("@/app/pos/components/PosCartLines", () => ({ PosCartLines: () => null }));
jest.mock("@/app/pos/components/PosOrderNotesField", () => ({ PosOrderNotesField: () => null }));
jest.mock("@/app/pos/components/PosReceiptActions", () => ({ PosReceiptActions: () => null }));
jest.mock("@/app/pos/components/NumpadPanel", () => ({ NumpadPanel: () => null }));

type Props = Parameters<typeof CartPanel>[0];
function props(): Props {
  return { cart: [], subtotal: 0, taxTotal: 0, shippingTotal: 0, total: 0,
    activeOrderId: "order", pendingOrders: [], orderPreparing: true,
    updateQty: jest.fn(), setItemQty: jest.fn(), setItemPrice: jest.fn(), setItemDiscount: jest.fn(),
    selectedCartItemId: null, setSelectedCartItemId: jest.fn(), leadValue: null, setLeadValue: jest.fn(),
    fulfillment: "pickup", setFulfillment: jest.fn(), originLocationId: "store", setOriginLocationId: jest.fn(),
    priceListId: "none", handlePriceListChange: jest.fn(), priceLists: [], promoCode: "",
    setPromoCode: jest.fn(), appliedPromo: null, promoDiscount: 0, validatePromotion: jest.fn(),
    clearAppliedPromo: jest.fn(), handleCheckout: jest.fn(), checkoutLoading: false,
    leads: [], locations: [], handleOrderSelect: jest.fn(), t: (key) => key };
}

describe("POS payment button readiness", () => {
  it("opens payment by selected ID without displaying a false zero charge", () => {
    const input = props();
    render(<CartPanel {...input} />);
    const button = screen.getByRole("button", { name: "Charge" });
    expect(button).toBeEnabled();
    expect(button).not.toHaveTextContent("$0");
    fireEvent.click(button);
    expect(input.handleCheckout).toHaveBeenCalledTimes(1);
  });

  it("disables an empty new order and an in-flight payment", () => {
    const input = props();
    const { rerender } = render(<CartPanel {...input} activeOrderId="new" />);
    expect(screen.getByRole("button", { name: "Charge" })).toBeDisabled();
    rerender(<CartPanel {...input} checkoutLoading />);
    expect(screen.getByRole("button", { name: "pos.cart.processing" })).toBeDisabled();
  });
});