"use client"

import React, { useState, useMemo, useEffect } from "react"
import { ShoppingCart, Search, Menu, X, ArrowRight, CheckCircle, ShieldCheck, Sun, Moon, User } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { toast } from "sonner"
import { checkoutCart, CheckoutLine } from "@/app/commerce/checkout"
import { CatalogItem } from "@/app/types"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { DestinationSelector } from "@/app/components/commerce/DestinationSelector"
import { resolveItemImage } from "@/app/lib/image-utils"
import { CartButton } from "@/app/components/commerce/CartButton"
import { LocaleSelector } from "@/app/components/commerce/LocaleSelector"
import { CurrencySelector } from "@/app/components/commerce/CurrencySelector"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { useTheme } from "@/app/context/ThemeContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog"
import { hasProductDetails, isAccessOnlyItem } from "@/app/catalog/product-details"
import { CatalogListingCard } from "@/app/components/commerce/CatalogListingCard"
import { getSiteInfoBySlug } from "@/app/book/actions"
import { listLocations } from "@/app/inventory/actions"
import { MarketplaceCartPanel } from "./MarketplaceCartPanel"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"

interface MarketplaceItem extends CatalogItem {
  site: {
    id: string
    name: string
    logo_url?: string | null
  }
}

interface CartItem extends MarketplaceItem {
  cartQty: number
  cartPrice: number
  reservationStart?: string
  reservationEnd?: string
}

export function MarketplaceClient({ initialItems }: { initialItems: MarketplaceItem[] }) {
  const { t } = useLocalization()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const searchParams = useSearchParams()
  const router = useRouter()
  const session = user ? { user } : null
  const [items, setItems] = useState<MarketplaceItem[]>(initialItems)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartLoaded, setIsCartLoaded] = useState(false)
  
  // Search & Filter
  const filterParam = searchParams?.get("filter")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedKind, setSelectedKind] = useState<string>(filterParam === "recurring" ? "recurring" : "all")
  const [selectedSubtype, setSelectedSubtype] = useState<string>("all")
  const [showOnlyRecurring, setShowOnlyRecurring] = useState(filterParam === "recurring")

  // Checkout states
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
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
        localStorage.removeItem('market-cart-marketplace')
        // Clean up URL
        url.searchParams.delete('success')
        url.searchParams.delete('order_id')
        window.history.replaceState({}, '', url.toString())
      } else {
        const storedCart = localStorage.getItem('market-cart-marketplace')
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
  }, [])

  // Sync cart changes to localStorage
  useEffect(() => {
    if (orderSuccess || !isCartLoaded) return;
    localStorage.setItem('market-cart-marketplace', JSON.stringify(cart));
  }, [cart, orderSuccess, isCartLoaded])

  // Handle 'recurring' as a special pseudo-kind for UI
  const effectiveKind = selectedKind === 'recurring' ? 'all' : selectedKind;
  const showOnlyRecurringFilter = showOnlyRecurring || selectedKind === 'recurring';

  const filteredItems = items.filter(i => {
    if (searchQuery && !i.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (effectiveKind !== 'all' && i.kind !== effectiveKind) return false
    if (effectiveKind === 'digital_asset' && selectedSubtype !== 'all' && i.digital_subtype !== selectedSubtype) return false
    if (showOnlyRecurringFilter && !i.is_recurring) return false
    return true
  })

  const addToCart = (item: MarketplaceItem) => {
    if (item.is_reservation && !isAccessOnlyItem(item)) {
      router.push(`/marketplace/${item.id}/book`)
      return
    }

    const existing = cart.find(c => c.id === item.id)
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, cartQty: c.cartQty + 1 } : c))
    } else {
      setCart([...cart, { ...item, cartQty: 1, cartPrice: item.target_sale_price || 0 }])
    }
    toast.success(`${item.name} ${t('marketplace.addedToCart') || 'added to cart'}`)
    setIsCartOpen(true)
  }

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
      source: 'marketplace',
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
      <div className="flex-1 flex items-center justify-center p-6 bg-muted/30 min-h-screen">
        <div className="max-w-md w-full bg-card p-10 rounded-2xl shadow-xl text-center border">
          <div className="mx-auto mb-6 bg-green-100 dark:bg-green-900/30 w-20 h-20 rounded-full flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-3xl font-bold mb-4">{t('marketplace.success.title') || 'Order Confirmed'}</h2>
          <p className="text-muted-foreground mb-6 text-lg">
            {t('marketplace.success.desc') || "Thank you for your purchase. We've sent a confirmation email with your order details."}
          </p>

          {paymentMethod === 'bank_transfer' && siteSettings?.shop?.bank_transfer?.account_number && (
            <div className="text-left mb-8 p-4 bg-muted/30 border rounded-xl text-sm">
              <h4 className="font-bold text-base mb-2">Complete your payment</h4>
              <p className="text-muted-foreground mb-4">Please transfer the total amount to the following account to process your order.</p>
              
              <div className="space-y-2">
                {siteSettings.shop.bank_transfer.bank_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank:</span>
                    <span className="font-medium">{siteSettings.shop.bank_transfer.bank_name}</span>
                  </div>
                )}
                {siteSettings.shop.bank_transfer.account_holder && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account Name:</span>
                    <span className="font-medium">{siteSettings.shop.bank_transfer.account_holder}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account / IBAN:</span>
                  <span className="font-medium font-mono">{siteSettings.shop.bank_transfer.account_number}</span>
                </div>
                {siteSettings.shop.bank_transfer.routing_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Routing / SWIFT:</span>
                    <span className="font-medium">{siteSettings.shop.bank_transfer.routing_number}</span>
                  </div>
                )}
                {siteSettings.shop.bank_transfer.instructions && (
                  <div className="pt-2 mt-2 border-t text-muted-foreground">
                    {siteSettings.shop.bank_transfer.instructions}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Link href={returnTo?.startsWith('/') ? returnTo : "/buyer"}>
              <Button className="w-full h-14 text-lg rounded-xl">
                {t('marketplace.success.viewPurchases') || 'View My Purchases'}
              </Button>
            </Link>
            <Button variant="outline" onClick={() => {
              setOrderSuccess(false)
              setPaymentMethod('')
            }} className="w-full h-14 text-lg rounded-xl">
              {t('marketplace.success.continueShopping') || 'Continue Shopping'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Spacer for floating header */}
      <div className="h-4 w-full shrink-0" />
      <CommerceShellHeader
        mobileLeading={
          <button className={`md:hidden ${shellClasses.iconButton}`} onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
        }
        brand={
          <Link href="/marketplace" className="text-xl font-black tracking-tight text-primary hover:opacity-80 transition-opacity">
            MARKETPLACE
          </Link>
        }
        center={
          <div className="w-full max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="search" 
              placeholder={t('marketplace.searchPlaceholder') || "Search everything..."} 
              className="w-full pl-9 h-9 text-sm bg-muted/50 focus:bg-white dark:focus:bg-gray-950 border border-transparent focus:border-black/10 dark:focus:border-white/10 rounded-full transition-all outline-none shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        }
        actions={
          <>
            <CartButton 
              cartCount={cartCount} 
              subtotal={subtotal} 
              currency={cart[0]?.currency}
              onClick={() => setIsCartOpen(true)}
              variant="shell"
              className={`relative ${shellClasses.iconButton} h-9 px-3 gap-1.5 border-0 hover:bg-black/5 dark:hover:bg-white/5 !min-w-0`}
              iconClassName="h-4 w-4"
            />
            
            <LocaleSelector className={`${shellClasses.iconButton} h-9 w-9`} />
            <button className={`${shellClasses.iconButton} h-9 w-9 relative`} onClick={toggleTheme}>
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">{t("buyer.layout.footer.toggleTheme") || "Toggle theme"}</span>
            </button>

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
                href={`/auth?returnTo=${encodeURIComponent("/marketplace")}`}
                className={`${shellClasses.primaryCta} ml-1`}
              >
                {t('marketplace.signIn') || 'Sign In'}
              </Link>
            )}
          </>
        }
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-12">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="w-full md:w-64 shrink-0 space-y-8 hidden md:block sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto overflow-x-hidden pb-4">
            <div>
              <h3 className="font-bold text-lg mb-4">{t('marketplace.categories.title') || 'Categories'}</h3>
              <div className="space-y-1">
                <button onClick={() => setSelectedKind("all")} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedKind === "all" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>{t('marketplace.categories.all') || 'All Items'}</button>
                <button onClick={() => setSelectedKind("product")} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedKind === "product" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>{t('marketplace.categories.products') || 'Products'}</button>
                <button onClick={() => setSelectedKind("service")} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedKind === "service" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>{t('marketplace.categories.services') || 'Services'}</button>
                <button onClick={() => setSelectedKind("digital_asset")} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedKind === "digital_asset" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>{t('marketplace.categories.digitalAssets') || 'Digital Assets'}</button>
                <button onClick={() => setSelectedKind("recurring")} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedKind === "recurring" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>{t('marketplace.categories.subscriptions') || 'Subscriptions'}</button>
              </div>
            </div>
            
            {effectiveKind === 'digital_asset' && (
              <div>
                <h3 className="font-bold text-lg mb-4">{t('marketplace.subtypes.title') || 'Subtypes'}</h3>
                <div className="space-y-1">
                  <button onClick={() => setSelectedSubtype("all")} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedSubtype === "all" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>{t('marketplace.subtypes.all') || 'All'}</button>
                  <button onClick={() => setSelectedSubtype("course")} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedSubtype === "course" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>{t('marketplace.subtypes.courses') || 'Courses'}</button>
                  <button onClick={() => setSelectedSubtype("ticket")} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedSubtype === "ticket" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>{t('marketplace.subtypes.tickets') || 'Tickets'}</button>
                  <button onClick={() => setSelectedSubtype("pass")} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedSubtype === "pass" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>{t('marketplace.subtypes.passes') || 'Passes'}</button>
                  <button onClick={() => setSelectedSubtype("license")} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedSubtype === "license" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>{t('marketplace.subtypes.licenses') || 'Licenses'}</button>
                  <button onClick={() => setSelectedSubtype("file")} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedSubtype === "file" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>{t('marketplace.subtypes.files') || 'Files'}</button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map(item => (
                <CatalogListingCard 
                  key={item.id}
                  item={item}
                  href={`/marketplace/${item.id}`}
                  onPrimaryAction={addToCart}
                  showSeller={true}
                  descriptionLineClamp="line-clamp-2"
                />
              ))}
            </div>
            
            {filteredItems.length === 0 && (
              <div className="text-center py-20 px-4">
                <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">
                  {items.length === 0 ? (t('marketplace.empty.title') || "No marketplace listings yet") : (t('marketplace.noResults') || "No results found")}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {items.length === 0
                    ? (t('marketplace.empty.desc') || "Sellers can list catalog items on the marketplace by enabling the Marketplace toggle on each item.")
                    : (t('marketplace.noResultsDesc') || "Try adjusting your search or filters to find what you're looking for.")}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Cart Overlay */}
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
          siteSettings={siteSettings}
          handleCheckout={handleCheckout}
          checkoutLoading={checkoutLoading}
          setIsCartOpen={setIsCartOpen}
          t={t}
        />
      )}

      {/* Footer */}
      <footer className="bg-muted/30 border-t py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between gap-8">
          <div>
            <div className="text-2xl font-black tracking-tight text-primary mb-2">MARKETPLACE</div>
            <div className="text-sm text-muted-foreground mb-4 max-w-sm">
              {t('marketplace.footer.desc') || 'Discover and purchase products, services, and digital assets.'}
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              &copy; {new Date().getFullYear()} Makinari Inc. {t('marketplace.footer.rights') || 'All rights reserved.'}
            </div>
            <div className="flex items-center gap-2">
               <CurrencySelector className="rounded-full" />
               <LocaleSelector className="rounded-full" />
               <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
                 {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
               </Button>
            </div>
          </div>
          <div className="flex gap-12">
            <div>
              <h4 className="font-bold mb-4">{t('marketplace.categories.title') || 'Categories'}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button onClick={() => { setSelectedKind("all"); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="hover:text-foreground transition-colors">{t('marketplace.categories.all') || 'All Items'}</button></li>
                <li><button onClick={() => { setSelectedKind("product"); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="hover:text-foreground transition-colors">{t('marketplace.categories.products') || 'Products'}</button></li>
                <li><button onClick={() => { setSelectedKind("service"); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="hover:text-foreground transition-colors">{t('marketplace.categories.services') || 'Services'}</button></li>
                <li><button onClick={() => { setSelectedKind("digital_asset"); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="hover:text-foreground transition-colors">{t('marketplace.categories.digitalAssets') || 'Digital Assets'}</button></li>
                <li><button onClick={() => { setSelectedKind("recurring"); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="hover:text-foreground transition-colors">{t('marketplace.categories.subscriptions') || 'Subscriptions'}</button></li>
              </ul>
            </div>
            {effectiveKind === 'digital_asset' && (
              <div>
                <h4 className="font-bold mb-4">{t('marketplace.subtypes.title') || 'Subtypes'}</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><button onClick={() => { setSelectedSubtype("all"); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="hover:text-foreground transition-colors">{t('marketplace.subtypes.all') || 'All'}</button></li>
                  <li><button onClick={() => { setSelectedSubtype("course"); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="hover:text-foreground transition-colors">{t('marketplace.subtypes.courses') || 'Courses'}</button></li>
                  <li><button onClick={() => { setSelectedSubtype("ticket"); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="hover:text-foreground transition-colors">{t('marketplace.subtypes.tickets') || 'Tickets'}</button></li>
                  <li><button onClick={() => { setSelectedSubtype("pass"); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="hover:text-foreground transition-colors">{t('marketplace.subtypes.passes') || 'Passes'}</button></li>
                  <li><button onClick={() => { setSelectedSubtype("license"); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="hover:text-foreground transition-colors">{t('marketplace.subtypes.licenses') || 'Licenses'}</button></li>
                  <li><button onClick={() => { setSelectedSubtype("file"); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="hover:text-foreground transition-colors">{t('marketplace.subtypes.files') || 'Files'}</button></li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
