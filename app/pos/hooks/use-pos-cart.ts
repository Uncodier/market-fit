"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogItem } from "@/app/types";
import type { RelationSelectValue } from "@/app/components/ui/relation-select";
import type { PosCartItem } from "@/app/pos/components/CartPanel";
import {
  cartWithDiscountPercent,
  cartWithPrice,
  cartWithQty,
  cartWithQtyDelta,
  mergeItemIntoCart,
} from "@/app/pos/cart-line-utils";
import { clearLineDiscountFields } from "@/app/pos/line-discount";
import { buildCartFromSaleOrderItems } from "@/app/pos/populate-cart-from-order";
import {
  getItemDeliveryOptions,
  intersectDeliveryOptions,
  defaultFulfillment,
  withPosFulfillmentOptions,
  type CheckoutFulfillmentMethod,
} from "@/app/commerce/delivery-options";
import { calculateOrderTaxTotal, roundMoney } from "@/app/commerce/taxes";
import { resolveOrderShippingCost } from "@/app/commerce/delivery-options";
import { resolveUnitPriceLocal } from "@/app/pos/local/resolve-unit-price-local";
import {
  posCartSubtotalInSiteCurrency,
  posCartTaxLinesInSiteCurrency,
} from "@/app/pos/cart-totals";
import { usePosPromo } from "@/app/pos/hooks/use-pos-promo";
import { hasPosCustomer } from "@/app/pos/lead-utils";
import {
  clearCartSession,
  loadCartSession,
  saveCartSession,
} from "@/app/pos/local/cart-session";
import {
  EMPTY_POS_SHIPPING_ADDRESS,
  type PosShippingAddress,
} from "@/app/pos/shipping-address";
import { getOrder } from "@/app/orders/actions";
import { isPosOpenOrder } from "@/app/pos/open-orders";
import { toast } from "sonner";
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext";
import { resolveSiteCurrency } from "@/app/commerce/checkout-currency";

type UsePosCartArgs = {
  siteId?: string;
  shopSettings?: any;
  /** IANA timezone for weekday promotion checks (from site business hours). */
  siteTimezone?: string | null;
  siteCurrency?: string | null;
  catalogItems: CatalogItem[];
  locations: any[];
  priceLists: any[];
  priceListItems: any[];
  promotions?: any[];
  getTaxesForCart: (ids: string[]) => Promise<Record<string, any[]>>;
  onRequireLead?: () => void;
  t: (key: string) => string;
};

export function usePosCart({
  siteId,
  shopSettings,
  siteTimezone = null,
  catalogItems,
  locations,
  priceLists,
  priceListItems,
  promotions = [],
  getTaxesForCart,
  onRequireLead,
  t,
  siteCurrency: siteCurrencyInput,
}: UsePosCartArgs) {
  const { rates } = useDisplayCurrency();
  const siteCurrency = resolveSiteCurrency(siteCurrencyInput);
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [leadValue, setLeadValue] = useState<RelationSelectValue | string | null>(
    null,
  );
  const [fulfillment, setFulfillment] =
    useState<CheckoutFulfillmentMethod>("dine_in");
  const [originLocationId, setOriginLocationId] = useState("");
  const [priceListId, setPriceListId] = useState("none");
  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(
    null,
  );
  const [activeOrderId, setActiveOrderId] = useState("new");
  const [buyerUserId, setBuyerUserId] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState("");
  const [shippingAddress, setShippingAddress] = useState<PosShippingAddress>(
    EMPTY_POS_SHIPPING_ADDRESS,
  );
  const [taxesByItem, setTaxesByItem] = useState<Record<string, any[]>>({});
  const [sessionReady, setSessionReady] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const restoredRef = useRef(false);
  const persistTimer = useRef<number | null>(null);

  useEffect(() => {
    const totalQty = cart.reduce((acc, item) => acc + item.cartQty, 0);
    window.dispatchEvent(
      new CustomEvent("pos:cart-updated", {
        detail: { qty: totalQty, activeOrderId },
      })
    );
  }, [cart, activeOrderId]);

  const hasLead = hasPosCustomer(leadValue);

  const {
    promoCode,
    setPromoCode,
    appliedPromo,
    promoDiscount,
    appliedPromoRequiresLead,
    validatePromotion,
    clearAppliedPromo,
    resetPromo,
  } = usePosPromo({
    cart,
    promotions,
    originLocationId,
    siteTimezone,
    hasLead,
    onRequireLead,
    t,
    siteCurrency,
    fxRates: rates,
  });

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
      setOrderNotes(session.orderNotes || "");
      setShippingAddress(session.shippingAddress || EMPTY_POS_SHIPPING_ADDRESS);
      setSessionReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [siteId, setPromoCode]);

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
        orderNotes,
        shippingAddress,
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
    orderNotes,
    shippingAddress,
  ]);

  useEffect(() => {
    if (locations.length > 0 && !originLocationId) {
      const def = locations.find((l: any) => l.is_default) || locations[0];
      if (def) setOriginLocationId(def.id);
    }
  }, [locations, originLocationId]);

  const allowedFulfillments = useMemo((): CheckoutFulfillmentMethod[] => {
    if (cart.length === 0) return withPosFulfillmentOptions([]);
    return withPosFulfillmentOptions(
      intersectDeliveryOptions(
        cart.map((i) => ({
          allowed: getItemDeliveryOptions(i, shopSettings?.default_delivery_options),
        })),
      ),
    );
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

  const cartTaxKey = useMemo(() => {
    const ids = new Set<string>();
    for (const c of cart) {
      ids.add(c.id);
      for (const m of c.modifiers || []) ids.add(m.catalogItemId);
    }
    return Array.from(ids).sort().join(",");
  }, [cart]);

  useEffect(() => {
    if (!siteId || cart.length === 0) {
      setTaxesByItem({});
      return;
    }
    const ids = new Set<string>();
    for (const c of cart) {
      ids.add(c.id);
      for (const m of c.modifiers || []) ids.add(m.catalogItemId);
    }
    void getTaxesForCart(Array.from(ids)).then(setTaxesByItem);
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
      let selectedKey = item.id;
      setCart((prev) => {
        const { next, lineKey } = mergeItemIntoCart(
          prev,
          item,
          extras,
          resolvePrice,
        );
        selectedKey = lineKey;
        return next;
      });
      setSelectedCartItemId(selectedKey);
    },
    [resolvePrice],
  );

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => cartWithQtyDelta(prev, id, delta));
  };

  const setItemQty = (id: string, qty: number) => {
    setCart((prev) => cartWithQty(prev, id, qty));
  };

  const setItemPrice = (id: string, price: number) => {
    setCart((prev) => cartWithPrice(prev, id, price));
  };

  const setItemDiscount = (id: string, percent: number) => {
    setCart((prev) => cartWithDiscountPercent(prev, id, percent));
  };

  const handlePriceListChange = (newId: string) => {
    setPriceListId(newId);
    const listId = newId === "none" ? undefined : newId;
    setCart((prev) =>
      prev.map((c) => {
        const cartPrice = resolveUnitPriceLocal({
          catalogItemId: c.id,
          targetSalePrice: c.target_sale_price,
          priceListId: listId,
          priceLists,
          priceListItems,
        }).price;
        return {
          ...clearLineDiscountFields(c, cartPrice),
          modifiers: (c.modifiers || []).map((m) => ({
            ...m,
            cartPrice: resolveUnitPriceLocal({
              catalogItemId: m.catalogItemId,
              targetSalePrice: m.cartPrice,
              priceListId: listId,
              priceLists,
              priceListItems,
            }).price,
          })),
        };
      }),
    );
  };

  const subtotal = posCartSubtotalInSiteCurrency(cart, siteCurrency, rates);
  const taxTotal = useMemo(
    () =>
      calculateOrderTaxTotal(
        posCartTaxLinesInSiteCurrency(cart, siteCurrency, rates),
        taxesByItem || {},
      ),
    [cart, taxesByItem, siteCurrency, rates],
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

  const total = roundMoney(
    Math.max(0, subtotal - promoDiscount) + taxTotal + shippingTotal,
  );
  const activeCartItems = cart.filter((c) => c.cartQty > 0);

  const resetToNewOrder = useCallback(async () => {
    setActiveOrderId("new");
    setCart([]);
    setLeadValue(null);
    setPriceListId("none");
    setFulfillment("dine_in");
    setOrderNotes("");
    setBuyerUserId(null);
    setShippingAddress(EMPTY_POS_SHIPPING_ADDRESS);
    resetPromo();
    if (siteId) await clearCartSession(siteId);
  }, [siteId, resetPromo]);

  const populateFromOrder = (order: any) => {
    if (!isPosOpenOrder(order)) {
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
    setOrderNotes(typeof order.notes === "string" ? order.notes : "");
    setBuyerUserId(order.buyer_user_id || null);
    const addr = order.shipping_address;
    setShippingAddress(
      addr && typeof addr === "object"
        ? {
            line1: addr.line1 || "",
            line2: addr.line2 || "",
            city: addr.city || "",
            state: addr.state || "",
            zip: addr.zip || "",
            country: addr.country || "",
          }
        : EMPTY_POS_SHIPPING_ADDRESS,
    );
    if (order?.sale_order_items) {
      setCart(
        buildCartFromSaleOrderItems(order.sale_order_items, catalogItems),
      );
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
    appliedPromo,
    promoDiscount,
    appliedPromoRequiresLead,
    validatePromotion,
    clearAppliedPromo,
    selectedCartItemId,
    setSelectedCartItemId,
    activeOrderId,
    setActiveOrderId,
    buyerUserId,
    setBuyerUserId,
    orderNotes,
    setOrderNotes,
    shippingAddress,
    setShippingAddress,
    allowedFulfillments,
    addItemToCart,
    updateQty,
    setItemQty,
    setItemPrice,
    setItemDiscount,
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
