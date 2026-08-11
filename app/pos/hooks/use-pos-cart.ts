"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogItem } from "@/app/types";
import type { RelationSelectValue } from "@/app/components/ui/relation-select";
import type { PosCartItem } from "@/app/pos/components/CartPanel";
import {
  getItemDeliveryOptions,
  intersectDeliveryOptions,
  defaultFulfillment,
  type CheckoutFulfillmentMethod,
} from "@/app/commerce/delivery-options";
import { calculateOrderTaxTotal, roundMoney } from "@/app/commerce/taxes";
import { resolveOrderShippingCost } from "@/app/commerce/delivery-options";
import { resolveUnitPriceLocal } from "@/app/pos/local/resolve-unit-price-local";
import { resolvePromotionDiscountLocal } from "@/app/pos/local/resolve-promo-local";
import {
  clearCartSession,
  loadCartSession,
  saveCartSession,
} from "@/app/pos/local/cart-session";
import { getOrder } from "@/app/orders/actions";
import { toast } from "sonner";

type UsePosCartArgs = {
  siteId?: string;
  shopSettings?: any;
  catalogItems: CatalogItem[];
  locations: any[];
  priceLists: any[];
  priceListItems: any[];
  promotions?: any[];
  getTaxesForCart: (ids: string[]) => Promise<Record<string, any[]>>;
  t: (key: string) => string;
};

export function usePosCart({
  siteId,
  shopSettings,
  catalogItems,
  locations,
  priceLists,
  priceListItems,
  promotions = [],
  getTaxesForCart,
  t,
}: UsePosCartArgs) {
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [leadValue, setLeadValue] = useState<RelationSelectValue | string | null>(
    null,
  );
  const [fulfillment, setFulfillment] =
    useState<CheckoutFulfillmentMethod>("dine_in");
  const [originLocationId, setOriginLocationId] = useState("");
  const [priceListId, setPriceListId] = useState("none");
  const [promoCode, setPromoCode] = useState("");
  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(
    null,
  );
  const [activeOrderId, setActiveOrderId] = useState("new");
  const [buyerUserId, setBuyerUserId] = useState<string | null>(null);
  const [taxesByItem, setTaxesByItem] = useState<Record<string, any[]>>({});
  const [sessionReady, setSessionReady] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const restoredRef = useRef(false);
  const persistTimer = useRef<number | null>(null);

  // Hydrate cart session from Dexie
  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    restoredRef.current = false;
    (async () => {
      const session = await loadCartSession(siteId);
      if (cancelled) return;
      setCart(session.cart || []);
      setLeadValue(session.leadValue);
      setFulfillment(session.fulfillment || "dine_in");
      setOriginLocationId(session.originLocationId || "");
      setPriceListId(session.priceListId || "none");
      setPromoCode(session.promoCode || "");
      setActiveOrderId(session.activeOrderId || "new");
      setBuyerUserId(session.buyerUserId);
      setSessionReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  // Persist session (debounced)
  useEffect(() => {
    if (!siteId || !sessionReady) return;
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      void saveCartSession({
        siteId,
        cart,
        leadValue,
        fulfillment,
        originLocationId,
        priceListId,
        promoCode,
        activeOrderId,
        buyerUserId,
      });
    }, 200);
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [
    siteId,
    sessionReady,
    cart,
    leadValue,
    fulfillment,
    originLocationId,
    priceListId,
    promoCode,
    activeOrderId,
    buyerUserId,
  ]);

  useEffect(() => {
    if (locations.length > 0 && !originLocationId) {
      const def = locations.find((l: any) => l.is_default) || locations[0];
      if (def) setOriginLocationId(def.id);
    }
  }, [locations, originLocationId]);

  const allowedFulfillments = useMemo((): CheckoutFulfillmentMethod[] => {
    if (cart.length === 0) return ["dine_in"];
    const options = intersectDeliveryOptions(
      cart.map((i) => ({
        allowed: getItemDeliveryOptions(i, shopSettings?.default_delivery_options),
      })),
    );
    return options.length > 0 ? options : ["dine_in"];
  }, [cart, shopSettings]);

  useEffect(() => {
    if (
      allowedFulfillments.length > 0 &&
      !allowedFulfillments.includes(fulfillment)
    ) {
      const next = allowedFulfillments.includes("dine_in")
        ? "dine_in"
        : defaultFulfillment(allowedFulfillments) || "dine_in";
      setFulfillment(next);
    }
  }, [allowedFulfillments, fulfillment]);

  const cartTaxKey = useMemo(
    () =>
      cart
        .map((c) => c.id)
        .sort()
        .join(","),
    [cart],
  );

  useEffect(() => {
    if (!siteId || cart.length === 0) {
      setTaxesByItem({});
      return;
    }
    void getTaxesForCart(cart.map((c) => c.id)).then(setTaxesByItem);
  }, [siteId, cartTaxKey, cart, getTaxesForCart]);

  const resolvePrice = useCallback(
    (item: CatalogItem, listId?: string) => {
      const actualId =
        listId && listId !== "none"
          ? listId
          : priceListId !== "none"
            ? priceListId
            : undefined;
      return resolveUnitPriceLocal({
        catalogItemId: item.id,
        targetSalePrice: item.target_sale_price,
        priceListId: actualId,
        priceLists,
        priceListItems,
      }).price;
    },
    [priceListId, priceLists, priceListItems],
  );

  const addItemToCart = useCallback(
    (item: CatalogItem, extras?: Partial<PosCartItem>) => {
      setCart((prev) => {
        const existing = prev.find(
          (c) =>
            c.id === item.id &&
            c.reservationStart === extras?.reservationStart &&
            c.reservationEnd === extras?.reservationEnd,
        );
        if (existing && !extras?.reservationStart) {
          return prev.map((c) =>
            c.id === item.id ? { ...c, cartQty: c.cartQty + 1 } : c,
          );
        }
        const price = extras?.cartPrice ?? resolvePrice(item);
        return [
          {
            ...item,
            cartQty: extras?.cartQty ?? 1,
            cartPrice: price,
            ...extras,
          },
          ...prev,
        ];
      });
      setSelectedCartItemId(item.id);
    },
    [resolvePrice],
  );

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.id === id ? { ...c, cartQty: Math.max(0, c.cartQty + delta) } : c,
        )
        .filter((c) => c.cartQty > 0),
    );
  };

  const setItemQty = (id: string, qty: number) => {
    setCart((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, cartQty: Math.max(0, qty) } : c,
      ),
    );
  };

  const setItemPrice = (id: string, price: number) => {
    setCart((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, cartPrice: Math.max(0, price) } : c,
      ),
    );
  };

  const handlePriceListChange = (newId: string) => {
    setPriceListId(newId);
    setCart((prev) =>
      prev.map((c) => ({
        ...c,
        cartPrice: resolveUnitPriceLocal({
          catalogItemId: c.id,
          targetSalePrice: c.target_sale_price,
          priceListId: newId === "none" ? undefined : newId,
          priceLists,
          priceListItems,
        }).price,
      })),
    );
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.cartPrice * item.cartQty,
    0,
  );
  const taxTotal = useMemo(
    () =>
      calculateOrderTaxTotal(
        cart
          .filter((c) => c.cartQty > 0)
          .map((c) => ({
            catalogItemId: c.id,
            subtotal: c.cartPrice * c.cartQty,
          })),
        taxesByItem || {},
      ),
    [cart, taxesByItem],
  );
  const shippingTotal = useMemo(
    () =>
      resolveOrderShippingCost(
        fulfillment as any,
        subtotal,
        shopSettings?.free_shipping_threshold,
        shopSettings?.shipping_cost,
        cart,
      ),
    [fulfillment, subtotal, shopSettings, cart],
  );
  const promoDiscount = useMemo(() => {
    if (!promoCode.trim()) return 0;
    const res = resolvePromotionDiscountLocal({
      code: promoCode,
      promotions,
      lines: cart
        .filter((c) => c.cartQty > 0)
        .map((c) => ({
          catalogItemId: c.id,
          categoryId: c.category_id,
          subtotal: c.cartPrice * c.cartQty,
        })),
      locationId: originLocationId || null,
    });
    return "data" in res ? res.data.discount : 0;
  }, [promoCode, promotions, cart, originLocationId]);
  const total = roundMoney(
    Math.max(0, subtotal - promoDiscount) + taxTotal + shippingTotal,
  );
  const activeCartItems = cart.filter((c) => c.cartQty > 0);

  const resetToNewOrder = useCallback(async () => {
    setActiveOrderId("new");
    setCart([]);
    setLeadValue(null);
    setPriceListId("none");
    setPromoCode("");
    if (siteId) await clearCartSession(siteId);
  }, [siteId]);

  const populateFromOrder = (order: any) => {
    if (
      !order ||
      (order.status !== "pending" &&
        order.status !== "in_progress" &&
        order.status !== "completed")
    ) {
      return false;
    }
    if (order.leads) {
      setLeadValue({
        mode: "existing",
        id: order.leads.id,
        label: order.leads.name || order.leads.email,
      });
    } else {
      setLeadValue(null);
    }
    setPriceListId(order.price_list_id || "none");
    if (order?.sale_order_items) {
      const loadedCart: PosCartItem[] = order.sale_order_items.map(
        (oi: any) => {
          const catalogItem = catalogItems.find(
            (c) => c.id === oi.catalog_item_id,
          );
          return {
            ...(catalogItem as CatalogItem),
            id: oi.catalog_item_id,
            name: oi.name || catalogItem?.name,
            cartQty: oi.quantity,
            cartPrice: oi.unit_price,
          } as PosCartItem;
        },
      );
      setCart(loadedCart);
    }
    return true;
  };

  const handleOrderSelect = async (val: string) => {
    if (!val || val === "new") {
      await resetToNewOrder();
      return;
    }
    setActiveOrderId(val);
    try {
      setLoadingOrder(true);

      // Prefer local snapshot when offline or for locally queued orders
      if (siteId && (val.startsWith("local_") || !navigator.onLine)) {
        const local = await import("@/app/pos/local/snapshot-pull").then((m) =>
          m.readLocalPendingOrders(siteId),
        );
        const match = local.find((o) => o.id === val);
        if (match?.raw && populateFromOrder(match.raw)) {
          return;
        }
        if (val.startsWith("local_")) {
          toast.message(
            t("pos.sync.pendingSale") ||
              "Sale saved locally. Syncing when online…",
          );
          return;
        }
      }

      const res = await getOrder(val);
      if (res.error) throw new Error(res.error);
      if (!populateFromOrder(res.data)) {
        await resetToNewOrder();
      }
    } catch (err: any) {
      await resetToNewOrder();
      toast.error(
        err.message || t("pos.errorLoadingOrder") || "Failed to load order",
      );
    } finally {
      setLoadingOrder(false);
    }
  };

  // Restore pending reservation from booking page
  useEffect(() => {
    if (typeof window === "undefined" || !siteId || catalogItems.length === 0) {
      return;
    }
    const pendingStr = sessionStorage.getItem("pos-pending-reservation");
    if (!pendingStr) return;
    try {
      const pending = JSON.parse(pendingStr);
      const item = catalogItems.find((i) => i.id === pending.itemId);
      if (!item) return;
      sessionStorage.removeItem("pos-pending-reservation");
      addItemToCart(item, {
        reservationStart: pending.startIso,
        reservationEnd: pending.endIso,
      });
    } catch (e) {
      console.error(e);
    }
  }, [catalogItems, siteId, addItemToCart]);

  return {
    cart,
    setCart,
    leadValue,
    setLeadValue,
    fulfillment,
    setFulfillment,
    originLocationId,
    setOriginLocationId,
    priceListId,
    promoCode,
    setPromoCode,
    selectedCartItemId,
    setSelectedCartItemId,
    activeOrderId,
    setActiveOrderId,
    buyerUserId,
    setBuyerUserId,
    allowedFulfillments,
    addItemToCart,
    updateQty,
    setItemQty,
    setItemPrice,
    handlePriceListChange,
    subtotal,
    taxTotal,
    shippingTotal,
    total,
    activeCartItems,
    resetToNewOrder,
    handleOrderSelect,
    loadingOrder,
    sessionReady,
  };
}
