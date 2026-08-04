"use client"

import { useState, useEffect, useMemo } from "react"
import { CatalogItem } from "@/app/types"
import { checkoutCart, CheckoutLine } from "@/app/commerce/checkout"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { DestinationSelector } from "@/app/components/commerce/DestinationSelector"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { toast } from "sonner"
import { 
  ShoppingCart, Archive, DatabaseIcon,
  ShieldCheck, Truck, RotateCcw, Star, Search, Menu, CreditCard, CheckCircle,
  Moon, Sun, User
} from "@/app/components/ui/icons"
import { useTheme } from "@/app/context/ThemeContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { resolveItemImage } from "@/app/lib/image-utils"
import { CartButton } from "@/app/components/commerce/CartButton"
import { CommerceShareControl } from "@/app/components/commerce/CommerceShareControl"
import { LocaleSelector } from "@/app/components/commerce/LocaleSelector"
import { CurrencySelector } from "@/app/components/commerce/CurrencySelector"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/app/components/ui/sheet"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog"
import { CatalogListingCard } from "@/app/components/commerce/CatalogListingCard"
import { CartSidebar } from "./CartSidebar"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"

import { ShopOwnedAccess } from "./actions"
import { isAccessOnlyItem } from "@/app/catalog/product-details"

interface CartItem extends CatalogItem {
  cartQty: number;
  cartPrice: number;
  reservationStart?: string;
  reservationEnd?: string;
}

export default function ShopClient({ site, initialCatalog, locations, ownedItemIds = [] }: { site: any, initialCatalog: CatalogItem[], locations: any[], ownedItemIds?: ShopOwnedAccess[] }) {
  const { theme, toggleTheme } = useTheme()
  const { t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()
  const params = useParams()
  const siteSlug = params?.siteSlug || site?.slug || 'unknown'
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartLoaded, setIsCartLoaded] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
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
  
  useEffect(() => {
    if (selectedCategory && selectedCategory !== "all") {
      document.title = `${selectedCategory} | ${site?.name || "Shop"}`
    } else {
      document.title = `${site?.name || "Shop"} | Shop`
    }
  }, [selectedCategory, site?.name])

  const router = useRouter()

  // Extract unique categories from items
  const categories = useMemo(() => {
    const cats = new Set<string>();
    initialCatalog.forEach((item: any) => {
      if (item._shop?.categoryName) {
        cats.add(item._shop.categoryName);
      }
    });
    return Array.from(cats).sort();
  }, [initialCatalog]);

  const allFilteredItems = initialCatalog.filter((i: any) => 
    i._shop?.sellable !== false && // Hide if explicitly not sellable
    (searchQuery ? i.name.toLowerCase().includes(searchQuery.toLowerCase()) : true) &&
    (selectedCategory === "all" || i._shop?.categoryName === selectedCategory)
  )

  const ownedAccessMap = new Map(ownedItemIds?.map(o => [o.catalogItemId, o.canBook]) || [])

  const ownedItems = allFilteredItems.filter(i => ownedAccessMap.has(i.id))
  const catalogItems = allFilteredItems.filter(i => !ownedAccessMap.has(i.id))

  const addToCart = (item: CatalogItem) => {
    if (ownedAccessMap.has(item.id)) {
      window.location.href = `/shop/${siteSlug}/${item.id}`
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
        localStorage.removeItem(`market-cart-${site.id}`)
        // Clean up URL
        url.searchParams.delete('success')
        url.searchParams.delete('order_id')
        window.history.replaceState({}, '', url.toString())
      } else {
        const storedCart = localStorage.getItem(`market-cart-${site.id}`)
        if (storedCart) {
          try {
            setCart(JSON.parse(storedCart))
          } catch (e) {}
        }
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
    localStorage.setItem(`market-cart-${site.id}`, JSON.stringify(cart));
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
      intent: subtotal === 0 ? 'complete' : (paymentMethod === 'cash_on_pickup' || paymentMethod === 'bank_transfer' ? 'send' : 'draft')
    })

    if (res.error) {
      toast.error(res.error)
      setCheckoutLoading(false)
    } else {
      if (subtotal > 0 && paymentMethod === 'card') {
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
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-950 min-h-screen">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 p-10 rounded-2xl shadow-xl text-center border border-gray-100 dark:border-gray-800">
          <div className="mx-auto mb-6 bg-green-100 dark:bg-green-900/30 w-20 h-20 rounded-full flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">{t('shop.success.title') || 'Order Confirmed'}</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-lg">
            {t('shop.success.desc') || "Thank you for your purchase. We've sent a confirmation email with your order details."}
          </p>

          {paymentMethod === 'bank_transfer' && site?.settings?.shop?.bank_transfer?.account_number && (
            <div className="text-left mb-8 p-4 bg-muted/30 border rounded-xl text-sm">
              <h4 className="font-bold text-base mb-2">{t('shop.bankTransfer.completePayment') || 'Complete your payment'}</h4>
              <p className="text-muted-foreground mb-4">{t('shop.bankTransfer.instruction') || 'Please transfer the total amount to the following account to process your order.'}</p>
              
              <div className="space-y-2">
                {site.settings.shop.bank_transfer.bank_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('shop.bankTransfer.bank') || 'Bank:'}</span>
                    <span className="font-medium">{site.settings.shop.bank_transfer.bank_name}</span>
                  </div>
                )}
                {site.settings.shop.bank_transfer.account_holder && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('shop.bankTransfer.accountName') || 'Account Name:'}</span>
                    <span className="font-medium">{site.settings.shop.bank_transfer.account_holder}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('shop.bankTransfer.accountIban') || 'Account / IBAN:'}</span>
                  <span className="font-medium font-mono">{site.settings.shop.bank_transfer.account_number}</span>
                </div>
                {site.settings.shop.bank_transfer.routing_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('shop.bankTransfer.routingSwift') || 'Routing / SWIFT:'}</span>
                    <span className="font-medium">{site.settings.shop.bank_transfer.routing_number}</span>
                  </div>
                )}
                {site.settings.shop.bank_transfer.instructions && (
                  <div className="pt-2 mt-2 border-t text-muted-foreground">
                    {site.settings.shop.bank_transfer.instructions}
                  </div>
                )}
              </div>
            </div>
          )}

          <Button onClick={() => {
            setOrderSuccess(false)
            setPaymentMethod('')
          }} className="w-full h-14 text-lg rounded-xl dark:text-white dark:hover:bg-gray-700 dark:hover:text-white dark:bg-gray-800">
            {t('shop.success.continueShopping') || 'Continue Shopping'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Top Spacer for floating header */}
      <div className="h-4 w-full shrink-0" />
      {/* Sticky Header */}
      <CommerceShellHeader
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
        center={
          <div className="w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder={t("shop.searchPlaceholder") || "Search products..."} 
              className="w-full pl-9 h-9 text-sm bg-muted/50 focus:bg-white dark:focus:bg-gray-950 border border-transparent focus:border-black/10 dark:focus:border-white/10 rounded-full transition-all outline-none shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        }
        actions={
          <>
            <CommerceShareControl 
              className={`relative ${shellClasses.iconButton} h-9 px-3 gap-1.5 border-0 hover:bg-black/5 dark:hover:bg-white/5 !min-w-0`}
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
                  className={`relative ${shellClasses.iconButton} h-9 px-3 gap-1.5 border-0 hover:bg-black/5 dark:hover:bg-white/5 !min-w-0`}
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
          </>
        }
      />
      
      {/* Mobile Search - Visible only on small screens */}
      <div className="md:hidden px-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input 
            type="text" 
            placeholder={t("shop.searchPlaceholder") || "Search products..."} 
            className="w-full pl-10 h-12 bg-gray-50 dark:bg-gray-900 border-transparent rounded-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Hero Section */}
      {!searchQuery && (site.settings?.shop?.hero_title || site.settings?.shop?.hero_image_url) && (
        <div className={`text-white h-[350px] md:h-[450px] px-4 md:px-8 relative overflow-hidden flex items-center bg-gray-100 dark:bg-gray-900`}>
          <div className="absolute inset-0 z-0">
            <img 
              src={site.settings?.shop?.hero_image_url || resolveItemImage({ name: site.settings?.shop?.hero_title || site.name, description: site.settings?.shop?.hero_subtitle || 'store hero' })} 
              alt="Hero" 
              onError={(e) => {
                e.currentTarget.style.opacity = '0';
              }}
              className="w-full h-full object-cover" 
            />
            {/* Gradient for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent md:bg-gradient-to-r md:from-black/80 md:via-black/50 md:to-transparent" />
          </div>
          <div className="max-w-7xl mx-auto relative z-10 text-center md:text-left flex flex-col items-center md:items-start w-full">
            {site.settings?.shop?.hero_title && (
              <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight max-w-3xl drop-shadow-md">
                {site.settings.shop.hero_title}
              </h1>
            )}
            {site.settings?.shop?.hero_subtitle && (
              <p className="text-xl text-gray-300 max-w-xl mb-10 drop-shadow-md">
                {site.settings.shop.hero_subtitle}
              </p>
            )}
            <Button className="h-14 px-8 text-lg rounded-full bg-white text-black hover:bg-gray-100 font-semibold shadow-lg" onClick={() => window.scrollBy({top: window.innerHeight * 0.7, behavior: 'smooth'})}>
              {site.settings?.shop?.hero_cta_label || t("shop.shopNow") || "Shop Now"}
            </Button>
          </div>
        </div>
      )}

      {/* Trust Bar */}
      {!searchQuery && site.settings?.shop?.trust_badges && site.settings.shop.trust_badges.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              {site.settings.shop.trust_badges.map((badge: any, i: number) => {
                const IconComponent = badge.icon === 'Truck' ? Truck : badge.icon === 'RotateCcw' ? RotateCcw : ShieldCheck
                return (
                  <div key={i} className="flex flex-col items-center justify-center gap-2">
                    <div className="bg-white dark:bg-gray-950 p-3 rounded-full shadow-sm">
                      <IconComponent className="h-6 w-6 text-black dark:text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100">{badge.title}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{badge.subtitle}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 w-full">
        {/* Category Navigation */}
        {categories.length > 0 && (
          <div className="flex overflow-x-auto gap-3 scrollbar-hide w-full items-center mb-8 pb-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
                selectedCategory === "all"
                  ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 dark:bg-transparent dark:text-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
              }`}
            >
              {t('shop.allCategories') || 'All Categories'}
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
                  selectedCategory === cat
                    ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 dark:bg-transparent dark:text-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
                }`}
            >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className={`flex flex-col sm:flex-row sm:items-center gap-4 mb-6 ${ownedItems.length > 0 ? 'justify-end' : 'justify-between'}`}>
          {ownedItems.length === 0 && (
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {searchQuery || selectedCategory !== 'all' ? (t('shop.results') || 'Results') : (t('shop.trendingNow') || 'Trending Now')}
            </h2>
          )}
          
          {ownedItems.length === 0 && (
            <div className="flex items-center gap-4">
              <span className="text-gray-500 font-medium whitespace-nowrap">
                {allFilteredItems.length} {allFilteredItems.length === 1 ? (t('shop.product') || 'product') : (t('shop.products') || 'products')}
              </span>
            </div>
          )}
        </div>

        {/* Owned Items Section */}
        {ownedItems.length > 0 && (
          <div className="mb-16">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                  {t('shop.yourAccess') || 'Your access'}
                </h2>
                <p className="text-muted-foreground mt-1 text-sm md:text-base">
                  {t('shop.yourAccessHint') || 'Book with your active plans'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-gray-500 font-medium whitespace-nowrap">
                  {ownedItems.length} {ownedItems.length === 1 ? (t('shop.product') || 'product') : (t('shop.products') || 'products')}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
              {ownedItems.map(item => (
                <CatalogListingCard
                  key={item.id}
                  item={item}
                  href={`/shop/${siteSlug}/${item.id}`}
                  onPrimaryAction={addToCart}
                  showSeller={false}
                  descriptionLineClamp="line-clamp-1"
                  primaryDisabled={!(item as any)._shop?.sellable && (item as any)._shop?.availableQty === 0}
                  disabledLabel={t('shop.soldOut') || "Sold Out"}
                  isOwned={true}
                  canBook={ownedAccessMap.get(item.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Regular Catalog Section */}
        {(catalogItems.length > 0 || ownedItems.length === 0) && (
          <div>
            {ownedItems.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                  {searchQuery || selectedCategory !== 'all' ? (t('shop.results') || 'Results') : (t('shop.trendingNow') || 'Trending Now')}
                </h2>
                <div className="flex items-center gap-4">
                  <span className="text-gray-500 font-medium whitespace-nowrap">
                    {catalogItems.length} {catalogItems.length === 1 ? (t('shop.product') || 'product') : (t('shop.products') || 'products')}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
              {catalogItems.length === 0 ? (
                <div className="col-span-full py-24 text-center">
                  <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">{t('shop.noProductsFound') || 'No products found'}</h3>
                  <p className="text-gray-500">{t('shop.tryAdjustingSearch') || 'Try adjusting your search query.'}</p>
                </div>
              ) : (
                catalogItems.map(item => (
                  <CatalogListingCard
                    key={item.id}
                    item={item}
                    href={`/shop/${siteSlug}/${item.id}`}
                    onPrimaryAction={addToCart}
                    showSeller={false}
                    descriptionLineClamp="line-clamp-1"
                    primaryDisabled={!(item as any)._shop?.sellable && (item as any)._shop?.availableQty === 0}
                    disabledLabel={t('shop.soldOut') || "Sold Out"}
                    isOwned={false}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </main>
      
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

