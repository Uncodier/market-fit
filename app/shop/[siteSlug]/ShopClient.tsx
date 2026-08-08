"use client"

import { useState, useEffect } from "react"
import { CatalogItem } from "@/app/types"
import { CheckoutLine } from "@/app/commerce/checkout"
import { checkoutCartRequest, createStripeOrderCheckout } from "@/app/commerce/checkout-client"
import { clearCart, getCartItems, setCartItems } from "@/app/commerce/cart-storage"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { Button } from "@/app/components/ui/button"
import { toast } from "sonner"
import { CreditCard, Moon, Sun } from "@/app/components/ui/icons"
import { useTheme } from "@/app/context/ThemeContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { LocaleSelector } from "@/app/components/commerce/LocaleSelector"
import { CurrencySelector } from "@/app/components/commerce/CurrencySelector"
import { CommerceOrderSuccess } from "@/app/components/commerce/CommerceOrderSuccess"
import { ShopHeroTrust } from "./ShopHeroTrust"
import { ShopCatalogMain } from "./ShopCatalogMain"
import { ShopHeader } from "./ShopHeader"
import { useParams, useRouter } from "next/navigation"

import { ShopOwnedAccess } from "./actions"
import { useShopCatalog } from "./useShopCatalog"
import { isAccessOnlyItem } from "@/app/catalog/product-details"
import { isBusinessOpen, getNextOpenSlot } from "@/app/commerce/business-hours"
import { evaluateLocationRestrictions } from "@/app/commerce/location-restrictions"
import { formatDeliveryTime } from "@/app/commerce/delivery-time"
import { BuyerGeo } from "@/app/commerce/buyer-geo"

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
  initialCount,
  initialTotalPages,
  locations, 
  ownedItemIds = [],
  ownedItemsData = [],
  buyerGeo
}: { 
  site: any, 
  initialCatalog: CatalogItem[], 
  initialCategories: string[],
  initialCount: number,
  initialTotalPages: number,
  locations: any[], 
  ownedItemIds?: ShopOwnedAccess[],
  ownedItemsData?: CatalogItem[],
  buyerGeo?: BuyerGeo
}) {
  const { theme, toggleTheme } = useTheme()
  const { t, locale } = useLocalization()
  const { formatPrice } = useDisplayCurrency()
  const params = useParams()
  const siteSlug = params?.siteSlug || site?.slug || 'unknown'
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartLoaded, setIsCartLoaded] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [fulfillment, setFulfillment] = useState<'pickup' | 'ship' | 'none' | 'dine_in'>('ship')
  const [originLocationId, setOriginLocationId] = useState<string>(locations[0]?.id || '')
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
  
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const searchPlaceholder = t("shop.searchPlaceholder") || "Search products..."
  const { catalogItems, page, setPage, totalPages, isLoading } = useShopCatalog(
    site.id,
    initialCatalog,
    initialTotalPages,
    searchQuery,
    selectedCategory
  )

  const [orderTiming, setOrderTiming] = useState<'now' | 'scheduled'>('now')
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null)
  
  // Compute business availability
  const businessHours = site?.settings?.business_hours || []
  const isOpen = businessHours.length > 0 ? isBusinessOpen(businessHours) : true
  const nextOpenSlot = !isOpen ? getNextOpenSlot(businessHours, new Date(), locale) : null
  
  // Compute location availability
  const locationAvailable = (() => {
    if (!site?.settings?.locations || !buyerGeo) return true;
    const res = evaluateLocationRestrictions(site.settings.locations, buyerGeo);
    return res.available;
  })();

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
  const ownedAccessMap = new Map(ownedItemIds?.map(o => [o.catalogItemId, o.canBook]) || [])
  const ownedItems = ownedItemsData || []
  const sellableCatalogItems = catalogItems.filter((i: any) => i._shop?.sellable !== false)

  useEffect(() => {
    if (selectedCategory !== "all" && !categories.includes(selectedCategory)) {
      setSelectedCategory("all")
    }
  }, [categories, selectedCategory])

  const addToCart = (item: CatalogItem) => {
    if (ownedAccessMap.has(item.id)) {
      window.location.href = `/shop/${siteSlug}/${item.id}`
      return
    }

    if (item.is_dynamic_price) {
      router.push(`/shop/${siteSlug}/${item.id}`)
      return
    }

    if (item.is_reservation && !isAccessOnlyItem(item)) {
      router.push(`/shop/${siteSlug}/${item.id}/book`)
      return
    }

    const existing = cart.find(c => c.id === item.id)
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, cartQty: c.cartQty + 1 } : c))
    } else {
      setCart([...cart, { ...item, cartQty: 1, cartPrice: item.target_sale_price || 0 }])
    }
    toast.success(`${item.name} added to cart`)
    setIsCartOpen(true)
  }

  const [promotionCode, setPromotionCode] = useState("")
  const [promoDiscount, setPromoDiscount] = useState(0)
  const [ownerSiteId, setOwnerSiteId] = useState<string | null>(null)
  const { user } = useAuth()
  const session = user ? { user } : null
  const searchLabel = t("common.search") || "Search"

  // Set customer details if logged in
  useEffect(() => {
    if (session?.user && !customerEmail) {
      setCustomerEmail(session.user.email || "")
      setCustomerName(session.user.user_metadata?.name || "")
    }
  }, [session])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (url.searchParams.get('success') === 'true') {
        setOrderSuccess(true)
        setCart([])
        clearCart('cart', 'shop', site.id)
        // Clean up URL
        url.searchParams.delete('success')
        url.searchParams.delete('order_id')
        window.history.replaceState({}, '', url.toString())
      } else {
        setCart(getCartItems('cart', 'shop', site.id))
        if (url.searchParams.get('cart') === '1') {
           setIsCartOpen(true)
        }
        setIsCartLoaded(true)
      }
    }
  }, [site.id])

  // Sync cart changes to localStorage
  useEffect(() => {
    if (orderSuccess || !isCartLoaded) return;
    setCartItems('cart', 'shop', site.id, cart);
  }, [cart, site.id, orderSuccess, isCartLoaded])

  const updateQty = (id: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.id === id) {
        const newQty = Math.max(0, c.cartQty + delta)
        return { ...c, cartQty: newQty }
      }
      return c
    }).filter(c => c.cartQty > 0))
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

    if (fulfillment !== 'none' && !originLocationId) {
      toast.error("Store location error. Please try again.")
      return
    }

    if (fulfillment === 'ship' && (!shippingAddress.line1 || !shippingAddress.city || !shippingAddress.zip)) {
      toast.error("Please enter a complete shipping address")
      return
    }

    if (!paymentMethod) {
      toast.error("Please select a payment method")
      return
    }

    if (orderTiming === 'scheduled' && !scheduledFor) {
      toast.error(t('checkout.selectTimeRequired') || 'Please select a date and time for your order.')
      return
    }

    if (orderTiming === 'now' && !isOpen) {
      const confirmed = window.confirm(
        nextOpenSlot?.label
          ? (t('checkout.storeClosedConfirm', { time: nextOpenSlot.label }) ||
            `The store is currently closed. Your order will be processed ${nextOpenSlot.label}. Do you want to continue?`)
          : (t('checkout.storeClosedConfirmGeneric') ||
            'The store is currently closed. Your order will be processed when it opens. Do you want to continue?')
      )
      if (!confirmed) return
    }

    const finalScheduledFor =
      orderTiming === 'scheduled' && scheduledFor
        ? scheduledFor.toISOString()
        : orderTiming === 'now' && !isOpen && nextOpenSlot
          ? nextOpenSlot.at.toISOString()
          : undefined

    setCheckoutLoading(true)
    let redirectingToStripe = false

    try {
      const lines: CheckoutLine[] = cart.map(c => ({
        catalogItemId: c.id,
        quantity: c.cartQty,
        reservationStart: c.reservationStart,
        reservationEnd: c.reservationEnd
      }))

      const res = await checkoutCartRequest({
        siteId: site.id,
        lines,
        customerName: resolvedName,
        customerEmail: resolvedEmail,
        buyerUserId: session?.user?.id,
        ownerSiteId: ownerSiteId,
        fulfillment,
        originLocationId: originLocationId,
        shippingAddress: fulfillment === 'ship' ? shippingAddress : undefined,
        promotionCode: promotionCode || undefined,
        scheduledFor: finalScheduledFor,
        source: 'shop',
        paymentMethod: paymentMethod === 'cash_on_pickup' ? 'cash' : paymentMethod === 'bank_transfer' ? 'bank_transfer' : undefined,
        intent: payableTotal === 0 ? 'complete' : (paymentMethod === 'cash_on_pickup' || paymentMethod === 'bank_transfer' ? 'send' : 'draft')
      })

      if (res.error) {
        toast.error(res.error)
        return
      }

      if (payableTotal > 0 && paymentMethod === 'card') {
        const stripeData = await createStripeOrderCheckout({
          orderId: res.orderId!,
          siteId: site.id,
          returnUrl: window.location.origin + '/shop/' + siteSlug
        })
        if (stripeData.url) {
          redirectingToStripe = true
          window.location.href = stripeData.url
          return
        }
        toast.error(stripeData.error || "Failed to initiate payment")
        return
      }

      setOrderSuccess(true)
      setCart([])
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e: any) {
      console.error('Checkout failed:', e)
      toast.error(e?.message || "Checkout failed. Please try again.")
    } finally {
      if (!redirectingToStripe) {
        setCheckoutLoading(false)
      }
    }
  }

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
        isOpen={isOpen}
        nextOpenSlot={nextOpenSlot}
        locationAvailable={locationAvailable}
        deliveryTimeLabel={deliveryTimeLabel}
      />

      <ShopHeroTrust site={site} searchQuery={searchQuery} isOpen={isOpen} nextOpenSlot={nextOpenSlot} locationAvailable={locationAvailable} deliveryTimeLabel={deliveryTimeLabel} />

      <ShopCatalogMain
        siteSlug={siteSlug}
        categories={categories}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        searchQuery={searchQuery}
        ownedItems={ownedItems}
        ownedAccessMap={ownedAccessMap}
        sellableCatalogItems={sellableCatalogItems}
        initialCount={initialCount || 0}
        isLoading={isLoading}
        page={page}
        totalPages={totalPages}
        setPage={setPage}
        addToCart={addToCart}
        locationAvailable={locationAvailable}
      />
      
      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-2xl font-black tracking-tight text-gray-400 dark:text-gray-600">{site.name}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} {site.name}. {t('shop.allRightsReserved') || 'All rights reserved.'} {t('shop.poweredBy') || 'Powered by Uncodie.'}
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-8 w-8 text-gray-300 dark:text-gray-700" />
            <CurrencySelector className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400" />
            <LocaleSelector className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400" />
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-800">
              {theme === "dark" ? <Sun className="h-5 w-5 text-gray-400 hover:text-black dark:hover:text-white" /> : <Moon className="h-5 w-5 text-gray-500 hover:text-black dark:hover:text-white" />}
            </Button>
          </div>
        </div>
      </footer>

      {/* Sticky Mobile Cart CTA - High conversion pattern */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-950 border-t dark:border-gray-800 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-none z-30 md:hidden animate-in slide-in-from-bottom-full">
          <Button 
            className="w-full h-14 text-lg rounded-xl font-bold flex items-center justify-between px-6"
            onClick={() => setIsCartOpen(true)}
          >
            <div className="flex items-center gap-2">
              <span className="bg-white/20 px-2 py-0.5 rounded-md text-sm">{cartCount}</span>
              <span>{t('shop.checkout') || 'Checkout'}</span>
            </div>
            <span>{formatPrice(subtotal, cart[0]?.currency || 'USD')}</span>
          </Button>
        </div>
      )}
    </div>
  )
}

