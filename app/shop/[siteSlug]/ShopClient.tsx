"use client"

import { useState, useEffect } from "react"
import { CatalogItem } from "@/app/types"
import { checkoutCart, CheckoutLine } from "@/app/commerce/checkout"
import { clearCart, getCartItems, setCartItems } from "@/app/commerce/cart-storage"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { Button } from "@/app/components/ui/button"
import { toast } from "sonner"
import { Search, CreditCard, Moon, Sun, User } from "@/app/components/ui/icons"
import { useTheme } from "@/app/context/ThemeContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { CartButton } from "@/app/components/commerce/CartButton"
import { CommerceShareControl } from "@/app/components/commerce/CommerceShareControl"
import { LocaleSelector } from "@/app/components/commerce/LocaleSelector"
import { CurrencySelector } from "@/app/components/commerce/CurrencySelector"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/app/components/ui/sheet"
import { CommerceOrderSuccess } from "@/app/components/commerce/CommerceOrderSuccess"
import { CartSidebar } from "./CartSidebar"
import { ShopHeroTrust } from "./ShopHeroTrust"
import { ShopCatalogMain } from "./ShopCatalogMain"
import { MobileShellSearchExpanded, MobileShellSearchTrigger } from "@/app/components/commerce/MobileShellSearch"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"

import { ShopOwnedAccess } from "./actions"
import { useShopCatalog } from "./useShopCatalog"
import { isAccessOnlyItem } from "@/app/catalog/product-details"

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
  ownedItemsData = []
}: { 
  site: any, 
  initialCatalog: CatalogItem[], 
  initialCategories: string[],
  initialCount: number,
  initialTotalPages: number,
  locations: any[], 
  ownedItemIds?: ShopOwnedAccess[],
  ownedItemsData?: CatalogItem[]
}) {
  const { theme, toggleTheme } = useTheme()
  const { t } = useLocalization()
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

    setCheckoutLoading(true)
    
    const lines: CheckoutLine[] = cart.map(c => ({
      catalogItemId: c.id,
      quantity: c.cartQty,
      reservationStart: c.reservationStart,
      reservationEnd: c.reservationEnd
    }))

    const res = await checkoutCart({
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
      source: 'shop',
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
              siteId: site.id,
              returnUrl: window.location.origin + '/shop/' + siteSlug
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
      {/* Top Spacer for floating header */}
      <div className="h-4 w-full shrink-0" />
      {/* Sticky Header */}
      <CommerceShellHeader
        mobileExpanded={
          mobileSearchOpen ? (
            <MobileShellSearchExpanded
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={searchPlaceholder}
              open={mobileSearchOpen}
              onOpenChange={setMobileSearchOpen}
            />
          ) : undefined
        }
        brand={
          <Link href={`/shop/${siteSlug}`} className="shrink-0 flex items-center hover:opacity-80 transition-opacity">
            {site.logo_url ? (
              <img src={site.logo_url} alt={site.name} className="h-6 object-contain" />
            ) : (
              <span className="text-xl font-black tracking-tight text-gray-900 dark:text-gray-100 truncate max-w-[150px] md:max-w-none">
                {site.name}
              </span>
            )}
          </Link>
        }
        hideCenterOnMobile={false}
        center={
          <>
            <div className="md:hidden flex w-full min-w-0">
              <MobileShellSearchTrigger
                value={searchQuery}
                label={t("common.search") || "Search"}
                onOpen={() => setMobileSearchOpen(true)}
              />
            </div>
            <div className="hidden md:block w-full relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                className="w-full pl-9 h-9 text-sm bg-muted/50 focus:bg-white dark:focus:bg-gray-950 border border-transparent focus:border-black/10 dark:focus:border-white/10 rounded-full transition-all outline-none shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </>
        }
        actions={
          <div
            data-commerce-shell-actions-core
            className="flex items-center justify-end gap-1 md:gap-3 min-w-0"
          >
            <CommerceShareControl
              className={`relative ${shellClasses.iconButton}`}
              iconClassName="h-4 w-4"
              title={site.name}
            />
            <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
              <SheetTrigger asChild>
                <CartButton
                  cartCount={cartCount}
                  subtotal={subtotal}
                  currency={cart[0]?.currency}
                  variant="shell"
                  className={`relative ${shellClasses.iconButton}`}
                  iconClassName="h-4 w-4"
                />
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-white border-l-0 shadow-2xl">
                <SheetTitle className="sr-only">Shopping Cart</SheetTitle>
                <CartSidebar
                  cart={cart}
                  session={session}
                  subtotal={subtotal}
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
                  closeCart={() => setIsCartOpen(false)}
                  site={site}
                  paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod}
                />
              </SheetContent>
            </Sheet>

            {session ? (
              <Link href="/buyer" className="hover:opacity-80 transition-opacity ml-1 shrink-0">
                {session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture ? (
                  <img
                    src={session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture}
                    alt="Avatar"
                    className="w-8 h-8 min-w-8 rounded-full object-cover border border-border shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 min-w-8 rounded-full bg-muted flex items-center justify-center border border-border shadow-sm shrink-0">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </Link>
            ) : (
              <Link
                href={`/auth?returnTo=${encodeURIComponent(`/shop/${siteSlug}`)}`}
                className={`${shellClasses.primaryCta} ml-1`}
              >
                {t('shop.signIn') || 'Sign In'}
              </Link>
            )}
          </div>
        }
      />

      <ShopHeroTrust site={site} searchQuery={searchQuery} />

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
            className="w-full h-14 text-lg rounded-xl shadow-md font-bold flex items-center justify-between px-6 bg-gray-900 text-white hover:bg-gray-100 hover:text-black dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:hover:text-white"
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

