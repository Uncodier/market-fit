"use client"
import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { clearCart, getCartItems, setCartItems } from "@/app/commerce/cart-storage"
import { cartLineExtendedTotal, cartLineKey } from "@/app/commerce/cart-modifiers"
import { getDeviceOrders } from "@/app/commerce/device-order-storage"
import { buildPublicDocPath } from "@/app/documents/public-token"
import { withInternalFrom } from "@/app/documents/internal-back"
import { runMarketplaceCheckout } from "./run-marketplace-checkout"
import { CatalogItem } from "@/app/types"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import {
  buildMarketplaceCategorySearch,
  parseMarketplaceKind,
  parseMarketplaceSubtype,
} from "./marketplace-category-url"
import { useLocalization } from "@/app/context/LocalizationContext"
import { isAccessOnlyItem, requiresVariantSelection } from "@/app/catalog/product-details"
import { shouldUseCompactMobileListing } from "@/app/components/commerce/CommerceProductGrid"
import { CommerceOrderSuccess } from "@/app/components/commerce/CommerceOrderSuccess"
import { getSiteInfoBySlug } from "@/app/book/actions"
import { listPublicLocations } from "@/app/inventory/actions"
import { MarketplaceCartPanel } from "./MarketplaceCartPanel"
import { MarketplaceFooter } from "./MarketplaceFooter"
import { MarketplaceCategoryChips, MarketplaceFilterSidebar } from "./MarketplaceCategoryChips"
import { MarketplaceHeader } from "./MarketplaceHeader"
import { MarketplaceProductList } from "./MarketplaceProductList"
import { useMarketplaceProducts } from "./useMarketplaceProducts"
import type { PromoBadge, StorefrontPromoCard } from "@/app/promotions/promotion-merchandising"
import { readPendingStorefrontPromo } from "@/app/components/commerce/PromoBundleExperience"
import { MarketplaceDiscountsFeed } from "./MarketplaceDiscountsFeed"
import { isBusinessOpen, getNextOpenSlot } from "@/app/commerce/business-hours"
import { evaluateLocationRestrictions } from "@/app/commerce/location-restrictions"
import { formatDeliveryTime } from "@/app/commerce/delivery-time"
import { BuyerGeo } from "@/app/commerce/buyer-geo"
import {
  buyerGeoToAddress,
  isBuyerLocationIncompatible,
  isItemLocationAvailable,
} from "@/app/commerce/buyer-location-availability"
import { useBuyerLocation } from "@/app/components/commerce/use-buyer-location"
import {
  buyerLocationLeadingChip,
  BuyerLocationSheetHost,
} from "@/app/components/commerce/BuyerLocationControls"

interface MarketplaceItem extends CatalogItem {
  site: { id: string; name: string; logo_url?: string | null; settings?: any }
}

interface CartItem extends MarketplaceItem {
  cartQty: number
  cartPrice: number
  reservationStart?: string
  reservationEnd?: string
}

export function MarketplaceClient({ 
  initialItems, 
  initialCount,
  initialTotalPages,
  buyerGeo,
  discountsFeed = [],
  promoBadgesByItemId = {},
}: { 
  initialItems: MarketplaceItem[],
  initialCount: number,
  initialTotalPages: number,
  buyerGeo?: BuyerGeo,
  discountsFeed?: StorefrontPromoCard[],
  promoBadgesByItemId?: Record<string, PromoBadge>,
}) {
  const { t, locale, setLocale } = useLocalization()
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const pathname = usePathname() || "/marketplace"
  const router = useRouter()
  const session = user ? { user } : null
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartLoaded, setIsCartLoaded] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const selectedKind = parseMarketplaceKind(searchParams?.get("filter"))
  const selectedSubtype = parseMarketplaceSubtype(searchParams?.get("subtype"))
  const showOnlyRecurring = selectedKind === "recurring"
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const searchPlaceholder = t("marketplace.searchPlaceholder") || "Search everything..."
  const searchLabel = t("common.search") || "Search"
  const showingDiscounts = selectedKind === "discounts"

  const setSelectedKind = (kind: string) => {
    const qs = buildMarketplaceCategorySearch(searchParams, {
      kind,
      subtype: kind === "digital_asset" ? selectedSubtype : "all",
    })
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const setSelectedSubtype = (subtype: string) => {
    const qs = buildMarketplaceCategorySearch(searchParams, {
      kind: selectedKind,
      subtype,
    })
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const productKind = showingDiscounts ? "all" : selectedKind
  const { items: rawItems, page, setPage, totalPages, isLoading } = useMarketplaceProducts(
    initialItems,
    initialTotalPages,
    searchQuery,
    productKind,
    selectedSubtype,
    showOnlyRecurring,
  )
  const items = rawItems as MarketplaceItem[];
  const compactMobile = shouldUseCompactMobileListing(initialCount || 0)

  const effectiveKind = selectedKind === 'recurring' ? 'all' : selectedKind;

  useEffect(() => {
    let title = "Marketplace | Makinari"
    if (selectedKind !== "all" || selectedSubtype !== "all") {
      const activeFilter = selectedSubtype !== "all" ? selectedSubtype : selectedKind;
      const filterLabel = activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1).replace(/_/g, " ");
      title = `${filterLabel} | Marketplace`
    }
    document.title = title
  }, [selectedKind, selectedSubtype])

  // Checkout states
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [successOrderToken, setSuccessOrderToken] = useState<string | null>(null)
  const [promotionCode, setPromotionCode] = useState("")
  const [promotionId, setPromotionId] = useState<string | null>(null)
  const [promoDiscount, setPromoDiscount] = useState(0)
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  const [orderNotes, setOrderNotes] = useState("")
  
  // Settings & Locations for current seller
  const [siteSettings, setSiteSettings] = useState<any>(null)
  const [locations, setLocations] = useState<any[]>([])
  const [originLocationId, setOriginLocationId] = useState<string>("")
  
  // Shipping info
  const [fulfillment, setFulfillment] = useState<'pickup' | 'ship' | 'none' | 'dine_in'>('none')
  const [shippingAddress, setShippingAddress] = useState({ line1: "", line2: "", city: "", state: "", zip: "", country: "" })

  const [orderTiming, setOrderTiming] = useState<'now' | 'scheduled'>('now')
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null)

  const buyerLocation = useBuyerLocation({
    scope: "marketplace",
    initialGeo: buyerGeo,
    alwaysShowPill: true,
    setLocationFallback: t("shop.location.setLocation") || "Set location",
  })

  const businessHours = siteSettings?.business_hours || []
  const isOpen = businessHours.length > 0 ? isBusinessOpen(businessHours) : true
  const nextOpenSlot = !isOpen ? getNextOpenSlot(businessHours, new Date(), locale) : null

  const isLocationAvailable = React.useMemo(() => {
    // Pickup / dine-in at a chosen store is not gated by buyer IP geo
    if (
      originLocationId &&
      (fulfillment === "pickup" || fulfillment === "dine_in")
    ) {
      return true
    }
    if (!siteSettings?.locations || siteSettings.locations.length === 0) return true
    if (fulfillment === "ship" && shippingAddress.city && shippingAddress.zip) {
      return evaluateLocationRestrictions(siteSettings.locations, shippingAddress).available
    }
    const geo = buyerLocation.effectiveBuyerGeo
    if (geo) {
      return evaluateLocationRestrictions(
        siteSettings.locations,
        buyerGeoToAddress(geo)
      ).available
    }
    return true
  }, [
    siteSettings,
    shippingAddress,
    fulfillment,
    originLocationId,
    buyerLocation.effectiveBuyerGeo,
  ])

  const deliveryTimeLabel = formatDeliveryTime(siteSettings?.shop)

  // Red chip when current area is incompatible with cart seller, or with any visible listing
  const locationChipRestricted = React.useMemo(() => {
    if (siteSettings?.locations?.length) {
      return isBuyerLocationIncompatible({
        settingsLocations: siteSettings.locations,
        buyerGeo: buyerLocation.effectiveBuyerGeo,
        selectedLocationId:
          originLocationId &&
          (fulfillment === "pickup" || fulfillment === "dine_in")
            ? originLocationId
            : null,
      })
    }
    if (!buyerLocation.effectiveBuyerGeo) return false
    return items.some(
      (item) =>
        !isItemLocationAvailable({
          item,
          settingsLocations: item.site?.settings?.locations || null,
          buyerGeo: buyerLocation.effectiveBuyerGeo,
        })
    )
  }, [
    siteSettings,
    buyerLocation.effectiveBuyerGeo,
    originLocationId,
    fulfillment,
    items,
  ])


  // Fetch settings when seller changes
  useEffect(() => {
    let currentSiteId = null;
    if (cart.length > 0) {
      const uniqueSiteIds = Array.from(new Set(cart.map(c => c.site_id)))
      if (uniqueSiteIds.length > 0) {
        currentSiteId = uniqueSiteIds[0];
      }
    }
    
    if (currentSiteId) {
      // Public storefront path (service role) — buyers are not site members, so RLS blocks listLocations
      listPublicLocations(currentSiteId).then(res => {
        setLocations(res.data || [])
      }).catch(console.error);

      getSiteInfoBySlug(currentSiteId).then(site => {
        if (site && site.settings) setSiteSettings(site.settings)
      }).catch(console.error);
    } else {
      setLocations([])
      setSiteSettings(null)
    }
  }, [cart])

  // URL params for company mode
  const initialOwnerSiteId = searchParams?.get("ownerSiteId")
  const returnTo = searchParams?.get("returnTo")
  
  const [ownerSiteId, setOwnerSiteId] = useState<string | null>(initialOwnerSiteId)
  const isLockedDestination = !!initialOwnerSiteId

  useEffect(() => {
    if (session?.user && !customerEmail) {
      setCustomerEmail(session.user.email || "")
      setCustomerName(session.user.user_metadata?.name || "")
    }
  }, [session])

  useEffect(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (
      url.searchParams.get("success") === "true" ||
      url.searchParams.get("ordered") === "1"
    ) {
      const siteIdFromCart = getCartItems("cart", "marketplace")[0]?.site_id
      setCart([])
      clearCart("cart", "marketplace")
      setIsCartOpen(false)
      if (siteIdFromCart) {
        setSuccessOrderToken(getDeviceOrders(siteIdFromCart)[0]?.publicAccessToken || null)
      }
      setOrderSuccess(true)
      url.searchParams.delete("success")
      url.searchParams.delete("order_id")
      url.searchParams.delete("ordered")
      window.history.replaceState({}, "", url.toString())
      setIsCartLoaded(true)
    } else {
      setCart(getCartItems("cart", "marketplace"))
      const pending = readPendingStorefrontPromo()
      if (pending && pending.surface === "marketplace") {
        if (pending.code) setPromotionCode(pending.code)
        setPromotionId(pending.promotionId)
        setIsCartOpen(true)
      } else if (url.searchParams.get("cart") === "1") {
        setIsCartOpen(true)
      }
      setIsCartLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (orderSuccess || !isCartLoaded) return
    setCartItems("cart", "marketplace", null, cart)
  }, [cart, orderSuccess, isCartLoaded])

  const addToCart = (item: MarketplaceItem) => {
    if (item.is_dynamic_price) {
      router.push(`/marketplace/${item.id}`)
      return
    }
    if (requiresVariantSelection(item)) {
      router.push(`/marketplace/${item.id}`)
      return
    }
    if (item.is_reservation && !isAccessOnlyItem(item)) {
      router.push(`/marketplace/${item.id}/book`)
      return
    }
    const existing = cart.find((c) => c.id === item.id)
    setCart(
      existing
        ? cart.map((c) => (c.id === item.id ? { ...c, cartQty: c.cartQty + 1 } : c))
        : [...cart, { ...item, cartQty: 1, cartPrice: item.target_sale_price || 0 }]
    )
    toast.success(`${item.name} ${t("marketplace.addedToCart") || "added to cart"}`)
    setIsCartOpen(true)
  }

  const updateQty = (id: string, delta: number) => {
    setCart(
      cart
        .map((c) =>
          cartLineKey(c) === id
            ? { ...c, cartQty: Math.max(0, c.cartQty + delta) }
            : c,
        )
        .filter((c) => c.cartQty > 0)
    )
  }

  const subtotal = cart.reduce((sum, item) => sum + cartLineExtendedTotal(item), 0)
  const payableTotal = Math.max(0, subtotal - promoDiscount)
  const cartCount = cart.reduce((s, c) => s + c.cartQty, 0)

  const handleCheckout = (e: React.FormEvent) =>
    runMarketplaceCheckout({
      e,
      cart,
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
      isLocationAvailable,
      payableTotal,
      promotionCode,
      promotionId,
      ownerSiteId,
      returnTo,
      t,
      setCheckoutLoading,
      onSuccess: () => {
        const siteIdFromCart = cart[0]?.site_id
        setCart([])
        clearCart("cart", "marketplace")
        setIsCartOpen(false)
        if (siteIdFromCart) {
          setSuccessOrderToken(getDeviceOrders(siteIdFromCart)[0]?.publicAccessToken || null)
        }
        setOrderSuccess(true)
        window.scrollTo({ top: 0, behavior: "smooth" })
      },
      onReturn: () => {
        if (returnTo?.startsWith("/")) router.push(returnTo)
      },
    })

  if (orderSuccess) {
    const orderHref = successOrderToken
      ? withInternalFrom(buildPublicDocPath("so", successOrderToken), "/marketplace")
      : null
    return (
      <CommerceOrderSuccess
        title={t('marketplace.success.title') || 'Order Confirmed'}
        description={t('marketplace.success.desc') || "Thank you for your purchase. You can view your order summary or keep shopping."}
        continueLabel={t('marketplace.success.continueShopping') || 'Continue Shopping'}
        primaryHref={orderHref || undefined}
        primaryLabel={
          orderHref
            ? (t('checkout.success.viewOrder') || 'View order summary')
            : undefined
        }
        paymentMethod={paymentMethod}
        bankTransfer={siteSettings?.shop?.bank_transfer}
        onContinue={() => {
          setOrderSuccess(false)
          setPaymentMethod('')
          setSuccessOrderToken(null)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <MarketplaceHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder={searchPlaceholder}
        searchLabel={searchLabel}
        mobileSearchOpen={mobileSearchOpen}
        setMobileSearchOpen={setMobileSearchOpen}
        locale={locale}
        setLocale={setLocale}
        cartCount={cartCount}
        subtotal={subtotal}
        currency={cart[0]?.currency}
        onCartOpen={() => setIsCartOpen(true)}
        session={session}
        signInLabel={t("marketplace.signIn") || "Sign In"}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-12">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <MarketplaceFilterSidebar
            selectedKind={selectedKind}
            setSelectedKind={setSelectedKind}
            selectedSubtype={selectedSubtype}
            setSelectedSubtype={setSelectedSubtype}
            effectiveKind={effectiveKind}
            leadingChip={buyerLocationLeadingChip(
              buyerLocation,
              "w-full justify-start max-w-none",
              locationChipRestricted
            )}
          />

          <div className="flex-1 min-w-0 w-full">
            <MarketplaceCategoryChips
              selectedKind={selectedKind}
              setSelectedKind={setSelectedKind}
              selectedSubtype={selectedSubtype}
              setSelectedSubtype={setSelectedSubtype}
              effectiveKind={effectiveKind}
              leadingChip={buyerLocationLeadingChip(
                buyerLocation,
                undefined,
                locationChipRestricted
              )}
            />
            {showingDiscounts ? (
              <MarketplaceDiscountsFeed
                discountsFeed={discountsFeed}
                compactMobile={compactMobile}
              />
            ) : (
              <MarketplaceProductList
                items={items}
                initialCount={initialCount || 0}
                isLoading={isLoading}
                compactMobile={compactMobile}
                page={page}
                totalPages={totalPages}
                setPage={setPage}
                onPrimaryAction={addToCart}
                buyerGeo={buyerLocation.effectiveBuyerGeo}
                promoBadgesByItemId={promoBadgesByItemId}
              />
            )}
          </div>
        </div>
      </main>

      <BuyerLocationSheetHost location={buyerLocation} />

      {isCartOpen && (
        <MarketplaceCartPanel
          cart={cart}
          subtotal={subtotal}
          updateQty={updateQty}
          session={session}
          isLockedDestination={isLockedDestination}
          ownerSiteId={ownerSiteId}
          setOwnerSiteId={setOwnerSiteId}
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerEmail={customerEmail}
          setCustomerEmail={setCustomerEmail}
          fulfillment={fulfillment}
          setFulfillment={setFulfillment}
          originLocationId={originLocationId}
          setOriginLocationId={setOriginLocationId}
          locations={locations}
          shippingAddress={shippingAddress}
          setShippingAddress={setShippingAddress}
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
          locationAvailable={isLocationAvailable}
          deliveryTimeLabel={deliveryTimeLabel}
          promotionCode={promotionCode}
          setPromotionCode={setPromotionCode}
          promoDiscount={promoDiscount}
          setPromoDiscount={setPromoDiscount}
          siteSettings={siteSettings}
          handleCheckout={handleCheckout}
          checkoutLoading={checkoutLoading}
          setIsCartOpen={setIsCartOpen}
          t={t}
        />
      )}

      <MarketplaceFooter
        effectiveKind={effectiveKind}
        setSelectedKind={setSelectedKind}
        setSelectedSubtype={setSelectedSubtype}
      />
    </div>
  )
}
