"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CatalogItem, Tax } from "@/app/types";
import type { RelationSelectValue } from "@/app/components/ui/relation-select";
import type { PosCartItem } from "@/app/pos/components/CartPanel";
import {
  cartWithDiscountPercent,
  cartWithPrice,
} from "@/app/pos/cart-line-utils";
import { usePosInventoryCart } from "./use-pos-inventory-cart";
import type { PosInventorySnapshot } from "../inventory-availability";
import { repricePosCart } from "@/app/pos/reprice-cart";
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
  resolvePosCartCurrency,
} from "@/app/pos/cart-totals";
import { usePosPromo } from "@/app/pos/hooks/use-pos-promo";
import { hasPosCustomer } from "@/app/pos/lead-utils";
import { clearCartSession } from "@/app/pos/local/cart-session";
import type { PosCartSession } from "@/app/pos/local/types";
import { usePosCartSession } from "./use-pos-cart-session";
import { posOrderVersion } from "@/app/pos/order-version";
import {
  EMPTY_POS_SHIPPING_ADDRESS,
  type PosShippingAddress,
} from "@/app/pos/shipping-address";
import { usePosOrderSelection } from "./use-pos-order-selection";
import { posSessionFromOrder } from "@/app/pos/order-session";
import { normalizePosPromoFingerprint, posPromoCartFingerprint, posPromoOrderContext, recordedPosOrderPromo } from "@/app/pos/recorded-order-promo";
import { toast } from "sonner";
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext";
import { resolveSiteCurrency } from "@/app/commerce/checkout-currency";
import { offlineOrderPromotion } from "../local/offline-order-promotion";
import {
  pendingSendDeltaCount,
  type SentLineQuantities,
} from "@/app/pos/send-delta";
type UsePosCartArgs = {
  siteId?: string;
  shopSettings?: any;
  /** IANA timezone for weekday promotion checks (from site business hours). */
  siteTimezone?: string | null;
  siteCurrency?: string | null;
  catalogItems: CatalogItem[];
  catalogHydrated?: boolean;
  pendingOrders?: Parameters<typeof posSessionFromOrder>[0][];
  inventorySnapshot?: PosInventorySnapshot | null;
  locations: any[];
  priceLists: any[];
  priceListItems: any[];
  promotions?: any[];
  getTaxesForCart: (ids: string[]) => Promise<Record<string, any[]>>;
  preloadedTaxesByItem?: Record<string, Pick<Tax, "rate">[]>;
  onRequireLead?: () => void;
  t: (key: string) => string;
};
export function usePosCart({
  siteId,
  shopSettings,
  siteTimezone = null,
  catalogItems,
  catalogHydrated = true,
  pendingOrders = [],
  inventorySnapshot,
  locations,
  priceLists,
  priceListItems,
  promotions = [],
  getTaxesForCart,
  preloadedTaxesByItem,
  onRequireLead,
  t,
  siteCurrency: siteCurrencyInput,
}: UsePosCartArgs) {
  const { rates } = useDisplayCurrency();
  const siteCurrency = resolveSiteCurrency(siteCurrencyInput);
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [sentLineQuantities, setSentLineQuantities] =
    useState<SentLineQuantities>({});
  const [existingPaymentTotal, setExistingPaymentTotal] = useState(0);
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
  const [sellerUserId, setSellerUserId] = useState<string | null>(null);
  const [sellerName, setSellerName] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState("");
  const [shippingAddress, setShippingAddress] = useState<PosShippingAddress>(
    EMPTY_POS_SHIPPING_ADDRESS,
  );
  const [taxesByItem, setTaxesByItem] = useState<Record<string, any[]>>({});
  const [expectedOrderVersion, setExpectedOrderVersion] = useState<string>();
  const [orderCurrency, setOrderCurrency] = useState<string>();
  const [loadingOrder, setLoadingOrder] = useState(false);
  const orderSelectionSequence = useRef(0);
  const restoredOrderId = useRef<string | null>(null);
  useEffect(() => {
    const totalQty = cart.reduce((acc, item) => acc + item.cartQty, 0);
    const deltaQty = pendingSendDeltaCount(cart, sentLineQuantities);
    window.dispatchEvent(
      new CustomEvent("pos:cart-updated", {
        detail: { qty: totalQty, deltaQty, activeOrderId },
      })
    );
  }, [cart, sentLineQuantities, activeOrderId]);
  const hasLead = hasPosCustomer(leadValue);
  const promoContext = posPromoOrderContext({ leadValue, buyerUserId, fulfillment, originLocationId, expectedOrderVersion });
  const cartCurrency = useMemo(
    () => orderCurrency || resolvePosCartCurrency(cart, siteCurrency),
    [cart, siteCurrency, orderCurrency],
  );

  const {
    promoCode,
    setPromoCode,
    appliedPromo,
    promoDiscount,
    appliedPromoRequiresLead,
    validatePromotion,
    clearAppliedPromo,
    resetPromo,
    recordedOrderPromo,
    hydrateRecordedOrderPromo,
    recordedPromoFingerprint,
    recordedPromoNeedsReview,
    hydratePromoCode,
  } = usePosPromo({
    cart,
    promotions,
    originLocationId,
    siteTimezone,
    hasLead,
    onRequireLead,
    t,
    siteCurrency: cartCurrency,
    fxRates: rates,
    orderContext: promoContext,
  });
  const restoreSession = useCallback((session: PosCartSession) => {
      const needsOrderSnapshot = session.activeOrderId !== "new" &&
        (!session.cart?.length || !session.orderCurrency);
      restoredOrderId.current = needsOrderSnapshot
        ? session.activeOrderId : null;
      setCart(needsOrderSnapshot ? [] : session.cart || []);
      setSentLineQuantities(session.sentLineQuantities || {});
      setExistingPaymentTotal(session.existingPaymentTotal || 0);
      setLeadValue(session.leadValue);
      setFulfillment(session.fulfillment || "dine_in");
      setOriginLocationId(session.originLocationId || "");
      setPriceListId(session.priceListId || "none");
      let recorded = session.recordedOrderPromo || null;
      if (session.activeOrderId !== "new" && session.recordedOrderPromo === undefined && session.expectedOrderVersion) {
        try { recorded = recordedPosOrderPromo(JSON.parse(session.expectedOrderVersion)); } catch { /* Legacy invalid versions still fail payment validation. */ }
      }
      hydrateRecordedOrderPromo(recorded, (session.recordedPromoFingerprint
        ? normalizePosPromoFingerprint(session.recordedPromoFingerprint, session.expectedOrderVersion) : null) || (recorded && session.recordedOrderPromo === undefined
        ? "legacy-promotion-review" : posPromoCartFingerprint(
        session.cart || [], posPromoOrderContext(session),
      )));
      if (!recorded) hydratePromoCode(session.promoCode || "");
      setActiveOrderId(session.activeOrderId || "new");
      setBuyerUserId(session.buyerUserId);
      setSellerUserId(session.sellerUserId || null);
      setSellerName(session.sellerName || (session.sellerUserId ? "Seller unavailable" : null));
      setOrderNotes(session.orderNotes || "");
      setShippingAddress(session.shippingAddress || EMPTY_POS_SHIPPING_ADDRESS);
      setExpectedOrderVersion(session.expectedOrderVersion);
      setOrderCurrency(session.activeOrderId !== "new" ? session.orderCurrency : undefined);
  }, [hydratePromoCode, hydrateRecordedOrderPromo]);
  const sessionSnapshot = useMemo(() => ({
    cart, sentLineQuantities, existingPaymentTotal, leadValue, fulfillment,
    originLocationId, priceListId, promoCode, recordedOrderPromo, recordedPromoFingerprint, activeOrderId, buyerUserId,
    sellerUserId, sellerName, orderNotes, shippingAddress, expectedOrderVersion, orderCurrency,
  }), [cart, sentLineQuantities, existingPaymentTotal, leadValue, fulfillment,
    originLocationId, priceListId, promoCode, recordedOrderPromo, recordedPromoFingerprint, activeOrderId, buyerUserId,
    sellerUserId, sellerName, orderNotes, shippingAddress, expectedOrderVersion, orderCurrency]);
  const resetSelection = useRef({ siteId, snapshot: sessionSnapshot });
  useLayoutEffect(() => {
    resetSelection.current = { siteId, snapshot: sessionSnapshot };
    return () => { resetSelection.current = { siteId: undefined, snapshot: sessionSnapshot }; };
  }, [siteId, sessionSnapshot]);
  const sessionReady = usePosCartSession({
    siteId, snapshot: sessionSnapshot, loadingOrder: loadingOrder || !catalogHydrated, sequence: orderSelectionSequence,
    onRestore: restoreSession,
  });
  useEffect(() => {
    let cancelled = false;
    if (locations.length > 0 && !originLocationId && !loadingOrder) {
      const def = locations.find((l: any) => l.is_default) || locations[0];
      if (def) queueMicrotask(() => { if (!cancelled) setOriginLocationId(def.id); });
    }
    return () => { cancelled = true; };
  }, [locations, originLocationId, loadingOrder]);

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
    let cancelled = false;
    if (
      !loadingOrder &&
      allowedFulfillments.length > 0 &&
      !allowedFulfillments.includes(fulfillment)
    ) {
      const next = allowedFulfillments.includes("dine_in")
        ? "dine_in"
        : defaultFulfillment(allowedFulfillments) || "dine_in";
      queueMicrotask(() => { if (!cancelled) setFulfillment(next); });
    }
    return () => { cancelled = true; };
  }, [allowedFulfillments, fulfillment, loadingOrder]);

  const cartTaxKey = useMemo(() => {
    const ids = new Set<string>();
    for (const c of cart) {
      ids.add(c.id);
      for (const m of c.modifiers || []) ids.add(m.catalogItemId);
    }
    return Array.from(ids).sort().join(",");
  }, [cart]);

  useEffect(() => {
    if (preloadedTaxesByItem) return;
    if (!siteId || !cartTaxKey) {
      let cancelled = false;
      queueMicrotask(() => { if (!cancelled) setTaxesByItem({}); });
      return () => { cancelled = true; };
    }
    let cancelled = false;
    void getTaxesForCart(cartTaxKey.split(",")).then((taxes) => {
      if (!cancelled) setTaxesByItem(taxes);
    }).catch(() => {
      if (!cancelled) toast.error("Failed to load item taxes. Please sync the catalog.");
    });
    return () => { cancelled = true; };
  }, [siteId, cartTaxKey, getTaxesForCart, preloadedTaxesByItem]);

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

  const inventoryCart = usePosInventoryCart({
    cart, setCart, setSelectedCartItemId, resolvePrice,
    catalogItems, inventorySnapshot, originLocationId,
  });

  const setItemPrice = (id: string, price: number) => {
    setCart((prev) => cartWithPrice(prev, id, price));
  };

  const setItemDiscount = (id: string, percent: number) => {
    setCart((prev) => cartWithDiscountPercent(prev, id, percent));
  };
  const handlePriceListChange = (newId: string) => {
    const listId = newId === "none" ? undefined : newId;
    try {
      const next = repricePosCart(cart, catalogItems, (item) => resolveUnitPriceLocal({
        catalogItemId: item.id, targetSalePrice: item.target_sale_price,
        priceListId: listId, priceLists, priceListItems,
      }).price, rates);
      setPriceListId(newId);
      setCart(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update line prices.");
    }
  };

  const subtotal = posCartSubtotalInSiteCurrency(cart, cartCurrency, rates);
  const taxTotal = useMemo(
    () =>
      calculateOrderTaxTotal(
        posCartTaxLinesInSiteCurrency(cart, cartCurrency, rates),
        preloadedTaxesByItem ?? taxesByItem,
      ),
    [cart, taxesByItem, preloadedTaxesByItem, cartCurrency, rates],
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
  const clearOrderFields = useCallback(() => {
    setCart([]);
    setSentLineQuantities({});
    setExistingPaymentTotal(0);
    setExpectedOrderVersion(undefined);
    setOrderCurrency(undefined);
    setLeadValue(null);
    setPriceListId("none");
    setFulfillment("dine_in");
    setOrderNotes("");
    setBuyerUserId(null);
    setSellerUserId(null);
    setSellerName(null);
    setShippingAddress(EMPTY_POS_SHIPPING_ADDRESS);
    resetPromo();
    setSelectedCartItemId(null);
  }, [resetPromo]);
  const resetToNewOrder = useCallback(async () => {
    const sequence = ++orderSelectionSequence.current;
    const selected = resetSelection.current;
    const isCurrent = () => sequence === orderSelectionSequence.current && resetSelection.current === selected;
    // Suspend old-cart autosaves and collection until the durable reset succeeds.
    setLoadingOrder(true);
    try {
      if (siteId) await clearCartSession(siteId, isCurrent);
      if (!isCurrent()) throw new Error("The active cart changed. Confirm the selected order again.");
      setActiveOrderId("new");
      clearOrderFields();
    } finally {
      if (sequence === orderSelectionSequence.current) setLoadingOrder(false);
    }
  }, [siteId, clearOrderFields]);
  const populateFromOrder = useCallback((order: Parameters<typeof posSessionFromOrder>[0], includeCart: boolean) => {
    const session = posSessionFromOrder(includeCart ? order : { ...order, sale_order_items: [] }, catalogItems);
    if (!session) return false;
    const restoredCurrency = typeof order.currency === "string" && order.currency.trim()
      ? resolveSiteCurrency(order.currency) : undefined;
    const restoredPromo = order.pending_sync && order.local_checkout_snapshot
      ? offlineOrderPromotion(order, session.cart || [], promotions,
        restoredCurrency || resolvePosCartCurrency(session.cart || [], siteCurrency), rates, siteTimezone)
      : session.recordedOrderPromo;
    setLeadValue(session.leadValue);
    setFulfillment(session.fulfillment);
    setOriginLocationId(session.originLocationId);
    setPriceListId(session.priceListId);
    setOrderNotes(session.orderNotes);
    setBuyerUserId(session.buyerUserId);
    setSellerUserId(session.sellerUserId);
    setSellerName(session.sellerName);
    setShippingAddress(session.shippingAddress);
    setSentLineQuantities(session.sentLineQuantities);
    setExistingPaymentTotal(session.existingPaymentTotal);
    const version = includeCart ? (order.pending_sync ? order.expected_order_version : posOrderVersion(order)) : undefined;
    setExpectedOrderVersion(version);
    setOrderCurrency(restoredCurrency);
    if (includeCart && session.cart) setCart(session.cart);
    hydrateRecordedOrderPromo(restoredPromo, posPromoCartFingerprint(session.cart || [],
      posPromoOrderContext({ ...session, expectedOrderVersion: version })));
    return true;
  }, [catalogItems, hydrateRecordedOrderPromo, promotions, siteCurrency, rates, siteTimezone]);
  const { handleOrderSelect } = usePosOrderSelection({
    siteId, pendingOrders, sequence: orderSelectionSequence, populateFromOrder,
    clearOrderFields, resetToNewOrder, setActiveOrderId, setLoadingOrder,
  });
  useEffect(() => {
    if (!catalogHydrated || !sessionReady || loadingOrder || activeOrderId === "new" || cart.length ||
      restoredOrderId.current !== activeOrderId) return;
    restoredOrderId.current = null;
    void handleOrderSelect(activeOrderId);
  }, [siteId, activeOrderId, cart.length, catalogHydrated, sessionReady, loadingOrder, handleOrderSelect]);

  return {
    cart: sessionReady && catalogHydrated ? inventoryCart.displayCart : [],
    setCart,
    existingPaymentTotal,
    expectedOrderVersion,
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
    sellerUserId,
    setSellerUserId,
    sellerName,
    setSellerName,
    orderNotes,
    setOrderNotes,
    shippingAddress,
    setShippingAddress,
    allowedFulfillments,
    addItemToCart: (item: CatalogItem, extras?: Partial<PosCartItem>) => inventoryCart.addItemToCart(item, {
      ...extras,
      modifiers: extras?.modifiers?.map((modifier) => ({ ...modifier,
        currency: modifier.currency || catalogItems.find((product) => product.id === modifier.catalogItemId)?.currency || item.currency,
      })),
    }),
    updateQty: inventoryCart.updateQty,
    setItemQty: inventoryCart.setItemQty,
    getItemAvailability: inventoryCart.getItemAvailability,
    validateInventory: () => {
      if (recordedPromoNeedsReview) {
        toast.error("This order has a recorded promotion. Reload the original order before payment, or update it in Orders.");
        return false;
      }
      return inventoryCart.validateInventory();
    },
    setItemPrice,
    setItemDiscount,
    handlePriceListChange,
    subtotal,
    taxTotal,
    shippingTotal,
    total,
    cartCurrency,
    activeCartItems,
    resetToNewOrder,
    handleOrderSelect,
    loadingOrder,
    sessionReady,
  };
}
