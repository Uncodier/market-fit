"use client"

import { useState, useEffect, useDeferredValue, useCallback, useMemo, useRef } from "react"
import { CatalogItem } from "@/app/types"
import { clearCart, getCartItems, setCartItems } from "@/app/commerce/cart-storage"
import { cartLineExtendedTotal, cartLineKey } from "@/app/commerce/cart-modifiers"
import { getDeviceOrders } from "@/app/commerce/device-order-storage"
import type { DeviceOrder } from "@/app/commerce/device-order-storage"
import { useGuestCheckoutPrefill } from "@/app/commerce/use-guest-checkout-prefill"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { toast } from "sonner"
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
import { useParams, useRouter } from "next/navigation"

import { getShopItemsByIds, getShopUserOwnedItems, type ShopOwnedAccess } from "./actions"
import type { ShopCategoryOffset } from "./shop-catalog-shared"
import { useShopCatalog } from "./useShopCatalog"
import type {
  PromoBadge,
  StorefrontPromoCard,
} from "@/app/promotions/promotion-merchandising"
import { readPendingStorefrontPromo } from "@/app/components/commerce/PromoBundleExperience"
import { isAccessOnlyItem, requiresVariantSelection } from "@/app/catalog/product-details"
import { isBusinessOpen, getNextOpenSlot } from "@/app/commerce/business-hours"
import { formatDeliveryTime } from "@/app/commerce/delivery-time"
import { BuyerGeo } from "@/app/commerce/buyer-geo"
import {
  defaultFulfillment,
  getItemDeliveryOptions,
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

interface CartItem extends CatalogItem {
  cartQty: number;
  cartPrice: number;
  reservationStart?: string;
  reservationEnd?: string;
}

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
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartLoaded, setIsCartLoaded] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [ownedItemIdsState, setOwnedItemIdsState] = useState<ShopOwnedAccess[]>(ownedItemIds)
  const [ownedItemsDataState, setOwnedItemsDataState] = useState<CatalogItem[]>(ownedItemsData)
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
  const [deviceOrders, setDeviceOrders] = useState<DeviceOrder[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const searchPlaceholder = t("shop.searchPlaceholder") || "Search products..."
  const {
    catalogItems,
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
  const userChoseFulfillmentRef = useRef(false)
  const userChosePaymentRef = useRef(false)

  const setFulfillmentByUser = useCallback((value: CheckoutFulfillmentMethod) => {
    userChoseFulfillmentRef.current = true
    setFulfillment(value)
  }, [])
  
  // Compute business availability
  const businessHours = site?.settings?.business_hours || []
  const isOpen = businessHours.length > 0 ? isBusinessOpen(businessHours) : true
  const nextOpenSlot = !isOpen ? getNextOpenSlot(businessHours, new Date(), locale) : null
  
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

  const router = useRouter()

  const categories = initialCategories || [];
  const ownedAccessMap = new Map(ownedItemIdsState.map(o => [o.catalogItemId, o.canBook]))

  const isItemCompatibleWithFulfillment = useCallback((item: CatalogItem) => {
    const options = getItemDeliveryOptions(item, shopAllowedOptions);
    if (options.includes(fulfillment)) return true;
    
    // Pure virtual items are compatible with in-person methods (pickup, dine_in)
    const isPureVirtual = options.length === 1 && options[0] === 'none';
    if (isPureVirtual && (fulfillment === 'pickup' || fulfillment === 'dine_in' || fulfillment === 'none')) {
      return true;
    }
    
    return false;
  }, [fulfillment, shopAllowedOptions]);

  const sellableCatalogItems = useMemo(() => {
    return catalogItems.filter(isItemCompatibleWithFulfillment);
  }, [catalogItems, isItemCompatibleWithFulfillment]);

  const ownedItems = useMemo(() => {
    return ownedItemsDataState.filter(isItemCompatibleWithFulfillment);
  }, [ownedItemsDataState, isItemCompatibleWithFulfillment]);

  const addToCart = useCallback((item: CatalogItem) => {
    if (ownedAccessMap.has(item.id)) {
      window.location.href = `/shop/${siteSlug}/${item.id}`
      return
    }

    if (item.is_dynamic_price) {
      router.push(`/shop/${siteSlug}/${item.id}`)
      return
    }

    if (requiresVariantSelection(item)) {
      router.push(`/shop/${siteSlug}/${item.id}`)
      return
    }

    if (item.is_reservation && !isAccessOnlyItem(item)) {
      router.push(`/shop/${siteSlug}/${item.id}/book`)
      return
    }

    setCart(prevCart => {
      const existing = prevCart.find(c => c.id === item.id)
      if (existing) {
        return prevCart.map(c => c.id === item.id ? { ...c, cartQty: c.cartQty + 1 } : c)
      } else {
        return [...prevCart, {
          ...item,
          site_id: item.site_id || site.id,
          cartQty: 1,
          cartPrice: item.target_sale_price || 0,
        }]
      }
    })
    toast.success(`${item.name} added to cart`)
    setIsCartOpen(true)
  }, [ownedAccessMap, siteSlug, router, site.id])

  const [promotionCode, setPromotionCode] = useState("")
  const [promotionId, setPromotionId] = useState<string | null>(null)
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

  // Ownership is per-buyer — load after auth so the public shop page stays cacheable
  useEffect(() => {
    let cancelled = false
    async function loadOwned() {
      if (!user) {
        setOwnedItemIdsState([])
        setOwnedItemsDataState([])
        return
      }
      try {
        const owned = await getShopUserOwnedItems(site.id)
        if (cancelled) return
        setOwnedItemIdsState(owned)
        const ids = owned.map((o) => o.catalogItemId)
        if (ids.length === 0) {
          setOwnedItemsDataState([])
          return
        }
        const { data } = await getShopItemsByIds(site.id, ids)
        if (cancelled) return
        setOwnedItemsDataState((data || []) as CatalogItem[])
      } catch {
        if (!cancelled) {
          setOwnedItemIdsState([])
          setOwnedItemsDataState([])
        }
      }
    }
    void loadOwned()
    return () => {
      cancelled = true
    }
  }, [user, site.id])

  useEffect(() => {
    if (typeof window === "undefined") return
    const cachedOrders = getDeviceOrders(site.id)
    setDeviceOrders(cachedOrders)

    const url = new URL(window.location.href)
    const justOrdered =
      url.searchParams.get("ordered") === "1" ||
      url.searchParams.get("success") === "true" ||
      url.hash === "#your-orders"

    if (justOrdered) {
      setCart([])
      clearCart("cart", "shop", site.id)
      setIsCartOpen(false)
      url.searchParams.delete("success")
      url.searchParams.delete("order_id")
      url.searchParams.delete("ordered")
      window.history.replaceState({}, "", url.pathname + url.search + "#your-orders")
      setIsCartLoaded(true)
      // Scroll after “Your orders” paints
      requestAnimationFrame(() => {
        document.getElementById("your-orders")?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
      window.setTimeout(() => {
        document.getElementById("your-orders")?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 250)
    } else {
      const loaded = getCartItems("cart", "shop", site.id).filter(
        (item: any) => !item.site_id || item.site_id === site.id
      )
      setCart(loaded)
      const pending = readPendingStorefrontPromo()
      if (pending && pending.surface === "shop" && pending.siteId === site.id) {
        if (pending.code) setPromotionCode(pending.code)
        setPromotionId(pending.promotionId)
        setIsCartOpen(true)
      } else if (url.searchParams.get("cart") === "1") {
        setIsCartOpen(true)
      }
      setIsCartLoaded(true)
    }
  }, [site.id])

  // Sync cart changes to localStorage (shop-scoped key + this site's items only)
  useEffect(() => {
    if (orderSuccess || !isCartLoaded) return;
    const scopedCart = cart.filter((item: any) => !item.site_id || item.site_id === site.id)
    if (scopedCart.length !== cart.length) {
      setCart(scopedCart)
      return
    }
    setCartItems('cart', 'shop', site.id, cart);
  }, [cart, site.id, orderSuccess, isCartLoaded])

  const updateQty = useCallback((id: string, delta: number) => {
    setCart(prevCart =>
      prevCart
        .map((c) => {
          if (cartLineKey(c) !== id) return c
          return { ...c, cartQty: Math.max(0, c.cartQty + delta) }
        })
        .filter((c) => c.cartQty > 0)
    )
  }, [])

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
      />

      <ShopCatalogMain
        siteSlug={siteSlug}
        categories={categories}
        categoryOffsets={initialCategoryOffsets}
        searchQuery={deferredSearchQuery}
        ownedItems={ownedItems}
        ownedAccessMap={ownedAccessMap}
        deviceOrders={deviceOrders}
        siteId={site.id}
        onDeviceOrdersHydrated={setDeviceOrders}
        sellableCatalogItems={sellableCatalogItems}
        rawCatalogItems={catalogItems}
        initialCount={initialCount || 0}
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

