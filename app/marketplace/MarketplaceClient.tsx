"use client"

import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { checkoutCart, CheckoutLine } from "@/app/commerce/checkout"
import { clearCart, getCartItems, setCartItems } from "@/app/commerce/cart-storage"
import { CatalogItem } from "@/app/types"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { useSearchParams, useRouter } from "next/navigation"
import { useLocalization } from "@/app/context/LocalizationContext"
import { isAccessOnlyItem } from "@/app/catalog/product-details"
import { shouldUseCompactMobileListing } from "@/app/components/commerce/CommerceProductGrid"
import { CommerceOrderSuccess } from "@/app/components/commerce/CommerceOrderSuccess"
import { getSiteInfoBySlug } from "@/app/book/actions"
import { listLocations } from "@/app/inventory/actions"
import { MarketplaceCartPanel } from "./MarketplaceCartPanel"
import { MarketplaceFooter } from "./MarketplaceFooter"
import {
  MarketplaceCategoryChips,
  MarketplaceFilterSidebar,
} from "./MarketplaceCategoryChips"
import { MarketplaceHeader } from "./MarketplaceHeader"
import { MarketplaceProductList } from "./MarketplaceProductList"
import { useMarketplaceProducts } from "./useMarketplaceProducts"

interface MarketplaceItem extends CatalogItem {
  site: { id: string; name: string; logo_url?: string | null }
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
  initialTotalPages 
}: { 
  initialItems: MarketplaceItem[],
  initialCount: number,
  initialTotalPages: number
}) {
  const { t, locale, setLocale } = useLocalization()
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const session = user ? { user } : null
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartLoaded, setIsCartLoaded] = useState(false)
  const filterParam = searchParams?.get("filter")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedKind, setSelectedKind] = useState<string>(filterParam === "recurring" ? "recurring" : "all")
  const [selectedSubtype, setSelectedSubtype] = useState<string>("all")
  const [showOnlyRecurring, setShowOnlyRecurring] = useState(filterParam === "recurring")
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const searchPlaceholder = t("marketplace.searchPlaceholder") || "Search everything..."
  const searchLabel = t("common.search") || "Search"

  const { items: rawItems, page, setPage, totalPages, isLoading } = useMarketplaceProducts(
    initialItems,
    initialTotalPages,
    searchQuery,
    selectedKind,
    selectedSubtype,
    showOnlyRecurring,
    filterParam
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
  const [promotionCode, setPromotionCode] = useState("")
  const [promoDiscount, setPromoDiscount] = useState(0)
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<string>("")
  
  // Settings & Locations for current seller
  const [siteSettings, setSiteSettings] = useState<any>(null)
  const [locations, setLocations] = useState<any[]>([])
  const [originLocationId, setOriginLocationId] = useState<string>("")
  
  // Shipping info
  const [fulfillment, setFulfillment] = useState<'pickup' | 'ship' | 'none' | 'dine_in'>('none')
  const [shippingAddress, setShippingAddress] = useState({ line1: "", line2: "", city: "", state: "", zip: "", country: "" })

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
      listLocations(currentSiteId).then(res => {
        if (res.data) setLocations(res.data)
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
    if (url.searchParams.get("success") === "true") {
      setOrderSuccess(true)
      setCart([])
      clearCart("cart", "marketplace")
      url.searchParams.delete("success")
      url.searchParams.delete("order_id")
      window.history.replaceState({}, "", url.toString())
    } else {
      setCart(getCartItems("cart", "marketplace"))
      if (url.searchParams.get("cart") === "1") setIsCartOpen(true)
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
        .map((c) => (c.id === id ? { ...c, cartQty: Math.max(0, c.cartQty + delta) } : c))
        .filter((c) => c.cartQty > 0)
    )
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.cartPrice * item.cartQty), 0)
  const payableTotal = Math.max(0, subtotal - promoDiscount)
  const cartCount = cart.reduce((s, c) => s + c.cartQty, 0)

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cart.length === 0) return
    
    const requiresAuth = cart.some((c: any) => c.kind === "digital_asset" || c.is_recurring)
    if (requiresAuth && !session?.user) {
      toast.error(t("checkout.identity.signInToAccess") || "Please sign in to purchase digital items or subscriptions.")
      return
    }

    const resolvedName =
      customerName ||
      session?.user?.user_metadata?.name ||
      session?.user?.user_metadata?.full_name ||
      session?.user?.email ||
      ""
    const resolvedEmail = customerEmail || session?.user?.email || ""

    if (!resolvedName || !resolvedEmail) {
      toast.error("Please enter your name and email")
      return
    }

    if (fulfillment === 'ship' && (!shippingAddress.line1 || !shippingAddress.city || !shippingAddress.zip)) {
      toast.error("Please enter a complete shipping address")
      return
    }

    if (fulfillment !== 'none' && !originLocationId) {
      toast.error("Store location error. Please try again.")
      return
    }

    if (!paymentMethod) {
      toast.error("Please select a payment method")
      return
    }

    setCheckoutLoading(true)
    
    // Group by siteId since checkoutCart currently processes one site at a time.
    const uniqueSiteIds = Array.from(new Set(cart.map(c => c.site_id)))
    
    if (uniqueSiteIds.length > 1) {
      toast.error("V1 only supports checking out from one seller at a time. Please remove items from other sellers.")
      setCheckoutLoading(false)
      return
    }
    
    const siteId = uniqueSiteIds[0]

    const lines: CheckoutLine[] = cart.map(c => ({
      catalogItemId: c.id,
      quantity: c.cartQty,
      reservationStart: c.reservationStart,
      reservationEnd: c.reservationEnd
    }))

    const res = await checkoutCart({
      siteId: siteId,
      lines,
      customerName: resolvedName,
      customerEmail: resolvedEmail,
      buyerUserId: session?.user?.id,
      ownerSiteId,
      fulfillment,
      originLocationId: originLocationId,
      shippingAddress: fulfillment === 'ship' ? shippingAddress : undefined,
      promotionCode: promotionCode || undefined,
      source: 'marketplace',
      paymentMethod: paymentMethod === 'cash_on_pickup' ? 'cash' : paymentMethod === 'bank_transfer' ? 'bank_transfer' : undefined,
      intent: payableTotal === 0 ? 'complete' : (paymentMethod === 'cash_on_pickup' || paymentMethod === 'bank_transfer' ? 'send' : 'draft')
    })

    if (res.error) {
      toast.error(res.error)
      setCheckoutLoading(false)
    } else {
      if (payableTotal > 0 && paymentMethod === 'card') {
        // Redirect to Stripe
        try {
          const stripeRes = await fetch('/api/stripe/checkout/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: res.orderId,
              siteId: siteId,
              returnUrl: window.location.origin + (returnTo?.startsWith('/') ? returnTo : '/marketplace')
            })
          })
          const stripeData = await stripeRes.json()
          if (stripeData.url) {
            window.location.href = stripeData.url
            return // don't set loading to false so it feels continuous
          } else {
            toast.error(stripeData.error || "Failed to initiate payment")
            setCheckoutLoading(false)
          }
        } catch (e) {
          toast.error("Failed to connect to payment gateway")
          setCheckoutLoading(false)
        }
      } else {
        setOrderSuccess(true)
        setCart([])
        setCheckoutLoading(false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        
        // If we have a returnTo and total is 0 (no stripe redirect), we can redirect manually or just let the success screen handle it
        if (returnTo?.startsWith('/')) {
          router.push(returnTo)
        }
      }
    }
  }

  if (orderSuccess) {
    return (
      <CommerceOrderSuccess
        title={t('marketplace.success.title') || 'Order Confirmed'}
        description={t('marketplace.success.desc') || "Thank you for your purchase. We've sent a confirmation email with your order details."}
        continueLabel={t('marketplace.success.continueShopping') || 'Continue Shopping'}
        primaryHref={returnTo?.startsWith('/') ? returnTo : "/buyer"}
        primaryLabel={t('marketplace.success.viewPurchases') || 'View My Purchases'}
        paymentMethod={paymentMethod}
        bankTransfer={siteSettings?.shop?.bank_transfer}
        onContinue={() => {
          setOrderSuccess(false)
          setPaymentMethod('')
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
          />

          <div className="flex-1 min-w-0 w-full">
            <MarketplaceCategoryChips
              selectedKind={selectedKind}
              setSelectedKind={setSelectedKind}
              selectedSubtype={selectedSubtype}
              setSelectedSubtype={setSelectedSubtype}
              effectiveKind={effectiveKind}
            />
            <MarketplaceProductList
              items={items}
              initialCount={initialCount || 0}
              isLoading={isLoading}
              compactMobile={compactMobile}
              page={page}
              totalPages={totalPages}
              setPage={setPage}
              onPrimaryAction={addToCart}
            />
          </div>
        </div>
      </main>

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
