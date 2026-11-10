import { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import type { CatalogItem } from "@/app/types";
import type { PosCartItem } from "@/app/pos/cart-types";
import { usePosCustomerPricing } from "@/app/pos/hooks/use-pos-customer-pricing";
import { withCustomerPricing } from "@/app/pos/customer-pricing";
import { cartWithPrice, cartWithDiscountPercent, mergeItemIntoCart } from "@/app/pos/cart-line-utils";
import { toast } from "sonner";

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));
const product = { id: "sku", currency: "USD", target_sale_price: 100 } as CatalogItem;
const modifier = { id: "extra", currency: "USD", target_sale_price: 10 } as CatalogItem;
const lists = ["personal", "other", "default"].map((id) => ({ id, site_id: "site", name: id,
  is_active: true, is_default: id === "default", channels: ["pos"], currency: "USD" }));
const items = [70, 80, 90].flatMap((price, index) => [product, modifier].map((p) => ({
  id: `${index}:${p.id}`, price_list_id: lists[index].id, catalog_item_id: p.id, unit_price: p === product ? price : price / 10,
})));
const customers = [{ id: "a", default_price_list_id: "personal" }, { id: "b", default_price_list_id: "other" }];
const initial: PosCartItem[] = [{ ...product, cartQty: 1, cartPrice: 90, priceSource: "automatic",
  modifiers: [{ catalogItemId: "extra", groupId: "g", name: "Extra", cartQty: 1, cartPrice: 9 }] }];
function useHarness(priceLists = lists) {
  const [cart, setCart] = useState(initial);
  return { cart, setCart, ...usePosCustomerPricing({ siteId: "site", cart, setCart, catalogItems: [product, modifier],
    customers, priceLists, priceListItems: items, rates: { USD: 1, EUR: 0.5 } }) };
}

it("applies, switches, and clears customer preferences entirely from local data", () => {
  const { result } = renderHook(() => useHarness());
  act(() => result.current.setLeadValue("a"));
  expect(result.current.priceListId).toBe("personal");
  expect(result.current.cart[0].cartPrice).toBe(70);
  expect(result.current.cart[0].modifiers?.[0].cartPrice).toBe(7);
  act(() => result.current.setLeadValue("b"));
  expect(result.current.cart[0].cartPrice).toBe(80);
  act(() => result.current.setLeadValue(null));
  expect(result.current.priceListId).toBe("none");
  expect(result.current.cart[0].cartPrice).toBe(90);
});

it("uses preference metadata for uncached search results and respects manual lists until customer switch", () => {
  const { result } = renderHook(() => useHarness());
  const value = withCustomerPricing({ mode: "existing", id: "uncached", label: "Remote" },
    { id: "uncached", default_price_list_id: "personal" });
  act(() => result.current.setLeadValue(value));
  expect(result.current.priceListId).toBe("personal");
  act(() => result.current.handlePriceListChange("none"));
  act(() => result.current.setLeadValue(value));
  expect(result.current.priceListId).toBe("none");
  expect(result.current.priceListSource).toBe("manual");
  act(() => result.current.setLeadValue("b"));
  expect(result.current.priceListId).toBe("other");
});

it("uses fresh preference metadata when reselecting the same customer", () => {
  const { result } = renderHook(() => useHarness());
  const select = (list: string | null) => withCustomerPricing({ mode: "existing", id: "a", label: "Customer" },
    { id: "a", default_price_list_id: list });
  act(() => result.current.setLeadValue(select("personal")));
  act(() => result.current.setLeadValue(select("other")));
  expect(result.current.priceListId).toBe("other");
  expect(result.current.cart[0].cartPrice).toBe(80);
  act(() => result.current.setLeadValue(select(null)));
  expect(result.current.priceListId).toBe("none");
});

it.each(["manual", "discount", "historical", "restored"])("preserves %s lines during automatic selection", (kind) => {
  const { result } = renderHook(() => useHarness());
  act(() => result.current.setCart((cart) => kind === "manual" ? cartWithPrice(cart, "sku", 12)
    : kind === "discount" ? cartWithDiscountPercent(cart, "sku", 10)
    : cart.map((line) => kind === "historical" ? { ...line, saleOrderItemId: "saved" }
      : { ...line, priceSource: "restored" })));
  const before = result.current.cart;
  act(() => result.current.setLeadValue("a"));
  expect(result.current.priceListId).toBe("personal");
  expect(result.current.cart).toEqual(before);
});

it("protects a manually priced modifier while repricing its automatic host", () => {
  const { result } = renderHook(() => useHarness());
  act(() => result.current.setCart((cart) => cart.map((line) => ({ ...line,
    modifiers: line.modifiers?.map((extra) => ({ ...extra, priceSource: "manual", cartPrice: 3 })),
  }))));
  act(() => result.current.setLeadValue("a"));
  expect(result.current.cart[0].cartPrice).toBe(70);
  expect(result.current.cart[0].modifiers?.[0].cartPrice).toBe(3);
});

it("restores list provenance without silently repricing an existing order", () => {
  const { result } = renderHook(() => useHarness());
  act(() => result.current.restorePricing({ leadValue: "a", priceListId: "other" }));
  expect(result.current.cart).toEqual(initial);
  act(() => result.current.setLeadValue({ mode: "existing", id: "a", label: "Name update" }));
  expect(result.current.priceListId).toBe("other");
  act(() => result.current.resetPricing());
  expect(result.current.priceListSource).toBe("automatic");
});

it("normalizes list currency before storing host/modifier prices in product currency", () => {
  const { result } = renderHook(() => useHarness(lists.map((list) => ({ ...list, currency: "EUR" }))));
  act(() => result.current.setLeadValue("a"));
  expect(result.current.cart[0].cartPrice).toBe(140);
  expect(result.current.cart[0].modifiers?.[0].cartPrice).toBe(14);
  expect(result.current.resolvePrice(product)).toBe(140);
});

it.each([null, "", "   "])("inherits the EUR site currency for host and modifiers with currency %j", currency => {
  const catalog = [product, modifier].map(item => ({ ...item, currency } as CatalogItem));
  const { result } = renderHook(() => {
    const [cart, setCart] = useState<PosCartItem[]>([{ ...initial[0], currency: currency as string }]);
    return { cart, ...usePosCustomerPricing({ siteId: "site", siteCurrency: "EUR", cart, setCart,
      catalogItems: catalog, customers, priceLists: lists.map(list => ({ ...list, currency: "EUR" })),
      priceListItems: items, rates: { EUR: 0.5 } }) };
  });
  act(() => result.current.setLeadValue("a"));
  expect(result.current.cart[0]).toMatchObject({ cartPrice: 70, currency: "EUR" });
  expect(result.current.cart[0].modifiers?.[0]).toMatchObject({ cartPrice: 7, currency: "EUR" });
  expect(result.current.resolvePrice(catalog[0])).toBe(70);
  act(() => result.current.handlePriceListChange("other"));
  expect(result.current.cart[0]).toMatchObject({ cartPrice: 80, currency: "EUR" });
  expect(result.current.cart[0].modifiers?.[0]).toMatchObject({ cartPrice: 8, currency: "EUR" });
});

it("keeps customer and prices atomic when currency conversion is unavailable", () => {
  const { result } = renderHook(() => useHarness(lists.map((list) => ({ ...list, currency: "JPY" }))));
  act(() => result.current.setLeadValue("a"));
  expect(result.current.leadValue).toBeNull();
  expect(result.current.priceListId).toBe("none");
  expect(result.current.cart).toEqual(initial);
  expect(toast.error).toHaveBeenCalled();
});

it("does not change quoted lines during a background price dataset refresh", () => {
  const { result, rerender } = renderHook(({ currency }) => useHarness(lists.map((list) => ({ ...list, currency }))),
    { initialProps: { currency: "USD" } });
  act(() => result.current.setLeadValue("a"));
  rerender({ currency: "EUR" });
  expect(result.current.cart[0].cartPrice).toBe(70);
  expect(result.current.resolvePrice(product)).toBe(140);
});

it.each(["inactive", "channel", "foreign", "deleted"])("ignores %s customer list references", (kind) => {
  const invalid = lists.filter((list) => kind !== "deleted" || list.id !== "personal").map((list) =>
    list.id !== "personal" ? list : { ...list, is_active: kind !== "inactive", site_id: kind === "foreign" ? "other" : "site",
      channels: kind === "channel" ? ["shop"] : ["pos"] });
  const { result } = renderHook(() => useHarness(invalid));
  act(() => result.current.setLeadValue("a"));
  expect(result.current.priceListId).toBe("none");
});

it("does not merge newly priced products into historical lines", () => {
  const old = { ...initial[0], modifiers: [], saleOrderItemId: "old" };
  const result = mergeItemIntoCart([old], product, undefined, () => 70);
  expect(result.next).toHaveLength(2);
  expect(result.next[1]).toEqual(old);
  expect(result.next[0].cartPrice).toBe(70);
});

it("keeps a quoted price after sync and adds a separate line at the refreshed price", () => {
  const old = { ...initial[0], modifiers: [] };
  const result = mergeItemIntoCart([old], product, undefined, () => 70);
  expect(result.next).toHaveLength(2);
  expect(result.next[1]).toEqual(old);
});

it("uses raw catalog fallback for a missing personal-list item, not another list", () => {
  const { result } = renderHook(() => useHarness());
  act(() => result.current.setLeadValue("a"));
  expect(result.current.resolvePrice({ ...product, id: "missing", target_sale_price: 11 })).toBe(11);
});