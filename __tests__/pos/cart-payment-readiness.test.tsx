import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CartPanel } from "@/app/pos/components/CartPanel";
import { fetchRegisterDashboard } from "@/app/pos/operation-client";

jest.mock("@/app/pos/operation-client", () => ({ fetchRegisterDashboard: jest.fn(), fetchRegisterSummary: jest.fn(), openPosRegister: jest.fn(), movePosRegisterCash: jest.fn(), closePosRegister: jest.fn() }));
jest.mock("@/app/pos/register/queue-guard", () => ({ withRegisterCloseLock: jest.fn() }));

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

  it("always offers a lazy cash register in Options with an empty carryout cart", async () => {
    jest.mocked(fetchRegisterDashboard).mockResolvedValue({ data: { active: null, history: [], hasMore: false, role: "owner", userId: "cashier" } });
    const input = props();
    input.siteId = "site-1";
    input.locations = [{ id: "store", name: "Store" }];
    render(<CartPanel {...input} fulfillment="none" activeOrderId="new" />);
    const options = screen.getByRole("tab", { name: "Options" });
    fireEvent.mouseDown(options, { button: 0 });
    fireEvent.click(options);
    await waitFor(() => expect(screen.getByRole("tab", { name: "Options" })).toHaveAttribute("aria-selected", "true"));
    expect(fetchRegisterDashboard).not.toHaveBeenCalled();
    const register = screen.getByRole("button", { name: "Cash Register" });
    expect(register).toBeEnabled();
    fireEvent.click(register);
    expect(await screen.findByRole("dialog", { name: "Cash Register" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Register location")).toBeInTheDocument();
    await waitFor(() => expect(fetchRegisterDashboard).toHaveBeenCalledWith(expect.objectContaining({ siteId: "site-1", locationId: "store", page: 0 })));
  });
});