"use client";

import { MobileFiltersDrawer, FilterContainer, FilterSection } from "@/app/components/ui/mobile-filters-drawer"
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSite } from "@/app/context/SiteContext";
import { useLocalization } from "@/app/context/LocalizationContext";
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider";
import { StickyHeader } from "@/app/components/ui/sticky-header";
import { Tabs } from "@/app/components/ui/tabs";
import { Button } from "@/app/components/ui/button";
import { SearchInput } from "@/app/components/ui/search-input";
import { Sheet, SheetContent, SheetTrigger } from "@/app/components/ui/sheet";
import { ShoppingCart } from "@/app/components/ui/icons";
import { PosCategoryTabs } from "./components/PosCategoryTabs";
import { PosPageDialogs } from "./components/PosPageDialogs";
import { CartPanel } from "./components/CartPanel";
import { PosCatalogGrid } from "./components/PosCatalogGrid";
import { PrinterSyncBadge } from "@/app/components/printer/PrinterSyncBadge";
import { PosSyncIssues } from "./components/PosSyncIssues";
import { usePosCatalog } from "./hooks/use-pos-catalog";
import { usePosCart } from "./hooks/use-pos-cart";
import { usePosCheckout } from "./hooks/use-pos-checkout";
import { usePosSyncStatus } from "./hooks/use-pos-sync-status";
import { usePosAddItem } from "./hooks/use-pos-add-item";
import { usePosLead } from "./hooks/use-pos-lead";
import { usePosOrderNotesAutosave } from "./hooks/use-pos-order-notes-autosave";
import { usePosOrderAction } from "./hooks/use-pos-order-action";
import { moveUncategorizedCatalogItemsToEnd } from "./catalog-alphabet";
import { cn } from "@/lib/utils";

export default function POSPage() {
  const { currentSite } = useSite();
  const { t } = useLocalization();
  const { user } = useAuth();
  const router = useRouter();
  const siteId = currentSite?.id;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [syncIssuesOpen, setSyncIssuesOpen] = useState(false);
  const [isSplitBillOpen, setIsSplitBillOpen] = useState(false);
  const [leadGate, setLeadGate] = useState<null | "promo" | "checkout" | "send">(
    null,
  );
  const handleSearchExpandedChange = useCallback((expanded: boolean) => {
    setIsSearchExpanded(expanded);
    if (expanded) setSelectedCategory("all");
  }, []);

  const { status: syncStatus } = usePosSyncStatus(siteId);
  const catalog = usePosCatalog(siteId);
  const cartApi = usePosCart({
    siteId,
    shopSettings: currentSite?.settings?.shop,
    siteTimezone: currentSite?.settings?.business_hours?.[0]?.timezone || null,
    siteCurrency: currentSite?.settings?.currency,
    catalogItems: catalog.catalogItems,
    locations: catalog.locations,
    priceLists: catalog.priceLists,
    priceListItems: catalog.priceListItems,
    promotions: catalog.promotions,
    getTaxesForCart: catalog.getTaxesForCart,
    onRequireLead: () => setLeadGate("promo"),
    t,
  });
  const saveOrderNotes = usePosOrderNotesAutosave(siteId);
  const handleOrderNotesChange = useCallback(
    (notes: string) => {
      cartApi.setOrderNotes(notes);
      saveOrderNotes(cartApi.activeOrderId, notes);
    },
    [cartApi.activeOrderId, cartApi.setOrderNotes, saveOrderNotes],
  );

  const leadApi = usePosLead({
    siteId,
    leads: catalog.leads,
    setLeads: catalog.setLeads,
    reloadLeads: catalog.reload,
    leadValue: cartApi.leadValue,
    setLeadValue: cartApi.setLeadValue,
    setBuyerUserId: cartApi.setBuyerUserId,
    t,
  });

  useEffect(() => {
    if (user?.id && cartApi.sessionReady && !cartApi.sellerUserId) {
      cartApi.setSellerUserId(user.id);
      cartApi.setSellerName(
        user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email ||
          "Current user",
      );
    }
  }, [
    user,
    user?.id,
    cartApi.sessionReady,
    cartApi.sellerUserId,
    cartApi.setSellerName,
    cartApi.setSellerUserId,
  ]);

  useEffect(() => {
    const handleSellerChange = (event: Event) => {
      const detail = (
        event as CustomEvent<{ userId?: string; name?: string }>
      ).detail;
      if (!detail?.userId) return;
      cartApi.setSellerUserId(detail.userId);
      cartApi.setSellerName(detail.name || null);
    };
    window.addEventListener("pos:seller-change", handleSellerChange);
    return () =>
      window.removeEventListener("pos:seller-change", handleSellerChange);
  }, [cartApi.setSellerName, cartApi.setSellerUserId]);

  useEffect(() => {
    if (!cartApi.sellerUserId) return;
    window.dispatchEvent(
      new CustomEvent("pos:seller-state", {
        detail: {
          userId: cartApi.sellerUserId,
          name: cartApi.sellerName || "Current user",
        },
      }),
    );
  }, [cartApi.sellerName, cartApi.sellerUserId]);

  const checkout = usePosCheckout({
    siteId,
    userId: user?.id,
    sellerUserId: cartApi.sellerUserId,
    sellerName: cartApi.sellerName,
    cart: cartApi.cart,
    total: cartApi.total,
    leadValue: cartApi.leadValue,
    leadRelationValue: leadApi.leadRelationValue,
    fulfillment: cartApi.fulfillment,
    originLocationId: cartApi.originLocationId,
    priceListId: cartApi.priceListId,
    promoCode: cartApi.promoCode,
    appliedPromo: cartApi.appliedPromo,
    activeOrderId: cartApi.activeOrderId,
    existingPaymentTotal: cartApi.existingPaymentTotal,
    buyerUserId: cartApi.buyerUserId,
    orderNotes: cartApi.orderNotes,
    shippingAddress: cartApi.shippingAddress,
    subtotal: cartApi.subtotal,
    taxTotal: cartApi.taxTotal,
    currency: cartApi.cartCurrency,
    onCleared: () => {
      void cartApi.resetToNewOrder();
    },
    appliedPromoRequiresLead: cartApi.appliedPromoRequiresLead,
    onRequireLead: (reason) => setLeadGate(reason),
    t,
  });

  usePosOrderAction({
    siteId,
    sessionReady: cartApi.sessionReady,
    catalogHydrated: catalog.hydrated,
    activeOrderId: cartApi.activeOrderId,
    cartLength: cartApi.cart.length,
    loadingOrder: cartApi.loadingOrder,
    handleOrderSelect: cartApi.handleOrderSelect,
    initiateCheckout: checkout.initiateCheckout,
    openSplitDialog: () => setIsSplitBillOpen(true),
  });

  const addApi = usePosAddItem({
    siteId,
    userId: user?.id,
    leadValue: cartApi.leadValue,
    leadRelationValue: leadApi.leadRelationValue,
    addItemToCart: cartApi.addItemToCart,
    router,
    t,
    modifierGroupsByHostId: catalog.modifierGroupsByHostId,
  });

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const source =
      selectedCategory === "unavailable"
        ? catalog.unavailableItems
        : catalog.availableItems;
    let list = source.filter((i) => !i.parent_id);
    if (q) {
      list = list.filter(
        (i) =>
          i.name?.toLowerCase().includes(q) ||
          i.sku?.toLowerCase().includes(q),
      );
    }
    
    if (selectedCategory !== "all" && selectedCategory !== "unavailable") {
      if (selectedCategory === "kind_product") {
        list = list.filter((i) => i.kind === "product");
      } else if (selectedCategory === "kind_service") {
        list = list.filter((i) => i.kind === "service");
      } else if (selectedCategory === "kind_digital_asset") {
        list = list.filter((i) => i.kind === "digital_asset");
      } else {
        list = list.filter((i) => i.category_id === selectedCategory);
      }
    }

    return moveUncategorizedCatalogItemsToEnd(list).map((item) => {
      const children = catalog.catalogItems.filter(
        (child) => 
          child.parent_id === item.id && 
          child.status === "active" && 
          child.is_purchasable !== false
      );
      if (!children.length) return item;

      const variantLabels = children.slice(0, 4).map((child) => {
        const prefix = `${item.name || ""} / `;
        if (child.name?.startsWith(prefix)) return child.name.slice(prefix.length);
        return child.name || "";
      }).filter(Boolean);

      return {
        ...item,
        _shop: {
          ...(item as any)._shop,
          variantLabels,
        }
      };
    });
  }, [catalog.availableItems, catalog.unavailableItems, catalog.catalogItems, searchQuery, selectedCategory]);

  const hasUnavailable = catalog.unavailableItems.some((i) => !i.parent_id);

  useEffect(() => {
    if (selectedCategory === "unavailable" && !hasUnavailable) {
      setSelectedCategory("all");
    }
  }, [selectedCategory, hasUnavailable]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("breadcrumb:update", {
        detail: { title: t("layout.sidebar.pos") || "Point of Sale" },
      }),
    );
  }, [t]);

  useEffect(() => {
    const handleOpenSyncIssues = () => setSyncIssuesOpen(true);
    window.addEventListener("pos:open-sync-issues", handleOpenSyncIssues);
    return () =>
      window.removeEventListener("pos:open-sync-issues", handleOpenSyncIssues);
  }, []);

  useEffect(() => {
    const handler = () => {
      void checkout.handleSendOrder();
    };
    window.addEventListener("pos:send-order", handler);
    return () => window.removeEventListener("pos:send-order", handler);
  }, [checkout.handleSendOrder]);

  const catalogLoading =
    !siteId ||
    (!catalog.hydrated && !catalog.hasLocalData) ||
    (catalog.hydrated &&
      !catalog.hasLocalData &&
      (syncStatus.pulling || !syncStatus.online));

  const emptyOffline =
    catalog.hydrated && !catalog.hasLocalData && !syncStatus.online;

  const cartPanelProps = {
    cart: cartApi.cart,
    subtotal: cartApi.subtotal,
    taxTotal: cartApi.taxTotal,
    shippingTotal: cartApi.shippingTotal,
    total: cartApi.total,
    updateQty: cartApi.updateQty,
    setItemQty: cartApi.setItemQty,
    setItemPrice: cartApi.setItemPrice,
    setItemDiscount: cartApi.setItemDiscount,
    selectedCartItemId: cartApi.selectedCartItemId,
    setSelectedCartItemId: cartApi.setSelectedCartItemId,
    leadValue: cartApi.leadValue as any,
    setLeadValue: leadApi.handleLeadValueChange,
    fulfillment: cartApi.fulfillment,
    setFulfillment: cartApi.setFulfillment,
    originLocationId: cartApi.originLocationId,
    setOriginLocationId: cartApi.setOriginLocationId,
    priceListId: cartApi.priceListId,
    handlePriceListChange: cartApi.handlePriceListChange,
    promoCode: cartApi.promoCode,
    setPromoCode: cartApi.setPromoCode,
    appliedPromo: cartApi.appliedPromo,
    promoDiscount: cartApi.promoDiscount,
    validatePromotion: cartApi.validatePromotion,
    clearAppliedPromo: cartApi.clearAppliedPromo,
    priceLists: catalog.priceLists,
    handleCheckout: checkout.initiateCheckout,
    checkoutLoading: checkout.checkoutLoading || cartApi.loadingOrder,
    leads: catalog.leads,
    locations: catalog.locations,
    activeOrderId: cartApi.activeOrderId,
    pendingOrders: catalog.pendingOrders,
    handleOrderSelect: cartApi.handleOrderSelect,
    allowedFulfillments: cartApi.allowedFulfillments,
    orderNotes: cartApi.orderNotes,
    setOrderNotes: handleOrderNotesChange,
    shippingAddress: cartApi.shippingAddress,
    setShippingAddress: cartApi.setShippingAddress,
    siteId,
    onLeadUpdated: leadApi.handleLeadUpdated,
    onSplitBill: () => setIsSplitBillOpen(true),
    siteCurrency: cartApi.cartCurrency,
    t,
  };

  return (
    <div className="flex flex-col md:flex-row md:items-start min-h-[calc(100dvh-var(--topbar-height,64px))] bg-muted/30">
      <Tabs
        value={selectedCategory}
        onValueChange={setSelectedCategory}
        className="flex-1 min-w-0 flex flex-col"
      >
        <StickyHeader>
          <div className="w-full pt-0">
            <div
              className={cn(
                "flex w-full items-center gap-2 transition-[gap] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:gap-4 motion-reduce:transition-none",
                isSearchExpanded && "md:gap-0",
              )}
            >
              <MobileFiltersDrawer triggerText={t('common.search') || "Search"}>
                <FilterContainer
                  className={cn(
                    "md:transition-[gap] md:duration-300 md:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                    isSearchExpanded && "md:gap-0",
                  )}
                >
                  <FilterSection mobileOnly>
                    <SearchInput  placeholder={t("pos.searchCatalog") || "Search catalog..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="text" alwaysExpanded={true}    className="w-full h-10 md:h-9"  containerClassName="w-full" />
                  </FilterSection>

                  

                  <FilterSection
                    title={t('catalog.kind.label') === 'catalog.kind.label' ? 'Category' : t('catalog.kind.label')}
                    className={cn(
                      "min-w-0 overflow-hidden md:transition-[flex-grow,flex-basis,opacity,transform] md:duration-300 md:ease-[cubic-bezier(0.22,1,0.36,1)] md:will-change-[flex-grow,opacity,transform] motion-reduce:transition-none",
                      isSearchExpanded
                        ? "md:flex-[0_1_0%] md:-translate-x-2 md:opacity-0 md:pointer-events-none"
                        : "md:flex-[1_1_0%] md:translate-x-0 md:opacity-100",
                      searchQuery && "max-md:hidden",
                    )}
                  >
                    <PosCategoryTabs
                      activeCategory={selectedCategory}
                      availableItems={catalog.availableItems}
                      categories={catalog.categories}
                      onCategoryChange={setSelectedCategory}
                      t={t}
                      unavailableItems={catalog.unavailableItems}
                    />
                  </FilterSection>

                  <FilterSection
                    desktopOnly
                    className={cn(
                      "min-w-0 md:transition-[flex-grow,flex-basis] md:duration-300 md:ease-[cubic-bezier(0.22,1,0.36,1)] md:will-change-[flex-grow] motion-reduce:transition-none",
                      isSearchExpanded
                        ? "md:flex-[1_1_0%]"
                        : "md:flex-[0_0_2.25rem]",
                    )}
                  >
                    <SearchInput
                      placeholder={t("pos.searchCatalog") || "Search catalog..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onExpandedChange={handleSearchExpandedChange}
                      type="text"
                      className="w-full"
                      containerClassName="w-full"
                    />
                  </FilterSection>
                </FilterContainer>
              </MobileFiltersDrawer>

              <div
                aria-hidden={isSearchExpanded}
                inert={isSearchExpanded}
                className={cn(
                  "flex max-w-56 shrink-0 items-center justify-end overflow-hidden pr-1 opacity-100 transition-[max-width,opacity,transform,padding] duration-200 ease-out motion-reduce:transition-none",
                  isSearchExpanded &&
                    "max-w-0 translate-x-2 p-0 opacity-0 pointer-events-none",
                )}
              >
                  <PrinterSyncBadge module="pos" />
              </div>

              <div className="ml-auto flex flex-shrink-0 justify-end md:hidden">
                <Sheet
                  open={isMobileCartOpen}
                  onOpenChange={setIsMobileCartOpen}
                >
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
                    <CartPanel
                      {...cartPanelProps}
                      isMobile
                      closeCart={() => setIsMobileCartOpen(false)} />
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </StickyHeader>

        {emptyOffline ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center text-sm text-muted-foreground min-h-[50vh]">
            {t("pos.sync.emptyOffline") ||
              "Connect once to download the catalog for offline use."}
          </div>
        ) : (
          <PosCatalogGrid
            items={filteredItems}
            loading={catalogLoading}
            onAdd={addApi.addToCart}
            t={t} />
        )}
      </Tabs>

      <div className="hidden md:flex w-96 flex-none flex-col bg-card border-l sticky top-[var(--topbar-height,64px)] h-[calc(100dvh-var(--topbar-height,64px))] overflow-hidden">
        <CartPanel {...cartPanelProps} />
      </div>

      <PosSyncIssues
        siteId={siteId}
        open={syncIssuesOpen}
        onOpenChange={setSyncIssuesOpen}
        t={t} />

      <PosPageDialogs
        siteId={siteId}
        cartApi={cartApi}
        catalog={catalog}
        checkout={checkout}
        addApi={addApi}
        leadApi={leadApi}
        leadGate={leadGate}
        setLeadGate={setLeadGate}
        isSplitBillOpen={isSplitBillOpen}
        setIsSplitBillOpen={setIsSplitBillOpen}
        t={t}
      />
    </div>
  );
}
