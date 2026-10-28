import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CartPanel } from "@/app/pos/components/CartPanel";
import { usePosPromo } from "@/app/pos/hooks/use-pos-promo";
import type { LocalPromotion } from "@/app/pos/local/types";

jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({ formatPrice: (amount: number) => `$${amount}` }),
}));
jest.mock("@/app/pos/components/PosOrderSelect", () => ({ PosOrderSelect: () => null }));
jest.mock("@/app/pos/components/PosCustomerSelect", () => ({ PosCustomerSelect: () => null }));
jest.mock("@/app/pos/components/PosCartLines", () => ({ PosCartLines: () => null }));
jest.mock("@/app/pos/components/PosReceiptActions", () => ({ PosReceiptActions: () => null }));
jest.mock("@/app/pos/components/NumpadPanel", () => ({ NumpadPanel: () => null }));
jest.mock("@/app/pos/register/CashRegisterOptions", () => ({ CashRegisterOptions: () => null }));
jest.mock("@/app/pos/components/PosAppliedPromoCard", () => ({
  PosAppliedPromoCard: ({ promo, onClear }: { promo: { code: string | null }; onClear: () => void }) =>
    <button onClick={onClear}>Clear {promo.code}</button>,
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

type Props = Parameters<typeof CartPanel>[0];
const cart = [{ id: "coffee", name: "Coffee", currency: "USD", cartQty: 1, cartPrice: 100 }] as Props["cart"];
const promotions: LocalPromotion[] = [{ id: "promo", site_id: "site", name: "Twenty off", code: "SAVE20",
  status: "active", discount_type: "percent", discount_value: 20, applies_to: "all", channels: ["pos"] }];
const noop = jest.fn();
function Panel() {
  const promo = usePosPromo({ cart, promotions, originLocationId: "store", t: (key) => key });
  return <CartPanel cart={cart} subtotal={100} taxTotal={0} shippingTotal={0} total={100 - promo.promoDiscount}
    {...promo} activeOrderId="new" pendingOrders={[]} updateQty={noop} setItemQty={noop}
    setItemPrice={noop} setItemDiscount={noop} selectedCartItemId={null} setSelectedCartItemId={noop}
    leadValue={null} setLeadValue={noop} fulfillment="pickup" setFulfillment={noop}
    originLocationId="store" setOriginLocationId={noop} priceListId="none" handlePriceListChange={noop}
    priceLists={[]} handleCheckout={noop} checkoutLoading={false} leads={[]} locations={[]}
    handleOrderSelect={noop} t={(key) => key} />;
}

it("retains the first replacement edit and clears only the applied discount", async () => {
  render(<Panel />);
  const options = screen.getByRole("tab", { name: "Options" });
  fireEvent.mouseDown(options, { button: 0 });
  fireEvent.click(options);
  const input = await screen.findByPlaceholderText("pos.cart.promoCode");
  fireEvent.change(input, { target: { value: "SAVE20" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(await screen.findByRole("button", { name: "Clear SAVE20" })).toBeInTheDocument();
  fireEvent.change(input, { target: { value: "SAVE2" } });
  expect(input).toHaveValue("SAVE2");
  expect(screen.queryByRole("button", { name: "Clear SAVE20" })).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: "SAVE20" } });
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.click(await screen.findByRole("button", { name: "Clear SAVE20" }));
  await waitFor(() => expect(input).toHaveValue(""));
});