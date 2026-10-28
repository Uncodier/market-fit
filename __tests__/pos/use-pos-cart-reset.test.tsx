import { act, renderHook, waitFor } from "@testing-library/react";
import { usePosCart } from "@/app/pos/hooks/use-pos-cart";
import { clearCartSession, loadCartSession, saveCartSession } from "@/app/pos/local/cart-session";
import type { CatalogItem } from "@/app/types";

jest.mock("@/app/context/DisplayCurrencyContext", () => ({ useDisplayCurrency: () => ({ rates: {} }) }));
jest.mock("@/app/pos/operation-client", () => ({ fetchPosOrder: jest.fn() }));
jest.mock("@/app/pos/local/cart-session", () => ({
  loadCartSession: jest.fn(), saveCartSession: jest.fn(), clearCartSession: jest.fn(),
}));
const setPromoCode = jest.fn();
const resetPromo = jest.fn();
jest.mock("@/app/pos/hooks/use-pos-promo", () => ({ usePosPromo: () => ({
  promoCode: "", setPromoCode, promoDiscount: 0, resetPromo,
  hydrateRecordedOrderPromo: hydratePromo, hydratePromoCode: setPromoCode,
}) }));
const hydratePromo = jest.fn();
jest.mock("sonner", () => ({ toast: { error: jest.fn(), warning: jest.fn() } }));
const item = { id: "sku", site_id: "site", name: "Product", status: "active", kind: "product",
  availability_mode: "always", target_sale_price: 10, currency: "USD" } as CatalogItem;
const args = { siteId: "site", siteCurrency: "USD", catalogItems: [item], locations: [],
  priceLists: [], priceListItems: [], preloadedTaxesByItem: {}, getTaxesForCart: jest.fn(), t: (key: string) => key };

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(loadCartSession).mockResolvedValue({ cart: [], activeOrderId: "new", leadValue: null } as never);
  jest.mocked(saveCartSession).mockResolvedValue({} as never);
});

it("keeps the visible cart and blocks collection until durable reset succeeds", async () => {
  let finish!: () => void;
  jest.mocked(clearCartSession).mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({} as never); }));
  const { result } = renderHook(() => usePosCart(args));
  await waitFor(() => expect(result.current.sessionReady).toBe(true));
  act(() => result.current.addItemToCart(item));
  let reset!: Promise<void>;
  act(() => { reset = result.current.resetToNewOrder(); });
  expect(result.current.cart).toHaveLength(1);
  expect(result.current.loadingOrder).toBe(true);
  await act(async () => { finish(); await reset; });
  expect(result.current.cart).toEqual([]);
  expect(result.current.loadingOrder).toBe(false);
});

it("retains the cart and propagates failed persistence without clearing promo state", async () => {
  jest.mocked(clearCartSession).mockRejectedValueOnce(new Error("Storage unavailable"));
  const { result } = renderHook(() => usePosCart(args));
  await waitFor(() => expect(result.current.sessionReady).toBe(true));
  act(() => result.current.addItemToCart(item));
  await act(async () => { await expect(result.current.resetToNewOrder()).rejects.toThrow("Storage unavailable"); });
  expect(result.current.cart).toHaveLength(1);
  expect(result.current.loadingOrder).toBe(false);
  expect(resetPromo).not.toHaveBeenCalled();
});

it("does not clear a newer cart edit when an older durable reset completes", async () => {
  let finish!: () => void;
  jest.mocked(clearCartSession).mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({} as never); }));
  const { result } = renderHook(() => usePosCart(args));
  await waitFor(() => expect(result.current.sessionReady).toBe(true));
  act(() => result.current.addItemToCart(item));
  let reset!: Promise<void>;
  act(() => { reset = result.current.resetToNewOrder(); });
  act(() => result.current.setCart((cart) => [...cart, { ...cart[0], id: "new-item" }]));
  expect(jest.mocked(clearCartSession).mock.calls[0][1]!()).toBe(false);
  await act(async () => { finish(); await expect(reset).rejects.toThrow("active cart changed"); });
  expect(result.current.cart).toHaveLength(2);
});

it("does not clear a newly selected site when the old reset completes", async () => {
  let finish!: () => void;
  jest.mocked(clearCartSession).mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({} as never); }));
  const { result, rerender } = renderHook(usePosCart, { initialProps: args });
  await waitFor(() => expect(result.current.sessionReady).toBe(true));
  let reset!: Promise<void>;
  act(() => { reset = result.current.resetToNewOrder(); });
  rerender({ ...args, siteId: "other" });
  await waitFor(() => expect(result.current.sessionReady).toBe(true));
  act(() => result.current.addItemToCart(item));
  await act(async () => { finish(); await expect(reset).rejects.toThrow("active cart changed"); });
  expect(result.current.cart).toHaveLength(1);
});