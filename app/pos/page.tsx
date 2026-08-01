"use client";

import React, { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import { useSite } from "@/app/context/SiteContext";
import { useLocalization } from "@/app/context/LocalizationContext";
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider";
import { listCatalogItems, listCatalogCategories } from "@/app/catalog/actions";
import { listOrders, getOrder } from "@/app/orders/actions";
import { resolveUnitPrice, listPriceLists } from "@/app/price-lists/actions";
import { checkoutCart, CheckoutLine } from "@/app/commerce/checkout";
import { calculateOrderTaxTotal, roundMoney } from "@/app/commerce/taxes";
import { getTaxesByCatalogItemIds } from "@/app/catalog/tax-actions";
import { StickyHeader } from "@/app/components/ui/sticky-header";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Button } from "@/app/components/ui/button";
import { SearchInput } from "@/app/components/ui/search-input";
import {
  RelationSelect,
  RelationSelectValue,
} from "@/app/components/ui/relation-select";
import { resolveRelationId } from "@/app/commerce/resolve-relation";
import { Sheet, SheetContent, SheetTrigger } from "@/app/components/ui/sheet";
import { toast } from "sonner";
import { ShoppingCart, Ticket } from "@/app/components/ui/icons";
import { listLocations } from "@/app/inventory/actions";
import { getLeads } from "@/app/leads/actions";
import { PaymentConfirmationDialog } from "./components/PaymentConfirmationDialog";
import { PosVariantPickerDialog } from "./components/PosVariantPickerDialog"
import { CartPanel, PosCartItem } from "./components/CartPanel";
import { PosCatalogGrid } from "./components/PosCatalogGrid";
import { useRouter } from "next/navigation"
import {
  getActivePosOrderId,
  setActivePosOrderId,
  clearActivePosOrderId,
} from "./active-order-storage";
import { isAccessOnlyItem } from "@/app/catalog/product-details";
import {
  getItemDeliveryOptions,
  intersectDeliveryOptions,
  CheckoutFulfillmentMethod
} from "@/app/commerce/delivery-options";
import { CatalogItem } from "@/app/types";

export default function POSPage() {
  const { currentSite } = useSite();
  const { t } = useLocalization();
  const { user } = useAuth();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<PosCartItem[]>([]);

  // Checkout states
  const [leadValue, setLeadValue] = useState<RelationSelectValue>(null);
  const [fulfillment, setFulfillment] = useState<
    "pickup" | "ship" | "dine_in" | "none"
  >("none");
  const [originLocationId, setOriginLocationId] = useState<string>("");
  const [priceListId, setPriceListId] = useState<string>("none");
  const [promoCode, setPromoCode] = useState("");
  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(
    null,
  );
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [variantParentItem, setVariantParentItem] = useState<CatalogItem | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string>("new");
  const [buyerUserId, setBuyerUserId] = useState<string | null>(null);
  const creatingOrderRef = React.useRef<boolean>(false);
  const restoredOrderRef = React.useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const leadIdParam = params.get("leadId");
      const buyerUserParam = params.get("buyerUserId");
      
      if (leadIdParam) {
        setLeadValue(leadIdParam);
      }
      if (buyerUserParam) {
        setBuyerUserId(buyerUserParam);
      }
      
      // Optionally clean up the URL without reloading
      if (leadIdParam || buyerUserParam) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  const allowedFulfillments = useMemo(() => {
    return intersectDeliveryOptions(cart.map((i: any) => ({
      allowed: getItemDeliveryOptions(i, currentSite?.settings?.shop?.default_delivery_options)
    })))
  }, [cart, currentSite]);

  useEffect(() => {
    if (allowedFulfillments.length > 0 && !allowedFulfillments.includes(fulfillment)) {
      setFulfillment(allowedFulfillments[0]);
    }
  }, [allowedFulfillments, fulfillment]);

  // Fetch sellable catalog items (can be optimized to only show active)
  const { data: catalogData, isLoading: catalogLoading, isValidating: catalogValidating } = useSWR(
    currentSite?.id ? ["pos_catalog", currentSite.id, searchQuery] : null,
    () =>
      listCatalogItems({
        siteId: currentSite!.id,
        status: "active",
        isPosAvailable: true,
        q: searchQuery,
        pageSize: 100,
      }),
  );

  const { data: locationsData } = useSWR(
    currentSite?.id ? ["locations", currentSite.id] : null,
    () => listLocations(currentSite!.id),
  );
  const { data: leadsData } = useSWR(
    currentSite?.id ? ["leads", currentSite.id] : null,
    () => getLeads(currentSite!.id),
  );
  const { data: categoriesData } = useSWR(
    currentSite?.id ? ["categories", currentSite.id] : null,
    () => listCatalogCategories(currentSite!.id),
  );
  const { data: pendingOrdersData, mutate } = useSWR(
    currentSite?.id ? ["pending_orders", currentSite.id] : null,
    () =>
      listOrders({ siteId: currentSite!.id, status: "pending", pageSize: 50 }),
  );
  const { data: priceListsData } = useSWR(
    currentSite?.id ? ["price_lists", currentSite.id] : null,
    () => listPriceLists({ siteId: currentSite!.id, pageSize: 100 }),
  );

  const allItems = catalogData?.data || [];
  const locations = locationsData?.data || [];
  const categories = categoriesData?.data || [];
  const pendingOrders = pendingOrdersData?.data || [];
  const priceLists = (priceListsData?.data || []).filter(
    (pl: any) => pl.is_active,
  );

  const availableItems = useMemo(() => {
    return allItems.filter(
      (item: any) =>
        item.availability_mode !== "manual" ||
        item.availability_status === "available"
    );
  }, [allItems]);

  const hasProducts = useMemo(() => availableItems.some((i: any) => i.kind === "product"), [availableItems]);
  const hasServices = useMemo(() => availableItems.some((i: any) => i.kind === "service"), [availableItems]);
  const hasDigital = useMemo(() => availableItems.some((i: any) => i.kind === "digital_asset"), [availableItems]);

  const nonEmptyCategories = useMemo(() => {
    return categories.filter((cat: any) =>
      availableItems.some((i: any) => i.category_id === cat.id)
    );
  }, [categories, availableItems]);

  const items = useMemo(() => {
    if (selectedCategory === "all") return allItems;
    if (selectedCategory === "kind_product")
      return allItems.filter((i: any) => i.kind === "product");
    if (selectedCategory === "kind_service")
      return allItems.filter((i: any) => i.kind === "service");
    if (selectedCategory === "kind_digital_asset")
      return allItems.filter((i: any) => i.kind === "digital_asset");
    return allItems.filter((i: any) => i.category_id === selectedCategory);
  }, [allItems, selectedCategory]);

  // Set default location if empty
  useEffect(() => {
    if (locations.length > 0 && !originLocationId) {
      const def = locations.find((l: any) => l.is_default) || locations[0];
      if (def) setOriginLocationId(def.id);
    }
  }, [locations, originLocationId]);

  useEffect(() => {
    if (typeof window !== "undefined" && currentSite && user) {
      const pendingStr = sessionStorage.getItem("pos-pending-reservation");
      if (pendingStr) {
        try {
          const pending = JSON.parse(pendingStr);
          const item = allItems.find((i: any) => i.id === pending.itemId);
          if (item) {
            sessionStorage.removeItem("pos-pending-reservation");
            // Need to wrap in an async IIFE to call resolveUnitPrice
            (async () => {
              const res = await resolveUnitPrice(
                currentSite.id,
                item.id,
                priceListId && priceListId !== "none" ? priceListId : undefined,
              );
              const price = res.price || item.target_sale_price || 0;
              setCart(prev => [
                { ...item, cartQty: 1, cartPrice: price, reservationStart: pending.startIso, reservationEnd: pending.endIso },
                ...prev
              ]);
            })();
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [allItems, currentSite, user, priceListId]);

  const handlePriceListChange = async (newId: string) => {
    setPriceListId(newId);
    if (!currentSite || cart.length === 0) return;

    const actualId = newId === "none" ? undefined : newId;

    // re-resolve prices
    const newCart = await Promise.all(
      cart.map(async (c) => {
        const res = await resolveUnitPrice(currentSite.id, c.id, actualId);
        return { ...c, cartPrice: res.price || c.target_sale_price || 0 };
      }),
    );

    setCart(newCart);
  };

  const addToCart = async (item: CatalogItem) => {
    if (!currentSite || !user) return;

    // Check if it's a parent item with variants
    if (item.metadata?.variant_axes && item.metadata.variant_axes.length > 0 && !item.is_purchasable) {
      setVariantParentItem(item);
      return;
    }

    // Check if unavailable
    if (
      item.availability_mode === "manual" &&
      item.availability_status !== "available"
    ) {
      toast.error(t("pos.errorItemNotAvailable") || "Item is not available");
      return;
    }

    if (item.is_reservation && !isAccessOnlyItem(item)) {
      router.push(`/pos/book/${item.id}`)
      return;
    }

    const existing = cart.find((c) => c.id === item.id);
    let newCart = [...cart];

    if (existing) {
      newCart = cart.map((c) =>
        c.id === item.id ? { ...c, cartQty: c.cartQty + 1 } : c,
      );
      setCart(newCart);
    } else {
      // Fetch resolved price (using resolveUnitPrice server action)
      const res = await resolveUnitPrice(
        currentSite.id,
        item.id,
        priceListId && priceListId !== "none" ? priceListId : undefined,
      );
      const price = res.price || item.target_sale_price || 0;
      newCart = [{ ...item, cartQty: 1, cartPrice: price }, ...cart];
      setCart(newCart);
    }

    setSelectedCartItemId(item.id);

    if (activeOrderId === "new" && !creatingOrderRef.current) {
      creatingOrderRef.current = true;
      try {
        const lines: CheckoutLine[] = newCart
          .filter((c) => c.cartQty > 0)
          .map((c) => ({
            catalogItemId: c.id,
            quantity: c.cartQty,
          }));

        const res = await checkoutCart({
          siteId: currentSite.id,
          userId: user.id,
          lines,
          fulfillment,
          originLocationId: originLocationId,
          source: "pos",
          payments: [],
          existingOrderId: activeOrderId !== "new" ? activeOrderId : undefined,
          intent: 'draft'
        });

        if (res.orderId) {
          setActiveOrderId(res.orderId);
          setActivePosOrderId(currentSite.id, res.orderId);
          mutate(["pending_orders", currentSite.id]);
        }
      } catch (err) {
        console.error("Failed to auto-create order", err);
      } finally {
        creatingOrderRef.current = false;
      }
    }
  };

  const updateQty = (id: string, delta: number) => {
    setCart(
      cart
        .map((c) => {
          if (c.id === id) {
            const newQty = Math.max(0, c.cartQty + delta);
            return { ...c, cartQty: newQty };
          }
          return c;
        })
        .filter((c) => c.cartQty > 0),
    );
  };

  const setItemQty = (id: string, qty: number) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return { ...c, cartQty: Math.max(0, qty) };
        }
        return c;
      })
    );
  };

  const setItemPrice = (id: string, price: number) => {
    setCart(
      cart.map((c) => {
        if (c.id === id) {
          return { ...c, cartPrice: Math.max(0, price) };
        }
        return c;
      }),
    );
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.cartPrice * item.cartQty,
    0,
  );

  const cartTaxKey = useMemo(
    () =>
      cart
        .map((c) => c.id)
        .sort()
        .join(","),
    [cart],
  );

  const { data: taxesByItem } = useSWR(
    currentSite?.id && cart.length > 0
      ? ["pos_cart_taxes", currentSite.id, cartTaxKey]
      : null,
    () =>
      getTaxesByCatalogItemIds(
        currentSite!.id,
        cart.map((c) => c.id),
      ).then((res) => res.data || {}),
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

  const total = roundMoney(subtotal + taxTotal);
  const activeCartItems = cart.filter((c) => c.cartQty > 0);

  const initiateCheckout = () => {
    if (activeCartItems.length === 0) return;
    if (!originLocationId) {
      toast.error(t("pos.errorSelectOrigin") || "Select an origin location");
      return;
    }
    if (fulfillment === "ship" && !leadValue) {
      toast.error(
        t("pos.errorSelectCustomerShipping") ||
          "Select a customer for shipping",
      );
      return;
    }
    setIsPaymentDialogOpen(true);
  };

  const handleCheckout = async (
    payments: {
      method: string;
      amount: number;
      tendered: number;
      change: number;
    }[],
    checkoutPromoCode?: string,
    intent?: 'complete' | 'pay' | 'send'
  ) => {
    if (!currentSite || !user) return;

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = roundMoney(total - totalPaid);
    const requiresCustomer = intent === 'complete' && remainingAmount > 0;

    if (intent === 'send' && payments.length === 0) {
      toast.error(
        t("pos.errorAddPaymentFirst") || "Add at least one payment first",
      );
      return;
    }

    if (requiresCustomer && !leadValue) {
      toast.error(
        t("pos.errorSelectCustomerUnpaid") ||
          "Select a customer to leave payment pending",
      );
      setIsPaymentDialogOpen(false);
      return;
    }

    setCheckoutLoading(true);

    try {
      const { id: resolvedLeadId, error: leadError } = await resolveRelationId(
        "lead",
        leadValue,
        currentSite.id,
      );
      if (leadError) throw new Error(`Lead error: ${leadError}`);

      if (requiresCustomer && !resolvedLeadId) {
        toast.error(
          t("pos.errorSelectCustomerUnpaid") ||
            "Select a customer to leave payment pending",
        );
        setCheckoutLoading(false);
        setIsPaymentDialogOpen(false);
        return;
      }

      const lines: CheckoutLine[] = cart
        .filter((c) => c.cartQty > 0)
        .map((c) => ({
          catalogItemId: c.id,
          quantity: c.cartQty,
          unitPriceOverride: c.cartPrice,
        }));

      const finalPromoCode = checkoutPromoCode || promoCode || undefined;

      const res = await checkoutCart({
        siteId: currentSite.id,
        userId: user.id,
        lines,
        priceListId:
          priceListId && priceListId !== "none" ? priceListId : undefined,
        leadId: resolvedLeadId || undefined,
        buyerUserId: buyerUserId || undefined,
        fulfillment,
        originLocationId: originLocationId,
        promotionCode: finalPromoCode,
        source: "pos",
        payments,
        existingOrderId: activeOrderId !== "new" ? activeOrderId : undefined,
        intent: intent || 'pay'
      });

      if (res.error) {
        toast.error(res.error);
        setCheckoutLoading(false);
        setIsPaymentDialogOpen(false);
        return;
      }

      toast.success(
        intent === "send"
          ? (t("pos.paymentRegistered") || "Payment registered. Order kept pending.")
          : (t("pos.checkoutComplete") || "Checkout complete!"),
      );
      setCart([]);
      setLeadValue(null);
      setActiveOrderId("new");
      clearActivePosOrderId(currentSite.id);
      setIsPaymentDialogOpen(false);
      if (intent === "send" && res.orderId) {
        router.push(`/orders/${res.orderId}`);
      } else if (res.saleId) {
        router.push(`/sales/${res.saleId}`);
      }
    } catch (err: any) {
      toast.error(
        err.message || t("pos.errorCheckingOut") || "Error checking out",
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  useEffect(() => {
    // Si queremos un titulo especial
    const event = new CustomEvent("breadcrumb:update", {
      detail: {
        title: t("layout.sidebar.pos") || "Point of Sale",
      },
    });
    window.dispatchEvent(event);
  }, [t]);

  useEffect(() => {
    const handleSendOrder = async () => {
      const activeItems = cart.filter((c) => c.cartQty > 0);
      if (activeItems.length === 0) {
        toast.error(t("pos.errorCartEmpty") || "Cart is empty");
        return;
      }
      if (!originLocationId) {
        toast.error(t("pos.errorSelectOrigin") || "Select an origin location");
        return;
      }
      if (fulfillment === "ship" && !leadValue) {
        toast.error(
          t("pos.errorSelectCustomerShipping") ||
            "Select a customer for shipping",
        );
        return;
      }
      if (!currentSite || !user) return;

      setCheckoutLoading(true);

      try {
        const { id: resolvedLeadId, error: leadError } =
          await resolveRelationId("lead", leadValue, currentSite.id);
        if (leadError) throw new Error(`Lead error: ${leadError}`);

        const lines: CheckoutLine[] = cart
          .filter((c) => c.cartQty > 0)
          .map((c) => ({
            catalogItemId: c.id,
            quantity: c.cartQty,
            unitPriceOverride: c.cartPrice,
          }));

        const res = await checkoutCart({
          siteId: currentSite.id,
          userId: user.id,
          lines,
          priceListId:
            priceListId && priceListId !== "none" ? priceListId : undefined,
          leadId: resolvedLeadId || undefined,
          buyerUserId: buyerUserId || undefined,
          fulfillment,
          originLocationId: originLocationId,
        source: "pos",
        payments: [], // Sending empty payments so it becomes a pending order (or completed if rules apply, but no payment collected here)
        existingOrderId: activeOrderId !== "new" ? activeOrderId : undefined,
        intent: 'send'
      });

        if (res.error) {
          toast.error(res.error);
          setCheckoutLoading(false);
          return;
        }

        toast.success(t("pos.orderSent") || "Order sent to orders panel!");
        setCart([]);
        setLeadValue(null);
        setActiveOrderId("new");
        clearActivePosOrderId(currentSite.id);
        if (res.orderId) {
          router.push(`/orders/${res.orderId}`);
        }
      } catch (err: any) {
        toast.error(
          err.message || t("pos.errorSendingOrder") || "Error sending order",
        );
      } finally {
        setCheckoutLoading(false);
      }
    };

    window.addEventListener("pos:send-order", handleSendOrder);
    return () => window.removeEventListener("pos:send-order", handleSendOrder);
  }, [
    cart,
    originLocationId,
    leadValue,
    fulfillment,
    priceListId,
    currentSite,
    user,
    router,
  ]);

  const resetToNewOrder = () => {
    setActiveOrderId("new");
    if (currentSite) clearActivePosOrderId(currentSite.id);
    setCart([]);
    setLeadValue(null);
    setPriceListId("none");
  };

  const handleOrderSelect = async (val: string) => {
    if (!val || val === "new") {
      resetToNewOrder();
      return;
    }

    const orderId = val;
    setActiveOrderId(orderId);
    if (currentSite) setActivePosOrderId(currentSite.id, orderId);

    try {
      setCheckoutLoading(true);
      const res = await getOrder(orderId);
      if (res.error) throw new Error(res.error);
      const order = res.data;

      if (!order || order.status !== "pending") {
        resetToNewOrder();
        return;
      }

      // Populate lead if available
      if (order.leads) {
        setLeadValue({
          mode: "existing",
          id: order.leads.id,
          label: order.leads.name || order.leads.email,
        });
      } else {
        setLeadValue(null);
      }

      // Populate price list if available
      if (order.price_list_id) {
        setPriceListId(order.price_list_id);
      } else {
        setPriceListId("none");
      }

      // Populate cart from order items
      if (order?.sale_order_items && allItems.length > 0) {
        const loadedCart: PosCartItem[] = order.sale_order_items.map((oi: any) => {
          const catalogItem = allItems.find(
            (c: any) => c.id === oi.catalog_item_id,
          );
          return {
            ...catalogItem,
            id: oi.catalog_item_id, // ensure ID is set for missing items
            name: oi.name,
            cartQty: oi.quantity,
            cartPrice: oi.unit_price,
          } as PosCartItem;
        });
        setCart(loadedCart);
      }
    } catch (err: any) {
      resetToNewOrder();
      toast.error(
        err.message || t("pos.errorLoadingOrder") || "Failed to load order",
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Allow restore again when switching sites
  useEffect(() => {
    restoredOrderRef.current = false;
  }, [currentSite?.id]);

  // Restore last open order on mount / site change
  useEffect(() => {
    if (!currentSite || !user || allItems.length === 0 || restoredOrderRef.current) {
      return;
    }

    const savedOrderId = getActivePosOrderId(currentSite.id);
    restoredOrderRef.current = true;

    if (savedOrderId && activeOrderId === "new") {
      handleOrderSelect(savedOrderId).catch((err) => {
        console.error("Failed to restore POS order", err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSite, user, allItems]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-var(--topbar-height,64px))] overflow-hidden bg-muted/30">
      <Tabs
        value={selectedCategory}
        onValueChange={setSelectedCategory}
        className="flex-1 flex flex-col min-h-0"
      >
        <StickyHeader className="!top-0">
          <div className="w-full pt-0">
            <div className="flex items-center gap-8">
              <div>
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full flex-shrink-0">
                  <TabsTrigger
                    value="all"
                    className="rounded-full text-xs px-3"
                  >
                    {t("pos.filters.all") || "All"}
                  </TabsTrigger>
                  {hasProducts && (
                    <TabsTrigger
                      value="kind_product"
                      className="rounded-full text-xs px-3"
                    >
                      {t("pos.filters.products") || "Products"}
                    </TabsTrigger>
                  )}
                  {hasServices && (
                    <TabsTrigger
                      value="kind_service"
                      className="rounded-full text-xs px-3"
                    >
                      {t("pos.filters.services") || "Services"}
                    </TabsTrigger>
                  )}
                  {hasDigital && (
                    <TabsTrigger
                      value="kind_digital_asset"
                      className="rounded-full text-xs px-3"
                    >
                      {t("pos.filters.digitalAssets") || "Digital"}
                    </TabsTrigger>
                  )}
                  {nonEmptyCategories.map((cat: any) => (
                    <TabsTrigger
                      key={cat.id}
                      value={cat.id}
                      className="rounded-full text-xs px-3"
                    >
                      {cat.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <SearchInput
                placeholder={t("pos.searchCatalog") || "Search catalog..."}
                className="w-64 flex-shrink-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                type="text"
              />
              <div className="flex-1 hidden sm:flex justify-end pr-4">
              </div>

              <div className="flex justify-end md:hidden flex-shrink-0 gap-2">
                <Sheet
                  open={isMobileCartOpen}
                  onOpenChange={setIsMobileCartOpen}
                >
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="relative h-9 w-9"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {cart.length > 0 && (
                        <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                          {cart.reduce((s, c) => s + c.cartQty, 0)}
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-md p-0 flex flex-col z-[100]">
                    <CartPanel
                      cart={cart}
                      subtotal={subtotal}
                      taxTotal={taxTotal}
                      total={total}
                      updateQty={updateQty}
                      setItemQty={setItemQty}
                      setItemPrice={setItemPrice}
                      selectedCartItemId={selectedCartItemId}
                      setSelectedCartItemId={setSelectedCartItemId}
                      leadValue={leadValue}
                      setLeadValue={setLeadValue}
                      fulfillment={fulfillment}
                      setFulfillment={setFulfillment}
                      originLocationId={originLocationId}
                      setOriginLocationId={setOriginLocationId}
                      priceListId={priceListId}
                      handlePriceListChange={handlePriceListChange}
                      promoCode={promoCode}
                      setPromoCode={setPromoCode}
                      priceLists={priceLists}
                      handleCheckout={initiateCheckout}
                      checkoutLoading={checkoutLoading}
                      leads={leadsData?.leads || []}
                      locations={locations}
                      isMobile={true}
                      closeCart={() => setIsMobileCartOpen(false)}
                      activeOrderId={activeOrderId}
                      pendingOrders={pendingOrders}
              handleOrderSelect={handleOrderSelect}
              allowedFulfillments={allowedFulfillments}
              t={t}
            />
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          <PosCatalogGrid
            items={items as CatalogItem[]}
            loading={!currentSite || catalogLoading || (!catalogData && catalogValidating)}
            onAdd={addToCart}
            t={t}
          />

          {/* Right: Cart (Desktop) */}
          <div className="hidden md:flex w-96 flex-col bg-card overflow-hidden min-h-0">
            <CartPanel
              cart={cart}
              subtotal={subtotal}
              taxTotal={taxTotal}
              total={total}
              updateQty={updateQty}
              setItemQty={setItemQty}
              setItemPrice={setItemPrice}
              selectedCartItemId={selectedCartItemId}
              setSelectedCartItemId={setSelectedCartItemId}
              leadValue={leadValue}
              setLeadValue={setLeadValue}
              fulfillment={fulfillment}
              setFulfillment={setFulfillment}
              originLocationId={originLocationId}
              setOriginLocationId={setOriginLocationId}
              priceListId={priceListId}
              handlePriceListChange={handlePriceListChange}
              promoCode={promoCode}
              setPromoCode={setPromoCode}
              priceLists={priceLists}
              handleCheckout={initiateCheckout}
              checkoutLoading={checkoutLoading}
              leads={leadsData?.leads || []}
              locations={locations}
              activeOrderId={activeOrderId}
              pendingOrders={pendingOrders}
              handleOrderSelect={handleOrderSelect}
              allowedFulfillments={allowedFulfillments}
              t={t}
            />
          </div>
        </div>
      </Tabs>

      <PaymentConfirmationDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        totalAmount={total}
        onConfirm={handleCheckout}
        isLoading={checkoutLoading}
        hasCustomer={!!leadValue}
      />

      <PosVariantPickerDialog
        item={variantParentItem}
        open={!!variantParentItem}
        onOpenChange={(o) => !o && setVariantParentItem(null)}
        onConfirm={(childItem) => {
          setVariantParentItem(null);
          addToCart(childItem);
        }}
      />
    </div>
  );
}
