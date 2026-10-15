import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { toast } from "sonner";
import type { CatalogItem } from "@/app/types";
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types";
import type { PosCartItem } from "@/app/pos/cart-types";
import { usePosAddItem } from "@/app/pos/hooks/use-pos-add-item";
import { usePosInventoryCart } from "@/app/pos/hooks/use-pos-inventory-cart";
import { createClient } from "@/lib/supabase/client";
import { getPosDb } from "@/app/pos/local/db";
import { getModifierGroupsForCatalogItem } from "@/app/catalog/modifier-actions";

jest.mock("sonner", () => ({ toast: { error: jest.fn(), warning: jest.fn() } }));
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/catalog/modifier-actions", () => ({ getModifierGroupsForCatalogItem: jest.fn() }));
jest.mock("@/app/commerce/resolve-relation", () => ({ resolveRelationId: jest.fn() }));
jest.mock("@/app/quotations/dynamic-quote-actions", () => ({ requestDynamicQuote: jest.fn() }));

const item = {
  id: "sku", site_id: "site", name: "Product", kind: "product", status: "active",
  availability_mode: "always", target_sale_price: 10, currency: "USD",
} as CatalogItem;
const group: ModifierGroupWithItems = {
  id: "extras", site_id: "site", name: "Extras", min_select: 1, max_select: 1, sort_order: 0,
  items: [{ id: "extra", catalog_item_id: "extra-sku", name: "Extra", price: 2, sort_order: 0 }],
};
const addItemToCart = jest.fn();
const args = {
  siteId: "site", userId: "user", leadValue: null, leadRelationValue: null,
  addItemToCart, router: { push: jest.fn() }, t: (key: string) => key,
  catalogItems: [item], modifierGroupsByHostId: {} as Record<string, ModifierGroupWithItems[]>,
};

describe("instant POS additions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it.each([true, false])("adds a simple SKU before any promise settles (online=%s)", (online) => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: online });
    const { result } = renderHook(() => usePosAddItem(args));
    act(() => {
      void result.current.addToCart(item);
      expect(addItemToCart).toHaveBeenCalledWith(item);
    });
    expect(createClient).not.toHaveBeenCalled();
    expect(getPosDb).not.toHaveBeenCalled();
    expect(getModifierGroupsForCatalogItem).not.toHaveBeenCalled();
  });

  it("opens legacy parent options using hidden snapshot children without a count query", () => {
    const child = { ...item, id: "child", parent_id: item.id, is_pos_available: false };
    const { result } = renderHook(() => usePosAddItem({ ...args, catalogItems: [item, child] }));
    act(() => { void result.current.addToCart(item); });
    expect(result.current.optionsParentItem).toEqual(item);
    expect(addItemToCart).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("does not treat inactive or non-purchasable children as variants", () => {
    const children = [
      { ...item, id: "inactive", parent_id: item.id, status: "inactive" },
      { ...item, id: "not-purchasable", parent_id: item.id, is_purchasable: false },
    ] as CatalogItem[];
    const { result } = renderHook(() => usePosAddItem({ ...args, catalogItems: [item, ...children] }));
    act(() => { void result.current.addToCart(item); });
    expect(addItemToCart).toHaveBeenCalledWith(item);
  });

  it("opens required extras immediately and inherits parent extras for variant SKUs", () => {
    const child = { ...item, id: "child", parent_id: "parent" };
    const { result } = renderHook(() => usePosAddItem({
      ...args, modifierGroupsByHostId: { parent: [group] },
    }));
    act(() => { void result.current.addToCart(child); });
    expect(result.current.optionsParentItem).toEqual(child);
    expect(addItemToCart).not.toHaveBeenCalled();
    expect(getModifierGroupsForCatalogItem).not.toHaveBeenCalled();
  });

  it("uses the latest snapshot after groups are added or removed", () => {
    const { result, rerender } = renderHook(usePosAddItem, { initialProps: args });
    rerender({ ...args, modifierGroupsByHostId: { sku: [group] } });
    act(() => { void result.current.addToCart(item); });
    expect(result.current.optionsParentItem).toEqual(item);
    rerender(args);
    act(() => { void result.current.addToCart(item); });
    expect(addItemToCart).toHaveBeenCalledWith(item);
  });

  it.each(["reservation", "digital"])("opens the %s flow synchronously", (flow) => {
    const special = { ...item, is_reservation: flow === "reservation", kind: flow === "digital" ? "digital_asset" : "service" } as CatalogItem;
    const { result } = renderHook(() => usePosAddItem(args));
    act(() => { void result.current.addToCart(special); });
    expect(flow === "reservation" ? result.current.reservationItem : result.current.digitalItem).toEqual(special);
    expect(addItemToCart).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("retains manual availability and stock gates", () => {
    const { result } = renderHook(() => usePosAddItem(args));
    act(() => { void result.current.addToCart({ ...item, availability_mode: "manual", availability_status: "unavailable" }); });
    expect(addItemToCart).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("updates cart quantities instantly on rapid clicks without bypassing stock policy", () => {
    const sku: CatalogItem = { ...item, availability_mode: "inventory" };
    const { result } = renderHook(() => {
      const [cart, setCart] = useState<PosCartItem[]>([]);
      const [, setSelectedCartItemId] = useState<string | null>(null);
      const inventory = usePosInventoryCart({
        cart, setCart, setSelectedCartItemId, resolvePrice: () => 10,
        catalogItems: [sku], originLocationId: "location",
        inventorySnapshot: { policy: "block", levels: [{ catalog_item_id: sku.id, location_id: "location", quantity: 2 }] },
      });
      return { inventory, add: usePosAddItem({ ...args, catalogItems: [sku], addItemToCart: inventory.addItemToCart }) };
    });
    act(() => {
      void result.current.add.addToCart(sku);
      void result.current.add.addToCart(sku);
      void result.current.add.addToCart(sku);
    });
    expect(result.current.inventory.displayCart[0]).toMatchObject({ cartQty: 2, cartPrice: 10 });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(createClient).not.toHaveBeenCalled();
  });
});