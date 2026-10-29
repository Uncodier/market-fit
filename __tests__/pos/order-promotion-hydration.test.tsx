import { act, renderHook, waitFor } from "@testing-library/react";
import type { CatalogItem } from "@/app/types";
import { usePosCart } from "@/app/pos/hooks/use-pos-cart";
import { fetchPosOrder } from "@/app/pos/operation-client";
import { clearCartSession, loadCartSession, saveCartSession } from "@/app/pos/local/cart-session";
import { posOrderVersion } from "@/app/pos/order-version";
import { getPosCheckoutGate } from "@/app/pos/checkout-gates";

jest.mock("@/app/context/DisplayCurrencyContext", () => ({ useDisplayCurrency: () => ({ rates: {} }) }));
jest.mock("@/app/pos/operation-client", () => ({ fetchPosOrder: jest.fn() }));
jest.mock("@/app/pos/local/cart-session", () => ({
  loadCartSession: jest.fn(), saveCartSession: jest.fn(), clearCartSession: jest.fn(),
}));
jest.mock("@/app/pos/local/location-permission-state", () => ({
  getPosPermissionLease: () => ({ siteId: "site", userId: "cashier", generation: 1 }),
  requirePosPermission: () => ({ siteId: "site", userId: "cashier", generation: 1 }),
  isPosPermissionCurrent: () => true,
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), warning: jest.fn(), success: jest.fn() } }));

const item = { id: "coffee", site_id: "site", name: "Coffee", kind: "product",
  availability_mode: "always", currency: "USD", target_sale_price: 100 } as CatalogItem;
const order = {
  id: "online-order", site_id: "site", status: "pending", currency: "USD",
  subtotal: 100, total: 82, discount_total: 20, promotion_id: "shop-promo",
  promotions: { name: "Online coupon", code: "SAVE20", image_url: null },
  fulfillment_method: "pickup", origin_location_id: "store",
  sales: { source: "shop", status: "pending", amount: 82, amount_due: 72, payments: [{ amount: 10 }] },
  sale_order_items: [{ id: "line", catalog_item_id: "coffee", name: "Coffee", quantity: 1,
    unit_price: 100, status: "draft", metadata: { client_line_key: "line" }, parent_sale_order_item_id: null }],
};
const args = {
  siteId: "site", siteCurrency: "USD", catalogItems: [item], locations: [],
  priceLists: [], priceListItems: [], promotions: [], pendingOrders: [order],
  preloadedTaxesByItem: { coffee: [{ rate: 2 }] }, getTaxesForCart: jest.fn(), t: (key: string) => key,
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  jest.mocked(loadCartSession).mockResolvedValue({ activeOrderId: "new", cart: [], leadValue: null } as never);
  jest.mocked(saveCartSession).mockResolvedValue({} as never);
  jest.mocked(clearCartSession).mockResolvedValue({} as never);
  jest.mocked(fetchPosOrder).mockResolvedValue({ data: order } as never);
});

async function ready(options: Parameters<typeof usePosCart>[0] = args) {
  const hook = renderHook(() => usePosCart(options));
  await waitFor(() => expect(hook.result.current.sessionReady).toBe(true));
  return hook;
}

it.each([true, false])("restores the recorded online coupon from a %s cached snapshot without POS promotions", async (cached) => {
  const { result } = await ready({ ...args, pendingOrders: cached ? [order] : [] });
  await act(async () => { expect(await result.current.handleOrderSelect(order.id)).toBe(true); });
  expect(result.current.promoCode).toBe("SAVE20");
  expect(result.current.appliedPromo).toMatchObject({ promotionId: "shop-promo", discount: 20, code: "SAVE20" });
  expect(result.current.promoDiscount).toBe(20);
  expect(result.current.total).toBe(82);
  expect(result.current.existingPaymentTotal).toBe(10);
  expect(fetchPosOrder).toHaveBeenCalledTimes(cached ? 0 : 1);
});

it("restores the amount and promotion ID even when the promotion relation is unavailable", async () => {
  const { result } = await ready({ ...args, pendingOrders: [{ ...order, promotions: null } as never] });
  await act(async () => { await result.current.handleOrderSelect(order.id); });
  expect(result.current.appliedPromo).toMatchObject({ promotionId: "shop-promo", discount: 20 });
  expect(result.current.total).toBe(82);
});

it("restores a codeless online promotion without substituting a POS automatic promotion", async () => {
  const codeless = { ...order, promotions: { ...order.promotions, code: null } };
  const { result } = await ready({ ...args, pendingOrders: [codeless as never] });
  await act(async () => { await result.current.handleOrderSelect(order.id); });
  expect(result.current.appliedPromo).toMatchObject({ promotionId: "shop-promo", code: null, byConditions: true, discount: 20 });
  expect(result.current.total).toBe(82);
  expect(result.current.validateInventory()).toBe(true);
});

it("does not carry an online coupon into another order or a new basket", async () => {
  const other = { ...order, id: "other-order", promotion_id: null, discount_total: 0, promotions: null,
    sales: { ...order.sales, amount: 102, amount_due: 102, payments: [] } };
  const { result } = await ready({ ...args, pendingOrders: [order, other as never] });
  await act(async () => { await result.current.handleOrderSelect(order.id); });
  expect(result.current.promoDiscount).toBe(20);
  await act(async () => { await result.current.handleOrderSelect(other.id); });
  expect(result.current.promoDiscount).toBe(0);
  expect(result.current.promoCode).toBe("");
  expect(result.current.total).toBe(102);
  await act(async () => { await result.current.handleOrderSelect(order.id); });
  await act(async () => { await result.current.resetToNewOrder(); });
  expect(result.current.appliedPromo).toBeNull();
  expect(result.current.promoCode).toBe("");
});

it("retains the recorded discount after saving and restoring the same device session", async () => {
  const hook = await ready();
  await act(async () => { await hook.result.current.handleOrderSelect(order.id); });
  await waitFor(() => expect(saveCartSession).toHaveBeenLastCalledWith(expect.objectContaining({
    activeOrderId: order.id, promoCode: "SAVE20", recordedOrderPromo: expect.objectContaining({ discount: 20 }),
  })));
  const session = jest.mocked(saveCartSession).mock.calls.at(-1)![0];
  hook.unmount();
  jest.mocked(loadCartSession).mockResolvedValue(session as never);
  const restored = await ready();
  expect(restored.result.current.appliedPromo).toMatchObject({ promotionId: "shop-promo", discount: 20 });
  expect(restored.result.current.total).toBe(82);
});

it("requires recorded coupon changes in Orders rather than submitting a different price from the POS", async () => {
  const { result } = await ready();
  await act(async () => { await result.current.handleOrderSelect(order.id); });
  act(() => result.current.setPromoCode("OTHER"));
  expect(result.current.promoCode).toBe("SAVE20");
  expect(result.current.promoDiscount).toBe(20);
  await act(async () => { await result.current.handleOrderSelect(order.id); });
  act(() => result.current.clearAppliedPromo());
  expect(result.current.promoCode).toBe("SAVE20");
  expect(result.current.promoDiscount).toBe(20);
});

it.each(["quantity", "price", "buyer", "new-customer", "fulfillment"])("blocks payment after changing the recorded promotion's %s context", async (change) => {
  const { result } = await ready();
  await act(async () => { await result.current.handleOrderSelect(order.id); });
  expect(result.current.validateInventory()).toBe(true);
  act(() => {
    if (change === "quantity") result.current.setItemQty("line", 2);
    if (change === "price") result.current.setItemPrice("line", 50);
    if (change === "buyer") result.current.setBuyerUserId("other");
    if (change === "new-customer") result.current.setLeadValue({ mode: "create", label: "New customer" });
    if (change === "fulfillment") result.current.setFulfillment("dine_in");
  });
  expect(result.current.validateInventory()).toBe(false);
});

it("preserves legacy unsaved cart edits but requires review of its recovered discount before payment", async () => {
  jest.mocked(loadCartSession).mockResolvedValue({
    activeOrderId: order.id, orderCurrency: "USD", expectedOrderVersion: posOrderVersion(order),
    cart: [{ ...item, cartQty: 2, cartPrice: 100, saleOrderItemId: "line", lineKey: "line" }],
    leadValue: null, buyerUserId: null, fulfillment: "pickup", originLocationId: "store",
  } as never);
  const { result } = await ready();
  expect(result.current.cart[0].cartQty).toBe(2);
  expect(result.current.promoDiscount).toBe(20);
  expect(result.current.validateInventory()).toBe(false);
  await act(async () => { await result.current.handleOrderSelect(order.id, true); });
  expect(result.current.cart[0].cartQty).toBe(1);
  expect(result.current.validateInventory()).toBe(true);
});

it("retains the discount when staff undo a temporary empty-cart edit", async () => {
  const { result } = await ready();
  await act(async () => { await result.current.handleOrderSelect(order.id); });
  const original = result.current.cart;
  act(() => result.current.setCart([]));
  expect(result.current.validateInventory()).toBe(false);
  act(() => result.current.setCart(original));
  expect(result.current.promoDiscount).toBe(20);
  expect(result.current.total).toBe(82);
  expect(result.current.validateInventory()).toBe(true);
});

it.each(["none", "pickup"] as const)("permits automatic origin assignment for a %s online coupon order without a recorded location", async (fulfillment) => {
  const unbound = { ...order, fulfillment_method: fulfillment, origin_location_id: null, buyer_user_id: "buyer" };
  const digital = { ...item, kind: "digital_asset" } as CatalogItem;
  const { result } = await ready({ ...args, catalogItems: fulfillment === "none" ? [digital] : [item],
    locations: [{ id: "store", name: "Store" }], pendingOrders: [unbound] });
  await act(async () => { await result.current.handleOrderSelect(order.id); });
  expect(result.current.originLocationId).toBe("store");
  expect(result.current.validateInventory()).toBe(true);
  expect(getPosCheckoutGate(result.current)).toEqual({ ok: true });
  await act(async () => { await result.current.handleOrderSelect(order.id); });
  expect(result.current.validateInventory()).toBe(true);
});

it("allows locations to arrive after an unbound online coupon order is loaded", async () => {
  const { result, rerender } = renderHook(usePosCart, { initialProps: { ...args,
    pendingOrders: [{ ...order, origin_location_id: null }], locations: [] as { id: string }[] } });
  await waitFor(() => expect(result.current.sessionReady).toBe(true));
  await act(async () => { await result.current.handleOrderSelect(order.id); });
  rerender({ ...args, pendingOrders: [{ ...order, origin_location_id: null }], locations: [{ id: "store" }] });
  await waitFor(() => expect(result.current.originLocationId).toBe("store"));
  expect(result.current.validateInventory()).toBe(true);
});

it("compares the recorded customer ID, not the customer picker label", async () => {
  const { result } = await ready({ ...args, pendingOrders: [{ ...order, leads: { id: "lead", name: "Ada" } }] });
  await act(async () => { await result.current.handleOrderSelect(order.id); });
  act(() => result.current.setLeadValue({ mode: "existing", id: "lead", label: "Ada · ada@example.test" }));
  expect(result.current.validateInventory()).toBe(true);
  act(() => result.current.setLeadValue("lead"));
  expect(result.current.validateInventory()).toBe(true);
  act(() => result.current.setLeadValue({ mode: "existing", id: "another", label: "Ada" }));
  expect(result.current.validateInventory()).toBe(false);
});

it("still blocks a manual change away from the recorded origin", async () => {
  const { result } = await ready({ ...args, locations: [{ id: "store" }, { id: "other" }] });
  await act(async () => { await result.current.handleOrderSelect(order.id); });
  act(() => result.current.setOriginLocationId("other"));
  expect(result.current.validateInventory()).toBe(false);
});

it.each([false, true])("upgrades an older saved customer-label fingerprint without accepting existing edits: %s", async (edited) => {
  const savedOrder = { ...order, leads: { id: "lead", name: "Ada" } };
  const hook = await ready({ ...args, pendingOrders: [savedOrder] });
  await act(async () => { await hook.result.current.handleOrderSelect(order.id); });
  await waitFor(() => expect(saveCartSession).toHaveBeenLastCalledWith(expect.objectContaining({ recordedOrderPromo: expect.any(Object) })));
  const session = jest.mocked(saveCartSession).mock.calls.at(-1)![0];
  hook.unmount();
  const oldFingerprint = JSON.stringify([JSON.stringify([{ mode: "existing", id: "lead", label: "Ada" }, null, "pickup", "store"]),
    session.cart.map((line) => [line.id, line.lineKey, line.currency, line.cartQty, line.cartPrice,
      line.modifiers?.map((child) => [child.catalogItemId, child.groupId, child.cartQty, child.cartPrice])])]);
  jest.mocked(loadCartSession).mockResolvedValue({ ...session, recordedPromoFingerprint: oldFingerprint,
    leadValue: { mode: "existing", id: "lead", label: "Ada · ada@example.test" },
    cart: session.cart.map((line) => ({ ...line, cartQty: edited ? 2 : 1 })),
  } as never);
  const restored = await ready();
  expect(restored.result.current.validateInventory()).toBe(!edited);
});