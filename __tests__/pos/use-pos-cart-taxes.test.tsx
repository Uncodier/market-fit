import { act, renderHook, waitFor } from "@testing-library/react";
import type { CatalogItem } from "@/app/types";
import { usePosCart } from "@/app/pos/hooks/use-pos-cart";
import { loadCartSession, saveCartSession } from "@/app/pos/local/cart-session";

jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({ rates: {} }),
}));
jest.mock("@/app/pos/operation-client", () => ({ fetchPosOrder: jest.fn() }));
jest.mock("@/app/pos/local/cart-session", () => ({
  loadCartSession: jest.fn(), saveCartSession: jest.fn(), clearCartSession: jest.fn(),
}));
jest.mock("@/app/pos/hooks/use-pos-promo", () => ({
  usePosPromo: () => ({
    promoCode: "", setPromoCode: mockSetPromoCode, promoDiscount: 0,
    resetPromo: jest.fn(),
    hydrateRecordedOrderPromo: mockHydratePromo, hydratePromoCode: mockSetPromoCode,
  }),
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), warning: jest.fn() } }));

const mockSetPromoCode = jest.fn();
const mockHydratePromo = jest.fn();
const item = {
  id: "sku", site_id: "site", name: "Product", status: "active", kind: "product",
  availability_mode: "always", target_sale_price: 10, currency: "USD",
} as CatalogItem;
const getTaxesForCart = jest.fn();
const args = {
  siteId: "site", siteCurrency: "USD", catalogItems: [item, { ...item, id: "extra" }], locations: [],
  priceLists: [], priceListItems: [], getTaxesForCart, t: (key: string) => key,
  preloadedTaxesByItem: { sku: [{ rate: 10 }], extra: [{ rate: 20 }] },
};

describe("preloaded POS cart taxes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(loadCartSession).mockResolvedValue({ cart: [], leadValue: null } as never);
    jest.mocked(saveCartSession).mockResolvedValue({} as never);
  });

  it("renders item, extras, quantities and tax-inclusive totals together without IndexedDB reads", async () => {
    const { result } = renderHook(() => usePosCart(args));
    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    act(() => result.current.addItemToCart(item, {
      modifiers: [{ groupId: "extras", catalogItemId: "extra", name: "Extra", cartPrice: 2, cartQty: 1 }],
    }));
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.subtotal).toBe(12);
    expect(result.current.taxTotal).toBe(1.4);
    expect(result.current.total).toBe(13.4);
    act(() => result.current.updateQty(result.current.cart[0].lineKey!, 1));
    expect(result.current.subtotal).toBe(24);
    expect(result.current.taxTotal).toBe(2.8);
    expect(result.current.total).toBe(26.8);
    expect(getTaxesForCart).not.toHaveBeenCalled();
  });

  it("recalculates totals immediately when synchronized tax rates change", async () => {
    const { result, rerender } = renderHook(usePosCart, { initialProps: args });
    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    act(() => result.current.addItemToCart(item));
    expect(result.current.total).toBe(11);
    rerender({ ...args, preloadedTaxesByItem: { sku: [{ rate: 20 }], extra: [] } });
    expect(result.current.total).toBe(12);
    expect(getTaxesForCart).not.toHaveBeenCalled();
  });

  it("treats a complete empty tax snapshot as authoritative", async () => {
    const { result } = renderHook(() => usePosCart({ ...args, preloadedTaxesByItem: {} }));
    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    act(() => result.current.addItemToCart(item));
    expect(result.current.total).toBe(10);
    expect(getTaxesForCart).not.toHaveBeenCalled();
  });

  it("uses site currency for new host and extra prices when catalog currencies are omitted", async () => {
    const host = { ...item, currency: undefined };
    const extra = { ...host, id: "extra" };
    const { result } = renderHook(() => usePosCart({ ...args, siteCurrency: "EUR",
      catalogItems: [host, extra], customers: [{ id: "buyer", default_price_list_id: "vip" }],
      priceLists: [{ id: "vip", site_id: "site", name: "VIP", currency: "EUR", is_active: true, channels: ["pos"] }],
      priceListItems: [{ id: "p1", price_list_id: "vip", catalog_item_id: "sku", unit_price: 7 },
        { id: "p2", price_list_id: "vip", catalog_item_id: "extra", unit_price: 2 }],
      preloadedTaxesByItem: {},
    }));
    await waitFor(() => expect(result.current.sessionReady).toBe(true));
    act(() => result.current.setLeadValue("buyer"));
    act(() => result.current.addItemToCart(host, {
      modifiers: [{ groupId: "extras", catalogItemId: "extra", name: "Extra", cartPrice: 10, cartQty: 1 }],
    }));
    expect(result.current.cart[0].cartPrice).toBe(7);
    expect(result.current.cart[0].modifiers?.[0]).toMatchObject({ cartPrice: 2, currency: "EUR" });
    expect(result.current.cartCurrency).toBe("EUR");
    expect(result.current.subtotal).toBe(9);
    expect(getTaxesForCart).not.toHaveBeenCalled();
  });
});