import { act, renderHook, waitFor } from "@testing-library/react";
import type { CatalogItem } from "@/app/types";
import { usePosCart } from "@/app/pos/hooks/use-pos-cart";
import { fetchPosOrder } from "@/app/pos/operation-client";
import { resolvePendingOrder } from "@/app/pos/local/resolve-pending-order";
import { readLocalPendingOrders } from "@/app/pos/local/snapshot-pull";
import { isPosPermissionCurrent } from "@/app/pos/local/location-permission-state";
import { loadCartSession, saveCartSession } from "@/app/pos/local/cart-session";
import { toast } from "sonner";

jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({ rates: {} }),
}));
jest.mock("@/app/pos/operation-client", () => ({ fetchPosOrder: jest.fn() }));
jest.mock("@/app/pos/local/resolve-pending-order", () => ({ resolvePendingOrder: jest.fn() }));
jest.mock("@/app/pos/local/snapshot-pull", () => ({ readLocalPendingOrders: jest.fn() }));
jest.mock("@/app/pos/local/location-permission-state", () => ({
  requirePosPermission: (siteId: string) => {
    if (!navigator.onLine) throw new Error("POS requires verified online access");
    return { siteId, userId: "cashier", generation: 1 };
  },
  isPosPermissionCurrent: jest.fn(() => true),
}));
jest.mock("@/app/pos/local/cart-session", () => ({
  loadCartSession: jest.fn(), saveCartSession: jest.fn(), clearCartSession: jest.fn(),
}));
jest.mock("@/app/pos/hooks/use-pos-promo", () => ({
  usePosPromo: () => ({
    promoCode: "", setPromoCode: mockSetPromoCode, promoDiscount: 0, resetPromo: mockResetPromo,
    hydrateRecordedOrderPromo: mockHydratePromo,
    hydratePromoCode: mockSetPromoCode,
  }),
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), warning: jest.fn() } }));

const mockSetPromoCode = jest.fn();
const mockResetPromo = jest.fn();
const mockHydratePromo = jest.fn();
const item = { id: "sku", name: "Coffee", kind: "product", currency: "USD",
  availability_mode: "always", target_sale_price: 80 } as CatalogItem;
const args = {
  siteId: "site", catalogItems: [item], locations: [], priceLists: [], priceListItems: [],
  preloadedTaxesByItem: {}, getTaxesForCart: jest.fn(), t: (key: string) => key,
};
const order = (id: string) => ({
  id, site_id: "site", status: "pending", currency: "EUR", notes: `Notes ${id}`,
  fulfillment_method: "pickup", origin_location_id: "store", price_list_id: "list",
  buyer_user_id: "buyer", seller_user_id: "seller", seller_name: "Cashier",
  leads: { id: "customer", name: "Guest" }, total: 22,
  sales: { amount: 22, amount_due: 17, payments: [{ amount: 5 }] },
  sale_order_items: [{ id: `${id}-line`, name: "Coffee", catalog_item_id: "sku",
    unit_price: "10", quantity: 2, status: "sent", metadata: { client_line_key: `${id}-key` },
    parent_sale_order_item_id: null },
  { id: `${id}-extra`, name: "Milk", catalog_item_id: "extra", unit_price: 1,
    quantity: 2, status: "sent", metadata: { modifier_group_id: "extras" },
    parent_sale_order_item_id: `${id}-line` }],
});
type Order = ReturnType<typeof order>;
function deferred() {
  let resolve!: (response: { data?: Order; error?: string }) => void;
  const promise = new Promise<{ data?: Order; error?: string }>((done) => { resolve = done; });
  return { promise, resolve };
}
async function ready(pendingOrders: unknown[] = []) {
  const hook = renderHook(() => usePosCart({ ...args, pendingOrders }));
  await waitFor(() => expect(hook.result.current.sessionReady).toBe(true));
  return hook;
}

describe("instant POS order selection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    jest.mocked(isPosPermissionCurrent).mockReturnValue(true);
    jest.mocked(resolvePendingOrder).mockReset().mockRejectedValue(new Error("Use Check payment status in the sync queue."));
    jest.mocked(readLocalPendingOrders).mockReset().mockResolvedValue([]);
    jest.mocked(loadCartSession).mockResolvedValue({ cart: [], leadValue: null } as never);
    jest.mocked(saveCartSession).mockResolvedValue({} as never);
  });

  it("restores cached fields, line values, extras and payment balance without a server roundtrip", async () => {
    const { result } = await ready([order("a")]);
    await act(async () => { expect(await result.current.handleOrderSelect("a")).toBe(true); });
    expect(fetchPosOrder).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ activeOrderId: "a", loadingOrder: false,
      orderNotes: "Notes a", fulfillment: "pickup", originLocationId: "store", priceListId: "list",
      buyerUserId: "buyer", sellerUserId: "seller", existingPaymentTotal: 5, total: 22,
      leadValue: { mode: "existing", id: "customer", label: "Guest" } });
    expect(result.current.cart[0]).toMatchObject({ cartPrice: 10, cartQty: 2, currency: "EUR",
      lineKey: "a-key", modifiers: [{ cartPrice: 1, cartQty: 1 }] });
  });

  it("prefills an old selector snapshot while withholding invalid checkout lines", async () => {
    const response = deferred();
    jest.mocked(fetchPosOrder).mockReturnValue(response.promise as never);
    const old = { ...order("a"), sale_order_items: [{ name: "Coffee", quantity: 2, status: "sent" }] };
    const { result } = await ready([old]);
    let request!: Promise<boolean>;
    act(() => { request = result.current.handleOrderSelect("a"); });
    expect(result.current.activeOrderId).toBe("a");
    expect(result.current.orderNotes).toBe("Notes a");
    expect(result.current.leadValue).toMatchObject({ id: "customer" });
    expect(result.current.cart).toEqual([]);
    expect(result.current.loadingOrder).toBe(true);
    expect(fetchPosOrder).toHaveBeenCalledWith("site", "a");
    await act(async () => { response.resolve({ data: order("a") }); await request; });
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.loadingOrder).toBe(false);
  });

  it("keeps the original settlement currency when a differently priced product is added", async () => {
    const { result } = await ready([order("a")]);
    await act(async () => { await result.current.handleOrderSelect("a"); });
    act(() => result.current.addItemToCart({ ...item, id: "new-product" }));
    expect(result.current.cartCurrency).toBe("EUR");
    expect(result.current.existingPaymentTotal).toBe(5);
    expect(result.current.cart.find((line) => line.id === "sku")?.saleOrderItemId).toBe("a-line");
    await act(async () => { await result.current.handleOrderSelect("new"); });
    act(() => result.current.addItemToCart(item));
    expect(result.current.cartCurrency).toBe("USD");
  });

  it("clears the previous cart immediately and ignores an older order response", async () => {
    const response = deferred();
    jest.mocked(fetchPosOrder).mockReturnValue(response.promise as never);
    const { result } = await ready([order("b")]);
    act(() => result.current.addItemToCart(item));
    let request!: Promise<boolean>;
    act(() => { request = result.current.handleOrderSelect("a"); });
    expect(result.current.cart).toEqual([]);
    await act(async () => { await result.current.handleOrderSelect("b"); });
    await act(async () => { response.resolve({ data: order("a") }); expect(await request).toBe(false); });
    expect(result.current.activeOrderId).toBe("b");
    expect(result.current.orderNotes).toBe("Notes b");
    expect(result.current.cart[0].lineKey).toBe("b-key");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("does not undo New Order when an earlier load fails", async () => {
    const response = deferred();
    jest.mocked(fetchPosOrder).mockReturnValue(response.promise as never);
    const { result } = await ready();
    let request!: Promise<boolean>;
    act(() => { request = result.current.handleOrderSelect("a"); });
    await act(async () => { await result.current.handleOrderSelect("new"); });
    await act(async () => { response.resolve({ error: "Unavailable" }); await request; });
    expect(result.current.activeOrderId).toBe("new");
    expect(result.current.loadingOrder).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("keeps the new request loading when an older response arrives first", async () => {
    const first = deferred();
    const second = deferred();
    jest.mocked(fetchPosOrder).mockReturnValueOnce(first.promise as never)
      .mockReturnValueOnce(second.promise as never);
    const { result } = await ready();
    let requestA!: Promise<boolean>;
    let requestB!: Promise<boolean>;
    act(() => { requestA = result.current.handleOrderSelect("a"); });
    act(() => { requestB = result.current.handleOrderSelect("b"); });
    await act(async () => { first.resolve({ data: order("a") }); await requestA; });
    expect(result.current.activeOrderId).toBe("b");
    expect(result.current.loadingOrder).toBe(true);
    expect(result.current.cart).toEqual([]);
    await act(async () => { second.resolve({ data: order("b") }); await requestB; });
    expect(result.current.loadingOrder).toBe(false);
    expect(result.current.cart[0].lineKey).toBe("b-key");
  });

  it("ignores an in-flight result after switching sites", async () => {
    const response = deferred();
    jest.mocked(fetchPosOrder).mockReturnValue(response.promise as never);
    const { result, rerender } = renderHook(usePosCart, { initialProps: args });
    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    let request!: Promise<boolean>;
    act(() => { request = result.current.handleOrderSelect("a"); });
    rerender({ ...args, siteId: "other-site" });
    await act(async () => { response.resolve({ data: order("a") }); await request; });
    expect(result.current.cart).toEqual([]);
    expect(result.current.activeOrderId).toBe("new");
    expect(result.current.loadingOrder).toBe(false);
  });

  it("does not reuse a snapshot belonging to another site", async () => {
    jest.mocked(fetchPosOrder).mockResolvedValue({ error: "Forbidden" });
    const { result } = await ready([{ ...order("a"), site_id: "foreign" }]);
    await act(async () => { expect(await result.current.handleOrderSelect("a")).toBe(false); });
    expect(fetchPosOrder).toHaveBeenCalledWith("site", "a");
    expect(result.current.cart).toEqual([]);
    expect(result.current.activeOrderId).toBe("new");
  });

  it("does not let delayed session restoration overwrite a selected order", async () => {
    let restore!: (session: never) => void;
    jest.mocked(loadCartSession).mockReturnValue(new Promise((done) => { restore = done; }));
    const { result } = renderHook(() => usePosCart({ ...args, pendingOrders: [order("a")] }));
    await act(async () => { await result.current.handleOrderSelect("a"); });
    await act(async () => { restore({ cart: [], activeOrderId: "new" } as never); });
    expect(result.current.activeOrderId).toBe("a");
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.sessionReady).toBe(true);
  });

  it("restores a legacy saved order ID with an empty cart", async () => {
    jest.mocked(loadCartSession).mockResolvedValue({ cart: [], activeOrderId: "a" } as never);
    const { result } = await ready([order("a")]);
    await waitFor(() => expect(result.current.cart[0]?.lineKey).toBe("a-key"));
    expect(result.current.loadingOrder).toBe(false);
  });

  it("reloads legacy saved prices that have no persisted currency/reference context", async () => {
    jest.mocked(loadCartSession).mockResolvedValue({ activeOrderId: "a",
      cart: [{ ...item, cartQty: 2, cartPrice: 999 }], leadValue: null,
    } as never);
    const { result } = await ready([order("a")]);
    await waitFor(() => expect(result.current.cart[0]?.saleOrderItemId).toBe("a-line"));
    expect(result.current.cart[0].cartPrice).toBe(10);
    expect(result.current.cartCurrency).toBe("EUR");
  });

  it("preserves an edited saved cart that already carries the persisted price context", async () => {
    jest.mocked(loadCartSession).mockResolvedValue({ activeOrderId: "a", orderCurrency: "EUR",
      cart: [{ ...item, currency: "EUR", saleOrderItemId: "a-line", cartQty: 2, cartPrice: 7 },
        { ...item, id: "new-item", cartQty: 1, cartPrice: 3 }], leadValue: null,
    } as never);
    const { result } = await ready([order("a")]);
    expect(result.current.cart[0].cartPrice).toBe(7);
    expect(result.current.cart).toHaveLength(2);
    expect(result.current.cartCurrency).toBe("EUR");
    expect(fetchPosOrder).not.toHaveBeenCalled();
  });

  it("does not write the previous site's cart while the new site is restoring", async () => {
    const { result, rerender } = renderHook(usePosCart, {
      initialProps: { ...args, pendingOrders: [order("a")] },
    });
    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    await act(async () => { await result.current.handleOrderSelect("a"); });
    jest.mocked(saveCartSession).mockClear();
    jest.mocked(loadCartSession).mockReturnValue(new Promise(() => {}));
    rerender({ ...args, siteId: "other-site", pendingOrders: [] });
    expect(result.current.sessionReady).toBe(false);
    expect(result.current.cart).toEqual([]);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 220)); });
    expect(saveCartSession).not.toHaveBeenCalled();
  });

  it("falls back to the server for malformed cached lines instead of throwing", async () => {
    jest.mocked(fetchPosOrder).mockResolvedValue({ data: order("a") } as never);
    const { result } = await ready([{ ...order("a"), sale_order_items: [null] }]);
    await act(async () => { expect(await result.current.handleOrderSelect("a")).toBe(true); });
    expect(fetchPosOrder).toHaveBeenCalled();
    expect(result.current.cart).toHaveLength(1);
  });

  it("does not put cancelled products or modifiers back into the cart", async () => {
    const cached = order("a");
    cached.sale_order_items[1].status = "cancelled";
    cached.sale_order_items.push({ ...cached.sale_order_items[0], id: "removed", status: "cancelled" });
    const { result } = await ready([cached]);
    await act(async () => { await result.current.handleOrderSelect("a"); });
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].modifiers).toEqual([]);
    expect(result.current.total).toBe(20);
  });

  it("does not silently repopulate an order the cashier intentionally emptied", async () => {
    const { result } = await ready([order("a")]);
    await act(async () => { await result.current.handleOrderSelect("a"); });
    await act(async () => { result.current.setCart([]); });
    expect(result.current.cart).toEqual([]);
    expect(fetchPosOrder).not.toHaveBeenCalled();
  });

  it("never loads stale server data for an order with pending local changes", async () => {
    const { result } = await ready([{ ...order("a"), pending_sync: true }]);
    await act(async () => { expect(await result.current.handleOrderSelect("a")).toBe(false); });
    expect(fetchPosOrder).not.toHaveBeenCalled();
    expect(result.current.cart).toEqual([]);
  });

  it("hydrates a cart-less old local stub only after resolution and uses its actual server ID", async () => {
    let finish!: (id: string) => void;
    jest.mocked(resolvePendingOrder).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const response = deferred();
    jest.mocked(fetchPosOrder).mockReturnValue(response.promise as never);
    const { result } = await ready([{ id: "local_original", pending_sync: true }]);
    let request!: Promise<boolean>;
    act(() => { request = result.current.handleOrderSelect("local_original"); });
    await waitFor(() => expect(resolvePendingOrder).toHaveBeenCalledWith("site", "local_original", expect.any(Function)));
    expect(result.current.cart).toEqual([]);
    expect(result.current.loadingOrder).toBe(true);
    expect(fetchPosOrder).not.toHaveBeenCalled();
    await act(async () => { finish("server"); });
    expect(fetchPosOrder).toHaveBeenCalledWith("site", "server");
    expect(result.current.cart).toEqual([]);
    await act(async () => { response.resolve({ data: order("server") }); expect(await request).toBe(true); });
    expect(result.current).toMatchObject({ activeOrderId: "server", loadingOrder: false, orderNotes: "Notes server" });
    expect(result.current.cart[0]).toMatchObject({ saleOrderItemId: "server-line", lineKey: "server-key" });
  });

  it.each(["local_original", "server"])("does not let forceRefresh bypass pending uncertainty for %s", async (id) => {
    const { result } = await ready([{ ...order(id), pending_sync: true }]);
    await act(async () => { expect(await result.current.handleOrderSelect(id, true)).toBe(false); });
    expect(resolvePendingOrder).toHaveBeenCalledWith("site", id, expect.any(Function));
    expect(fetchPosOrder).not.toHaveBeenCalled();
    expect(result.current.cart).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Check payment status"));
  });

  it("also resolves a local ID without a pending flag instead of trusting a complete cache", async () => {
    jest.mocked(resolvePendingOrder).mockResolvedValue("server");
    jest.mocked(fetchPosOrder).mockResolvedValue({ data: order("server") } as never);
    const { result } = await ready([order("local_original")]);
    await act(async () => { expect(await result.current.handleOrderSelect("local_original", true)).toBe(true); });
    expect(result.current.activeOrderId).toBe("server");
    expect(resolvePendingOrder).toHaveBeenCalled();
    expect(fetchPosOrder).toHaveBeenCalledWith("site", "server");
  });

  it("resolves an already-server-ID pending stub before fetching a current snapshot", async () => {
    jest.mocked(resolvePendingOrder).mockResolvedValue("server");
    jest.mocked(fetchPosOrder).mockResolvedValue({ data: order("server") } as never);
    const { result } = await ready([{ id: "server", pending_sync: true }]);
    await act(async () => { expect(await result.current.handleOrderSelect("server")).toBe(true); });
    expect(resolvePendingOrder).toHaveBeenCalledWith("site", "server", expect.any(Function));
    expect(result.current.cart[0].lineKey).toBe("server-key");
  });

  it("does not fetch or replace a newer selection after a targeted push finishes late", async () => {
    let finish!: (id: string) => void;
    jest.mocked(resolvePendingOrder).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result } = await ready([order("b")]);
    let request!: Promise<boolean>;
    act(() => { request = result.current.handleOrderSelect("local_original"); });
    await waitFor(() => expect(resolvePendingOrder).toHaveBeenCalled());
    await act(async () => { await result.current.handleOrderSelect("b"); });
    expect(jest.mocked(resolvePendingOrder).mock.calls[0][2]?.()).toBe(false);
    await act(async () => { finish("server"); expect(await request).toBe(false); });
    expect(fetchPosOrder).not.toHaveBeenCalled();
    expect(result.current.activeOrderId).toBe("b");
    expect(result.current.cart[0].lineKey).toBe("b-key");
  });

  it("drops pending-order hydration after a site switch", async () => {
    jest.mocked(resolvePendingOrder).mockResolvedValue("server");
    const response = deferred();
    jest.mocked(fetchPosOrder).mockReturnValue(response.promise as never);
    const { result, rerender } = renderHook(usePosCart, { initialProps: args });
    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    let request!: Promise<boolean>;
    act(() => { request = result.current.handleOrderSelect("local_original"); });
    await waitFor(() => expect(fetchPosOrder).toHaveBeenCalled());
    rerender({ ...args, siteId: "other-site" });
    await act(async () => { response.resolve({ data: order("server") }); expect(await request).toBe(false); });
    expect(result.current.cart).toEqual([]);
    expect(result.current.activeOrderId).toBe("new");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it.each([{ id: "wrong" }, { site_id: "other" }])("rejects a mismatched resolved snapshot: %o", async (patch) => {
    jest.mocked(resolvePendingOrder).mockResolvedValue("server");
    jest.mocked(fetchPosOrder).mockResolvedValue({ data: { ...order("server"), ...patch } } as never);
    const { result } = await ready();
    await act(async () => { expect(await result.current.handleOrderSelect("local_original")).toBe(false); });
    expect(result.current.cart).toEqual([]);
    expect(result.current.activeOrderId).toBe("new");
  });

  it("drops the authorized snapshot when local permission changes during its fetch", async () => {
    jest.mocked(resolvePendingOrder).mockResolvedValue("server");
    const response = deferred();
    jest.mocked(fetchPosOrder).mockReturnValue(response.promise as never);
    const { result } = await ready();
    let request!: Promise<boolean>;
    act(() => { request = result.current.handleOrderSelect("local_original"); });
    await waitFor(() => expect(fetchPosOrder).toHaveBeenCalled());
    jest.mocked(isPosPermissionCurrent).mockReturnValue(false);
    await act(async () => { response.resolve({ data: order("server") }); expect(await request).toBe(false); });
    expect(result.current.cart).toEqual([]);
    expect(result.current.activeOrderId).toBe("new");
  });

  it("preserves genuine synced cache selection offline but never prepares a pending order offline", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const { result } = await ready([order("synced"), { id: "local_original", pending_sync: true }]);
    await act(async () => { expect(await result.current.handleOrderSelect("synced")).toBe(true); });
    expect(result.current.cart).toHaveLength(1);
    await act(async () => { expect(await result.current.handleOrderSelect("local_original")).toBe(false); });
    expect(result.current.cart).toEqual([]);
    expect(resolvePendingOrder).not.toHaveBeenCalled();
    expect(fetchPosOrder).not.toHaveBeenCalled();
  });

  it("reads a genuine synced IndexedDB snapshot offline and refuses a forced pending-cache refresh", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    jest.mocked(readLocalPendingOrders).mockResolvedValue([{ id: "synced", site_id: "site", raw: order("synced") }] as never);
    const { result } = await ready();
    await act(async () => { expect(await result.current.handleOrderSelect("synced")).toBe(true); });
    expect(result.current.cart).toHaveLength(1);
    jest.mocked(readLocalPendingOrders).mockResolvedValue([{ id: "pending", site_id: "site", raw: { id: "pending", pending_sync: true } }] as never);
    await act(async () => { expect(await result.current.handleOrderSelect("pending", true)).toBe(false); });
    expect(result.current.cart).toEqual([]);
    expect(fetchPosOrder).not.toHaveBeenCalled();
  });

  it("waits for catalog hydration before restoring a legacy order from the cache", async () => {
    jest.mocked(loadCartSession).mockResolvedValue({ cart: [], activeOrderId: "a" } as never);
    const { result, rerender } = renderHook(usePosCart, {
      initialProps: { ...args, catalogHydrated: false, catalogItems: [] as CatalogItem[], pendingOrders: [] as unknown[] },
    });
    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    expect(result.current.activeOrderId).toBe("a");
    expect(result.current.cart).toEqual([]);
    expect(fetchPosOrder).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 220)); });
    expect(saveCartSession).not.toHaveBeenCalled();

    rerender({ ...args, catalogHydrated: true, pendingOrders: [order("a")] });
    await waitFor(() => expect(result.current.cart[0]?.lineKey).toBe("a-key"));
    expect(fetchPosOrder).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("withholds a saved cart until its inventory data is ready without suppressing real shortages", async () => {
    const stockedItem = { ...item, availability_mode: "inventory" } as CatalogItem;
    jest.mocked(loadCartSession).mockResolvedValue({ activeOrderId: "new",
      cart: [{ ...stockedItem, cartQty: 2, cartPrice: 10 }], leadValue: null,
    } as never);
    const { result, rerender } = renderHook(usePosCart, {
      initialProps: { ...args, catalogHydrated: false, catalogItems: [] as CatalogItem[],
        inventorySnapshot: null as Parameters<typeof usePosCart>[0]["inventorySnapshot"] },
    });
    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    expect(result.current.cart).toEqual([]);

    rerender({ ...args, catalogHydrated: true, catalogItems: [stockedItem],
      inventorySnapshot: { levels: [{ catalog_item_id: "sku", location_id: "store", quantity: 3 }], policy: "block" },
    });
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].inventoryMessage).toBeUndefined();

    rerender({ ...args, catalogHydrated: true, catalogItems: [stockedItem],
      inventorySnapshot: { levels: [], policy: "block" },
    });
    expect(result.current.cart[0].inventoryMessage).toBe("This item is sold out.");
  });
});