"use client"

import { useState, useEffect, useDeferredValue, useCallback, useMemo, useRef } from "react"
import { CatalogItem } from "@/app/types"
import { clearCart } from "@/app/commerce/cart-storage"
import { cartLineExtendedTotal } from "@/app/commerce/cart-modifiers"
import { getDeviceOrders } from "@/app/commerce/device-order-storage"
import { useGuestCheckoutPrefill } from "@/app/commerce/use-guest-checkout-prefill"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { useLocalization } from "@/app/context/LocalizationContext"
import dynamic from "next/dynamic"

const CommerceOrderSuccess = dynamic(() => import("@/app/components/commerce/CommerceOrderSuccess").then(m => m.CommerceOrderSuccess))
const BuyerLocationSheetHost = dynamic(() => import("@/app/components/commerce/BuyerLocationControls").then(m => m.BuyerLocationSheetHost))

import { ShopHeroTrust } from "./ShopHeroTrust"
import { ShopCatalogMain } from "./ShopCatalogMain"
import { ShopHeader } from "./ShopHeader"
import { ShopFulfillmentHeader } from "./ShopFulfillmentHeader"
import { ShopMobileCartCta, ShopSiteFooter } from "./ShopSiteFooter"
import { runShopCheckout } from "./run-shop-checkout"
import { useParams } from "next/navigation"

import type { ShopOwnedAccess } from "./actions"
import type { ShopCategoryOffset } from "./shop-catalog-shared"
import { useShopCatalog } from "./useShopCatalog"
import { useShopCart } from "./useShopCart"
import { useShopOwnedItems } from "./useShopOwnedItems"
import type {
  PromoBadge,
  StorefrontPromoCard,
} from "@/app/promotions/promotion-merchandising"
import { isBusinessOpen, getNextOpenSlot } from "@/app/commerce/business-hours"
import { formatDeliveryTime } from "@/app/commerce/delivery-time"
import { BuyerGeo } from "@/app/commerce/buyer-geo"
import {
  defaultFulfillment,
  isItemCompatibleWithFulfillment,
  type CheckoutFulfillmentMethod,
} from "@/app/commerce/delivery-options"
import {
  isBuyerLocationIncompatible,
  isItemLocationAvailable,
  isBuyerParticularlyClose,
  pickPreferredPickupLocation,
} from "@/app/commerce/buyer-location-availability"
import { useBuyerLocation } from "@/app/components/commerce/use-buyer-location"
import { buyerLocationLeadingChip } from "@/app/components/commerce/BuyerLocationControls"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { useSiteTracking } from "@/app/hooks/useSiteTracking"
import { useShopFulfillmentPreference } from "@/app/commerce/use-shop-fulfillment-preference"

export default function ShopClient({ 
  site, 
  initialCatalog,
  initialCategories,
  initialCategoryOffsets = [],
  initialCount,
  locations, 
  ownedItemIds = [],
  ownedItemsData = [],
  buyerGeo,
  generalPromos = [],
  promoBadgesByItemId = {},
  categoryPromosByName = {},
}: { 
  site: any, 
  initialCatalog: CatalogItem[], 
  initialCategories: string[],
  initialCategoryOffsets?: ShopCategoryOffset[],
  initialCount: number,
  locations: any[], 
  ownedItemIds?: ShopOwnedAccess[],
  ownedItemsData?: CatalogItem[],
  buyerGeo?: BuyerGeo,
  generalPromos?: StorefrontPromoCard[],
  promoBadgesByItemId?: Record<string, PromoBadge>,
  categoryPromosByName?: Record<string, StorefrontPromoCard[]>,
}) {
  const { t, locale } = useLocalization()
  const { user, isLoading: authLoading } = useAuth()
  const params = useParams()
  const siteSlug = params?.siteSlug || site?.slug || 'unknown'
  const { ownedAccessMap, ownedItemsData: ownedItemsDataState } = useShopOwnedItems(
    site.id, user, ownedItemIds, ownedItemsData
  )
  const shopAllowedOptions = useMemo<CheckoutFulfillmentMethod[]>(() => {
    const raw = site?.settings?.shop?.default_delivery_options
    if (Array.isArray(raw) && raw.length > 0) {
      return raw as CheckoutFulfillmentMethod[]
    }
    return ["pickup", "ship", "dine_in"]
  }, [site?.settings?.shop?.default_delivery_options])

  const [fulfillment, setFulfillment] = useState<CheckoutFulfillmentMethod>(() => {
    const nearby = isBuyerParticularlyClose({
      buyerGeo,
      inventoryLocations: locations,
      settingsLocations: site?.settings?.locations,
    })
    const raw = site?.settings?.shop?.default_delivery_options
    const options = (Array.isArray(raw) && raw.length > 0
      ? raw
      : ["pickup", "ship", "dine_in"]) as CheckoutFulfillmentMethod[]
    return defaultFulfillment(options, { preferPickup: nearby }) || "none"
  })
  const [originLocationId, setOriginLocationId] = useState<string>(
    () => pickPreferredPickupLocation(locations || [], buyerGeo)?.id || locations?.[0]?.id || ''
  )
  const [shippingAddress, setShippingAddress] = useState({
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
    country: ""
  })

  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [orderNotes, setOrderNotes] = useState("")
  
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const searchPlaceholder = t("shop.searchPlaceholder") || "Search products..."
  const {
    catalogItems,
    categoryOffsets,
    totalCount,
    isLoading,
    isLoadingMore,
    isJumping,
    hasMoreBelow,
    loadMoreBelow,
    jumpToCategory,
    pendingScrollCategory,
    clearPendingScrollCategory,
  } = useShopCatalog(
    site.id,
    initialCatalog,
    initialCount,
    deferredSearchQuery,
    initialCategoryOffsets
  )

  const [orderTiming, setOrderTiming] = useState<'now' | 'scheduled'>('now')
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null)
  const { userChoseFulfillmentRef, setFulfillmentByUser, isPreferenceLoaded } = useShopFulfillmentPreference({
    siteId: site.id,
    setFulfillment,
  })
  const userChosePaymentRef = useRef(false)

  const { trackPageview, trackEvent } = useSiteTracking(site?.id)

  // Track pageview on mount
  useEffect(() => {
    trackPageview()
  }, [trackPageview])

  // Compute business availability
  const businessHours = site?.settings?.business_hours || []
  const isOpen = businessHours.length > 0 ? isBusinessOpen(businessHours) : true
  const nextOpenSlot = !isOpen ? getNextOpenSlot(businessHours, new Date(), locale) : null
  
  const { setStoreCurrency } = useDisplayCurrency()

  useEffect(() => {
    setStoreCurrency(site?.settings?.currency ?? null)
  }, [site?.settings?.currency, setStoreCurrency])

  const buyerLocation = useBuyerLocation({
    scope: `shop:${site?.id || siteSlug}`,
    initialGeo: buyerGeo,
    inventoryLocations: locations || [],
    settingsLocations: site?.settings?.locations || null,
    setLocationFallback: t("shop.location.setLocation") || "Set location",
  })

  const locationAvailable = (() => {
    // Selected branch = available for pickup/browse at that store
    if (buyerLocation.selectedLocationId) return true
    if (
      !isBuyerLocationIncompatible({
        settingsLocations: site?.settings?.locations || null,
        inventoryLocations: locations || [],
        buyerGeo:
          fulfillment === "ship" && shippingAddress.city
            ? {
                city: shippingAddress.city,
                state: shippingAddress.state,
                zip: shippingAddress.zip,
                country: shippingAddress.country,
              }
            : buyerLocation.effectiveBuyerGeo,
        selectedLocationId: null,
      })
    ) {
      return true
    }
    return false
  })()

  const getLocationAvailable = useCallback((item: CatalogItem) =>
    isItemLocationAvailable({
      item,
      settingsLocations: site?.settings?.locations || null,
      inventoryLocations: locations || [],
      buyerGeo: buyerLocation.effectiveBuyerGeo,
      selectedLocationId: buyerLocation.selectedLocationId,
    }), [site?.settings?.locations, locations, buyerLocation.effectiveBuyerGeo, buyerLocation.selectedLocationId])

  const locationChipRestricted = isBuyerLocationIncompatible({
    settingsLocations: site?.settings?.locations || null,
    inventoryLocations: locations || [],
    buyerGeo: buyerLocation.effectiveBuyerGeo,
    selectedLocationId: buyerLocation.selectedLocationId,
  })

  // Chip store selection drives checkout pickup origin
  useEffect(() => {
    if (buyerLocation.selectedLocationId) {
      setOriginLocationId(buyerLocation.selectedLocationId)
    }
  }, [buyerLocation.selectedLocationId])

  const deliveryTimeLabel = formatDeliveryTime(site?.settings?.shop);

  useEffect(() => {
    if (selectedCategory && selectedCategory !== "all") {
      document.title = `${selectedCategory} | ${site?.name || "Shop"}`
    } else {
      document.title = `${site?.name || "Shop"} | Shop`
    }
  }, [selectedCategory, site?.name])

  const categories = initialCategories || [];

  const sellableCatalogItems = useMemo(() => {
    return catalogItems.filter((item) => isItemCompatibleWithFulfillment(item, fulfillment));
  }, [catalogItems, fulfillment]);

  const ownedItems = useMemo(() => {
    return ownedItemsDataState.filter((item) => 
      isItemCompatibleWithFulfillment(item, fulfillment) && 
      ownedAccessMap.get(item.id)
    );
  }, [ownedItemsDataState, fulfillment, ownedAccessMap]);

  const [promotionCode, setPromotionCode] = useState("")
  const [promotionId, setPromotionId] = useState<string | null>(null)
  const { cart, setCart, isCartOpen, setIsCartOpen, deviceOrders, setDeviceOrders, addToCart, updateQty } = useShopCart({
    siteId: site.id,
    siteSlug: String(siteSlug),
    currency: site?.settings?.currency || "USD",
    ownedAccessMap,
    orderSuccess,
    trackEvent,
    setPromotionCode,
    setPromotionId,
  })
  const [promoDiscount, setPromoDiscount] = useState(0)
  const [ownerSiteId, setOwnerSiteId] = useState<string | null>(null)
  const session = user ? { user } : null
  const searchLabel = t("common.search") || "Search"

  useGuestCheckoutPrefill({
    session,
    isLoading: authLoading,
    siteId: site.id,
    setCustomerName,
    setCustomerEmail,
    setShippingAddress,
  })

  const subtotal = cart.reduce((sum, item) => sum + cartLineExtendedTotal(item), 0)
  const payableTotal = Math.max(0, subtotal - promoDiscount)
  const cartCount = cart.reduce((s, c) => s + c.cartQty, 0)

  const handleCheckout = (e: React.FormEvent) =>
    runShopCheckout({
      e,
      cart,
      siteId: site.id,
      siteSlug,
      session,
      customerName,
      customerEmail,
      fulfillment,
      originLocationId,
      shippingAddress,
      paymentMethod,
      orderTiming,
      scheduledFor,
      orderNotes,
      isOpen,
      nextOpenSlot,
      payableTotal,
      promotionCode,
      promotionId,
      ownerSiteId,
      locationAvailable,
      t,
      setCheckoutLoading,
      onSuccess: () => {
        setCart([])
        clearCart("cart", "shop", site.id)
        setDeviceOrders(getDeviceOrders(site.id))
        setIsCartOpen(false)
        setOrderSuccess(false)
        const url = new URL(window.location.href)
        url.searchParams.delete("cart")
        url.hash = "your-orders"
        window.history.replaceState({}, "", url.toString())
        requestAnimationFrame(() => {
          document.getElementById("your-orders")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        })
        window.setTimeout(() => {
          document.getElementById("your-orders")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        }, 250)
      },
    })

  if (orderSuccess) {
    return (
      <CommerceOrderSuccess
        className="bg-gray-50 dark:bg-gray-950"
        title={t('shop.success.title') || 'Order Confirmed'}
        description={t('shop.success.desc') || "Thank you for your purchase. We've sent a confirmation email with your order details."}
        continueLabel={t('shop.success.continueShopping') || 'Continue Shopping'}
        paymentMethod={paymentMethod}
        bankTransfer={site?.settings?.shop?.bank_transfer}
        onContinue={() => {
          setOrderSuccess(false)
          setPaymentMethod('')
        }}
      />
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <ShopHeader
        site={site}
        siteSlug={String(siteSlug)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder={searchPlaceholder}
        searchLabel={searchLabel}
        mobileSearchOpen={mobileSearchOpen}
        setMobileSearchOpen={setMobileSearchOpen}
        session={session}
        signInLabel={t("shop.signIn") || "Sign In"}
        cart={cart}
        cartCount={cartCount}
        subtotal={subtotal}
        isCartOpen={isCartOpen}
        setIsCartOpen={setIsCartOpen}
        updateQty={updateQty}
        customerName={customerName}
        setCustomerName={setCustomerName}
        customerEmail={customerEmail}
        setCustomerEmail={setCustomerEmail}
        fulfillment={fulfillment}
        setFulfillment={setFulfillment}
        originLocationId={originLocationId}
        setOriginLocationId={setOriginLocationId}
        locations={locations}
        promotionCode={promotionCode}
        setPromotionCode={setPromotionCode}
        promoDiscount={promoDiscount}
        setPromoDiscount={setPromoDiscount}
        shippingAddress={shippingAddress}
        setShippingAddress={setShippingAddress}
        ownerSiteId={ownerSiteId}
        setOwnerSiteId={setOwnerSiteId}
        handleCheckout={handleCheckout}
        checkoutLoading={checkoutLoading}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        orderTiming={orderTiming}
        setOrderTiming={setOrderTiming}
        scheduledFor={scheduledFor}
        setScheduledFor={setScheduledFor}
        orderNotes={orderNotes}
        setOrderNotes={setOrderNotes}
        isOpen={isOpen}
        nextOpenSlot={nextOpenSlot}
        locationAvailable={locationAvailable}
        deliveryTimeLabel={deliveryTimeLabel}
        buyerGeo={buyerLocation.effectiveBuyerGeo}
        selectedLocationId={buyerLocation.selectedLocationId}
        userChoseFulfillmentRef={userChoseFulfillmentRef}
        isFulfillmentPreferenceLoaded={isPreferenceLoaded}
        userChosePaymentRef={userChosePaymentRef}
      />

      <ShopHeroTrust
        site={site}
        searchQuery={deferredSearchQuery}
        isOpen={isOpen}
        nextOpenSlot={nextOpenSlot}
        locationAvailable={locationAvailable}
        deliveryTimeLabel={deliveryTimeLabel}
        fulfillment={
          site?.settings?.shop?.hero_order_bar === true
            ? (tone, centerAction) => (
                <ShopFulfillmentHeader
                  allowedOptions={shopAllowedOptions}
                  fulfillment={fulfillment}
                  setFulfillment={setFulfillmentByUser}
                  orderTiming={orderTiming}
                  setOrderTiming={setOrderTiming}
                  scheduledFor={scheduledFor}
                  setScheduledFor={setScheduledFor}
                  tone={tone}
                  centerAction={centerAction}
                />
              )
            : undefined
        }
        scheduledFor={scheduledFor}
        setScheduledFor={setScheduledFor}
        setOrderTiming={setOrderTiming}
        onUnavailableClick={() => buyerLocation.setSheetOpen(true)}
      />

      <ShopCatalogMain
        siteSlug={siteSlug}
        categories={categories}
        categoryOffsets={categoryOffsets}
        searchQuery={deferredSearchQuery}
        ownedItems={ownedItems}
        ownedAccessMap={ownedAccessMap}
        deviceOrders={deviceOrders}
        siteId={site.id}
        onDeviceOrdersHydrated={setDeviceOrders}
        sellableCatalogItems={sellableCatalogItems}
        rawCatalogItems={catalogItems}
        initialCount={totalCount}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        isJumping={isJumping}
        hasMoreBelow={hasMoreBelow}
        loadMoreBelow={loadMoreBelow}
        jumpToCategory={jumpToCategory}
        pendingScrollCategory={pendingScrollCategory}
        clearPendingScrollCategory={clearPendingScrollCategory}
        addToCart={addToCart}
        getLocationAvailable={getLocationAvailable}
        leadingChip={buyerLocationLeadingChip(
          buyerLocation,
          undefined,
          locationChipRestricted
        )}
        onActiveCategoryChange={setSelectedCategory}
        generalPromos={generalPromos}
        promoBadgesByItemId={promoBadgesByItemId}
        categoryPromosByName={categoryPromosByName}
      />

      <BuyerLocationSheetHost location={buyerLocation} stores={locations || []} />

      <ShopSiteFooter siteName={site.name} />

      {cart.length > 0 && !isCartOpen && (
        <ShopMobileCartCta
          cartCount={cartCount}
          subtotal={subtotal}
          currency={cart[0]?.currency}
          onOpen={() => setIsCartOpen(true)}
        />
      )}
    </div>
  )
}

