import { fireEvent, render, screen } from "@testing-library/react";
import { CartPanel } from "@/app/pos/components/CartPanel";

jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({ formatPrice: (amount: number) => `$${amount}` }),
}));
jest.mock("@/app/pos/components/PosOrderSelect", () => ({ PosOrderSelect: () => <div>Order selector</div> }));
jest.mock("@/app/pos/components/PosCustomerSelect", () => ({ PosCustomerSelect: () => null }));
jest.mock("@/app/pos/components/PosCartLines", () => ({ PosCartLines: () => <div>Loaded order items</div> }));
jest.mock("@/app/pos/components/PosOrderNotesField", () => ({ PosOrderNotesField: () => null }));
jest.mock("@/app/pos/components/PosReceiptActions", () => ({ PosReceiptActions: () => null }));
jest.mock("@/app/pos/components/NumpadPanel", () => ({ NumpadPanel: () => null }));
jest.mock("@/app/pos/register/CashRegisterOptions", () => ({ CashRegisterOptions: () => null }));

type Props = Parameters<typeof CartPanel>[0];
const props: Props = {
  cart: [], subtotal: 0, taxTotal: 0, shippingTotal: 0, total: 0,
  activeOrderId: "order", pendingOrders: [],
  updateQty: jest.fn(), setItemQty: jest.fn(), setItemPrice: jest.fn(), setItemDiscount: jest.fn(),
  selectedCartItemId: null, setSelectedCartItemId: jest.fn(), leadValue: null, setLeadValue: jest.fn(),
  fulfillment: "pickup", setFulfillment: jest.fn(), originLocationId: "store", setOriginLocationId: jest.fn(),
  priceListId: "none", handlePriceListChange: jest.fn(), priceLists: [], promoCode: "",
  setPromoCode: jest.fn(), appliedPromo: null, promoDiscount: 0, validatePromotion: jest.fn(),
  clearAppliedPromo: jest.fn(), handleCheckout: jest.fn(), checkoutLoading: false,
  leads: [], locations: [], handleOrderSelect: jest.fn(), t: (key) => key,
};

describe("POS order loading states", () => {
  it("shows a panel skeleton rather than empty data or controls during initial hydration", () => {
    const { rerender } = render(<CartPanel {...props} dataLoading />);
    expect(screen.getByRole("status", { name: "Loading order data" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("pos.cart.empty.title")).not.toBeInTheDocument();
    expect(screen.queryByText("Order selector")).not.toBeInTheDocument();
    expect(screen.queryByText("$0")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Charge/ })).not.toBeInTheDocument();

    rerender(<CartPanel {...props} activeOrderId="new" />);
    expect(screen.queryByRole("status", { name: "Loading order data" })).not.toBeInTheDocument();
    expect(screen.getByText("pos.cart.empty.title")).toBeInTheDocument();
    expect(screen.getByText("Order selector")).toBeInTheDocument();
  });

  it("keeps the mobile cart closable while loading", () => {
    const closeCart = jest.fn();
    render(<CartPanel {...props} dataLoading isMobile closeCart={closeCart} />);
    fireEvent.click(screen.getByRole("button", { name: "Close cart" }));
    expect(closeCart).toHaveBeenCalledTimes(1);
  });

  it("skeletonizes items and totals during order selection, then displays the loaded data", () => {
    const { rerender } = render(<CartPanel {...props} orderPreparing />);
    expect(screen.getByRole("status", { name: "Loading order items" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading order totals" })).toBeInTheDocument();
    expect(screen.queryByText("pos.cart.empty.title")).not.toBeInTheDocument();
    expect(screen.queryByText("$0")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Charge" })).toBeEnabled();

    rerender(<CartPanel {...props} cart={[{ id: "item", name: "Coffee", cartQty: 1, cartPrice: 10 } as Props["cart"][number]]} subtotal={10} total={10} />);
    expect(screen.queryByRole("status", { name: "Loading order items" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading order totals" })).not.toBeInTheDocument();
    expect(screen.getByText("Loaded order items")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "pos.cart.charge $10" })).toBeEnabled();
  });
});