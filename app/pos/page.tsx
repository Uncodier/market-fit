"use client";

import { MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSite } from "@/app/context/SiteContext";
import { useLocalization } from "@/app/context/LocalizationContext";
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider";
import { StickyHeader } from "@/app/components/ui/sticky-header";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Button } from "@/app/components/ui/button";
import { SearchInput } from "@/app/components/ui/search-input";
import { Sheet, SheetContent, SheetTrigger } from "@/app/components/ui/sheet";
import { ShoppingCart } from "@/app/components/ui/icons";
import { DynamicQuoteFieldsModal } from "@/app/components/commerce/DynamicQuoteFieldsModal";
import dynamic from "next/dynamic";
import { PosOptionsDialog } from "./components/PosOptionsDialog";

const PaymentConfirmationDialog = dynamic(
  () => import("./components/PaymentConfirmationDialog").then((m) => m.PaymentConfirmationDialog),
  { ssr: false }
);
const PosReservationDialog = dynamic(
  () => import("./components/PosReservationDialog").then((m) => m.PosReservationDialog),
  { ssr: false }
);
const PosDigitalAssetDialog = dynamic(
  () => import("./components/PosDigitalAssetDialog").then((m) => m.PosDigitalAssetDialog),
  { ssr: false }
);
const PosSplitBillDialog = dynamic(
  () => import("./components/PosSplitBillDialog").then((m) => m.PosSplitBillDialog),
  { ssr: false }
);
import { CartPanel } from "./components/CartPanel";
import { resolveUnitPriceLocal } from "./local/resolve-unit-price-local";
import { PosCatalogGrid } from "./components/PosCatalogGrid";
import { PosSyncBadge } from "./components/PosSyncBadge";
import { PrinterSyncBadge } from "@/app/components/printer/PrinterSyncBadge";
import { PosSyncIssues } from "./components/PosSyncIssues";
import { usePosCatalog } from "./hooks/use-pos-catalog";
import { usePosCart } from "./hooks/use-pos-cart";
import { usePosCheckout } from "./hooks/use-pos-checkout";
import { usePosSyncStatus } from "./hooks/use-pos-sync-status";
import { usePosAddItem } from "./hooks/use-pos-add-item";
import { usePosLead } from "./hooks/use-pos-lead";
import { drainPosOutbox } from "./local/sync-engine";
import { PosRequireLeadDialog } from "./components/PosRequireLeadDialog";
import { cartHasReservationSlot } from "./cart-line-utils";
import {
  buyerUserFromLeads,
  commitPosDigitalBuyer,
} from "./assign-digital-buyer";

export default function POSPage() {
  const { currentSite } = useSite();
  const { t } = useLocalization();
  const { user } = useAuth();
  const router = useRouter();
  const siteId = currentSite?.id;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [syncIssuesOpen, setSyncIssuesOpen] = useState(false);
  const [isSplitBillOpen, setIsSplitBillOpen] = useState(false);
  const [leadGate, setLeadGate] = useState<null | "promo" | "checkout" | "send">(
    null,
  );

  const { status: syncStatus, retrySync } = usePosSyncStatus(siteId);
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

  const checkout = usePosCheckout({
    siteId,
    userId: user?.id,
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

    return list.map((item) => {
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

  const hasProducts = catalog.availableItems.some((i) => i.kind === "product" && !i.parent_id);
  const hasServices = catalog.availableItems.some((i) => i.kind === "service" && !i.parent_id);
  const hasDigital = catalog.availableItems.some(
    (i) => i.kind === "digital_asset" && !i.parent_id,
  );
  const hasUnavailable = catalog.unavailableItems.some((i) => !i.parent_id);
  const nonEmptyCategories = catalog.categories.filter((cat: any) =>
    catalog.availableItems.some((i) => i.category_id === cat.id && !i.parent_id),
  );

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
    setOrderNotes: cartApi.setOrderNotes,
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
            <div className="flex items-center gap-2 sm:gap-4 w-full">
              <MobileFiltersDrawer triggerText={t('common.search') || "Buscar"}>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-4 w-full flex-1 min-w-0">
                  <div className="md:hidden w-full">
                    <SearchInput  placeholder={t("pos.searchCatalog") || "Search catalog..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="text" alwaysExpanded={true}    className="w-full h-10 md:h-9"  containerClassName="w-full" />
                  </div>

                  <div className="flex flex-col gap-2 w-full md:w-auto">
                    <span className="text-xs font-semibold text-muted-foreground md:hidden mb-1 uppercase">{t('catalog.kind.label') === 'catalog.kind.label' ? 'Categoría' : t('catalog.kind.label')}</span>
                    <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-lg md:rounded-full flex flex-col md:flex-row w-full md:max-w-full overflow-y-auto md:overflow-x-auto justify-start items-stretch md:items-center gap-1 md:gap-0">
                      <TabsTrigger value="all" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-normal md:whitespace-nowrap">
                        {t("pos.filters.all") || "All"}
                      </TabsTrigger>
                      {hasProducts && (
                        <TabsTrigger
                          value="kind_product"
                          className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-normal md:whitespace-nowrap"
                        >
                          {t("pos.filters.products") || "Products"}
                        </TabsTrigger>
                      )}
                      {hasServices && (
                        <TabsTrigger
                          value="kind_service"
                          className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-normal md:whitespace-nowrap"
                        >
                          {t("pos.filters.services") || "Services"}
                        </TabsTrigger>
                      )}
                      {hasDigital && (
                        <TabsTrigger
                          value="kind_digital_asset"
                          className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-normal md:whitespace-nowrap"
                        >
                          {t("pos.filters.digitalAssets") || "Digital"}
                        </TabsTrigger>
                      )}
                      {nonEmptyCategories.map((cat: any) => (
                        <TabsTrigger
                          key={cat.id}
                          value={cat.id}
                          className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-normal md:whitespace-nowrap"
                        >
                          {cat.name}
                        </TabsTrigger>
                      ))}
                      {hasUnavailable && (
                        <TabsTrigger
                          value="unavailable"
                          className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-normal md:whitespace-nowrap"
                        >
                          {t("pos.filters.unavailable") || "Unavailable"}
                        </TabsTrigger>
                      )}
                    </TabsList>
                  </div>

                  <div className="hidden md:flex items-center gap-2 w-full md:w-auto">
                    <SearchInput  placeholder={t("pos.searchCatalog") || "Search catalog..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="text"    className="w-full"  containerClassName="w-64" />
                  </div>
                </div>
              </MobileFiltersDrawer>

              <div className="flex-1 flex justify-end items-center gap-2 pr-1 shrink-0">
                <PrinterSyncBadge module="pos" />
                <PosSyncBadge
                  status={syncStatus}
                  onClick={() => setSyncIssuesOpen(true)}
                  t={t} />
              </div>

              <div className="flex justify-end md:hidden flex-shrink-0">
                <Sheet
                  open={isMobileCartOpen}
                  onOpenChange={setIsMobileCartOpen}
                >
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative h-9 w-9 rounded-full"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {cartApi.cart.length > 0 && (
                        <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                          {cartApi.cart.reduce((s, c) => s + c.cartQty, 0)}
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-md p-0 flex flex-col z-[100]">
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

      <PaymentConfirmationDialog
        open={checkout.isPaymentDialogOpen}
        onOpenChange={checkout.setIsPaymentDialogOpen}
        totalAmount={cartApi.total}
        currency={cartApi.cartCurrency}
        onConfirm={checkout.handleCheckout}
        isLoading={checkout.checkoutLoading}
        hasCustomer={!!cartApi.leadValue} />

      <PosOptionsDialog
        item={addApi.optionsParentItem}
        open={!!addApi.optionsParentItem}
        onOpenChange={(o) => {
          if (!o) addApi.setOptionsParentItem(null);
        }}
        onConfirm={({ item, modifiers }) => {
          addApi.confirmOptions(item, modifiers);
        }}
        siteId={siteId}
        modifierGroupsByHostId={catalog.modifierGroupsByHostId}
        resolvePrice={(catalogItemId, fallbackPrice) => {
          const catalogItem = catalog.catalogItems.find(
            (c: any) => c.id === catalogItemId,
          );
          return resolveUnitPriceLocal({
            catalogItemId,
            targetSalePrice:
              catalogItem?.target_sale_price ?? fallbackPrice,
            priceListId:
              cartApi.priceListId === "none"
                ? undefined
                : cartApi.priceListId,
            priceLists: catalog.priceLists,
            priceListItems: catalog.priceListItems,
          }).price;
        }} />

      <PosReservationDialog
        item={addApi.reservationItem}
        open={!!addApi.reservationItem}
        onOpenChange={(o) => {
          if (!o) addApi.setReservationItem(null);
        }}
        leads={catalog.leads}
        siteId={siteId}
        initialLeadValue={leadApi.leadRelationValue}
        onLeadUpdated={leadApi.handleLeadUpdated}
        t={t}
        onConfirm={async ({
          item,
          reservationStart,
          reservationEnd,
          reservationAvailableQty,
          leadValue,
        }) => {
          await leadApi.handleLeadValueChange(leadValue);
          addApi.confirmReservation(item, {
            reservationStart,
            reservationEnd,
            reservationAvailableQty,
          });
        }} />

      <PosDigitalAssetDialog
        item={addApi.digitalItem}
        open={!!addApi.digitalItem}
        modifiers={addApi.digitalModifiers}
        initialBuyerUser={buyerUserFromLeads(
          cartApi.buyerUserId,
          catalog.leads,
        )}
        onOpenChange={(o) => {
          if (!o) addApi.setDigitalItem(null);
        }}
        t={t}
        onConfirm={async ({ item, buyerUser, modifiers }) => {
          if (!siteId) return;
          await commitPosDigitalBuyer({
            siteId,
            buyerUser,
            handleLeadValueChange: leadApi.handleLeadValueChange,
            setBuyerUserId: cartApi.setBuyerUserId,
            setLeads: catalog.setLeads,
          });
          addApi.confirmDigital(item, modifiers);
        }} />

      <DynamicQuoteFieldsModal
        item={addApi.dynamicQuoteItem}
        open={!!addApi.dynamicQuoteItem}
        onOpenChange={(o) => !o && addApi.setDynamicQuoteItem(null)}
        confirming={addApi.dynamicQuoteLoading}
        onConfirm={async ({ fieldValues, quantity }) => {
          if (!addApi.dynamicQuoteItem) return;
          await addApi.requestQuote(
            addApi.dynamicQuoteItem,
            fieldValues,
            quantity,
          );
        }} />

      <PosRequireLeadDialog
        open={!!leadGate}
        onOpenChange={(open) => {
          if (!open) setLeadGate(null);
        }}
        leads={catalog.leads}
        siteId={siteId}
        t={t}
        purpose={
          leadGate === "promo" || !cartHasReservationSlot(cartApi.cart)
            ? "promo"
            : "reservation"
        }
        oncePerUser={
          Number(
            cartApi.appliedPromo?.usageLimitPerUser ??
              catalog.promotions.find(
                (p: any) =>
                  String(p.code || "").trim().toUpperCase() ===
                  cartApi.promoCode.trim().toUpperCase(),
              )?.usage_limit_per_user,
          ) === 1
        }
        onLeadUpdated={leadApi.handleLeadUpdated}
        onConfirm={async (value) => {
          const action = leadGate;
          const committed = await leadApi.handleLeadValueChange(value);
          setLeadGate(null);
          if (action === "promo") {
            cartApi.validatePromotion({ leadPresent: true });
            return;
          }
          if (action === "checkout") {
            checkout.initiateCheckout({ customerConfirmed: true });
            return;
          }
          if (action === "send" && committed) {
            await checkout.handleSendOrder({
              customerConfirmed: true,
              leadOverride: committed,
            });
          }
        }} />
      <PosSplitBillDialog
        open={isSplitBillOpen}
        onOpenChange={setIsSplitBillOpen}
        originalCart={cartApi.cart}
        onConfirm={(columns) => {
          if (columns.length === 0) return;
          cartApi.setCart(columns[0].items);
          if (columns[0].title !== "Order 1") {
            cartApi.setOrderNotes(columns[0].title);
          }
          const otherColumns = columns.slice(1);
          if (otherColumns.length > 0) {
            checkout.createPendingSplitOrders(otherColumns);
          }
        }} />
    </div>
  );
}
