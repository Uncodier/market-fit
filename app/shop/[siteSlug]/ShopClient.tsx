"use client"

import { useState, useEffect, useMemo } from "react"
import { CatalogItem } from "@/app/types"
import { checkoutCart, CheckoutLine } from "@/app/commerce/checkout"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { DestinationSelector } from "@/app/components/commerce/DestinationSelector"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { toast } from "sonner"
import { 
  ShoppingCart, Archive, DatabaseIcon, ChevronDown, Plus, 
  ShieldCheck, Truck, RotateCcw, Star, Search, Menu, CreditCard, CheckCircle,
  Moon, Sun
} from "@/app/components/ui/icons"
import { useTheme } from "@/app/context/ThemeContext"
import { resolveItemImage } from "@/app/lib/image-utils"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/app/components/ui/sheet"

interface CartItem extends CatalogItem {
  cartQty: number;
  cartPrice: number;
}

export default function ShopClient({ site, initialCatalog, locations }: { site: any, initialCatalog: CatalogItem[], locations: any[] }) {
  const { theme, toggleTheme } = useTheme()
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
  const [fulfillment, setFulfillment] = useState<'pickup' | 'ship' | 'none'>('ship')
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
  
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

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

  const items = initialCatalog.filter((i: any) => 
    i._shop?.sellable !== false && // Hide if explicitly not sellable
    (searchQuery ? i.name.toLowerCase().includes(searchQuery.toLowerCase()) : true) &&
    (selectedCategory === "all" || i._shop?.categoryName === selectedCategory)
  )

  const addToCart = (item: CatalogItem) => {
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
        // Clean up URL
        url.searchParams.delete('success')
        url.searchParams.delete('order_id')
        window.history.replaceState({}, '', url.toString())
      }
    }
  }, [])

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
    
    if (!customerName || !customerEmail) {
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

    setCheckoutLoading(true)
    
    const lines: CheckoutLine[] = cart.map(c => ({
      catalogItemId: c.id,
      quantity: c.cartQty
    }))

    const res = await checkoutCart({
      siteId: site.id,
      lines,
      customerName,
      customerEmail,
      buyerUserId: session?.user?.id,
      ownerSiteId: ownerSiteId,
      fulfillment,
      originLocationId: originLocationId,
      shippingAddress: fulfillment === 'ship' ? shippingAddress : undefined,
      promotionCode: promotionCode || undefined,
      source: 'shop'
    })

    if (res.error) {
      toast.error(res.error)
      setCheckoutLoading(false)
    } else {
      if (subtotal > 0) {
        // Redirect to Stripe
        try {
          const stripeRes = await fetch('/api/stripe/checkout/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: res.orderId,
              siteId: site.id,
              returnUrl: window.location.origin + '/shop/' + site.slug
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
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Order Confirmed</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 text-lg">
            Thank you for your purchase. We've sent a confirmation email with your order details.
          </p>
          <Button onClick={() => setOrderSuccess(false)} className="w-full h-14 text-lg rounded-xl hover:text-black dark:text-white dark:hover:bg-gray-700 dark:hover:text-white dark:bg-gray-800">
            Continue Shopping
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 w-full bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo area */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMobileMenuOpen(true)}>
                <Menu className="h-6 w-6" />
              </Button>
              {site.logo_url ? (
                <img src={site.logo_url} alt={site.name} className="h-8 max-w-[200px] object-contain" />
              ) : (
                <span className="text-2xl font-black tracking-tight text-gray-900 truncate max-w-[200px] md:max-w-none">
                  {site.name}
                </span>
              )}
            </div>

            {/* Search - Desktop */}
            <div className="hidden md:flex flex-1 max-w-md mx-8 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input 
                type="search" 
                placeholder="Search products..." 
                className="w-full pl-10 h-12 bg-gray-50 dark:bg-gray-900 border-transparent focus:bg-white dark:focus:bg-gray-950 focus:border-black dark:focus:border-white rounded-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Cart trigger */}
            <div className="flex items-center">
              <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" className="relative p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full h-12 w-12 hover:text-black dark:hover:text-white">
                    <ShoppingCart className="h-6 w-6" />
                    {cartCount > 0 && (
                      <span className="absolute top-1 right-1 bg-black text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                        {cartCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-white border-l-0 shadow-2xl">
                  <SheetTitle className="sr-only">Shopping Cart</SheetTitle>
                  <CartSidebar 
                    cart={cart}
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
                  />
                </SheetContent>
              </Sheet>
            </div>
          </div>
          
          {/* Mobile Search - Visible only on small screens */}
          <div className="md:hidden pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input 
                type="search" 
                placeholder="Search products..." 
                className="w-full pl-10 h-12 bg-gray-50 dark:bg-gray-900 border-transparent rounded-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      {!searchQuery && site.settings?.shop?.hero_title && (
        <div className="bg-gray-900 text-white py-20 px-4 relative overflow-hidden">
          {site.settings?.shop?.hero_image_url && (
            <div className="absolute inset-0 z-0">
              <img src={site.settings.shop.hero_image_url} alt="Hero" className="w-full h-full object-cover opacity-40" />
            </div>
          )}
          <div className="max-w-7xl mx-auto relative z-10 text-center md:text-left flex flex-col items-center md:items-start">
            <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight max-w-3xl">
              {site.settings.shop.hero_title}
            </h1>
            {site.settings?.shop?.hero_subtitle && (
              <p className="text-xl text-gray-300 max-w-xl mb-10">
                {site.settings.shop.hero_subtitle}
              </p>
            )}
            <Button className="h-14 px-8 text-lg rounded-full bg-white text-black hover:bg-gray-100 font-semibold" onClick={() => window.scrollBy({top: window.innerHeight * 0.7, behavior: 'smooth'})}>
              {site.settings?.shop?.hero_cta_label || "Shop Now"}
            </Button>
          </div>
          {/* Decorative background shape */}
          {!site.settings?.shop?.hero_image_url && (
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-white/10 to-transparent transform skew-x-12 translate-x-32 hidden md:block" />
          )}
        </div>
      )}

      {/* Trust Bar */}
      {!searchQuery && site.settings?.shop?.trust_badges && site.settings.shop.trust_badges.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-4 py-6">
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
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {searchQuery || selectedCategory !== 'all' ? 'Results' : 'Trending Now'}
          </h2>
          
          <div className="flex items-center gap-4">
            {categories.length > 0 && (
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px] h-10 rounded-full bg-gray-50 dark:bg-gray-900 border-transparent">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <span className="text-gray-500 font-medium whitespace-nowrap">{items.length} products</span>
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12">
          {items.length === 0 ? (
            <div className="col-span-full py-24 text-center">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No products found</h3>
              <p className="text-gray-500">Try adjusting your search query.</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="group flex flex-col relative">
                {/* Image / Placeholder */}
                <div className="aspect-[4/5] bg-gray-100 rounded-2xl overflow-hidden mb-4 relative">
                  <div className="absolute inset-0 flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
                    <img src={resolveItemImage(item)} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 flex flex-col">
                  {(item as any)._shop?.categoryName && (
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                      {(item as any)._shop.categoryName}
                    </span>
                  )}
                  <h3 className="font-semibold text-lg text-gray-900 leading-tight mb-1">{item.name}</h3>
                  {item.description && (
                    <p className="text-sm text-gray-500 line-clamp-1 mb-3">
                      {item.description}
                    </p>
                  )}
                  <div className="mt-auto pt-2 flex items-center justify-between">
                    <span className="font-bold text-xl text-gray-900">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.target_sale_price || 0)}
                    </span>
                    {(item as any)._shop?.availableQty !== undefined && (item as any)._shop.availableQty <= 5 && (item as any)._shop.availableQty > 0 && (
                      <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-md">
                        Only {(item as any)._shop.availableQty} left
                      </span>
                    )}
                  </div>
                </div>

                {/* CTA - Full width on mobile, prominent on desktop */}
                {!(item as any)._shop?.sellable && (item as any)._shop?.availableQty === 0 ? (
                  <Button 
                    disabled
                    className="w-full mt-4 h-12 rounded-xl bg-gray-100 text-gray-400 font-semibold shadow-none cursor-not-allowed"
                  >
                    Sold Out
                  </Button>
                ) : (
                  <Button 
                    onClick={() => addToCart(item)} 
                    className="w-full mt-4 h-12 rounded-xl bg-gray-900 text-white hover:bg-gray-100 hover:text-black dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:hover:text-white font-semibold shadow-sm transition-all active:scale-[0.98]"
                  >
                    Add to Cart
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-2xl font-black tracking-tight text-gray-400 dark:text-gray-600">{site.name}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} {site.name}. All rights reserved. Powered by Uncodie.
          </div>
          <div className="flex items-center gap-4">
            <CreditCard className="h-8 w-8 text-gray-300 dark:text-gray-700" />
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
              <span>Checkout</span>
            </div>
            <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subtotal)}</span>
          </Button>
        </div>
      )}
    </div>
  )
}

export function CartSidebar({
  cart, subtotal, updateQty,
  customerName, setCustomerName,
  customerEmail, setCustomerEmail,
  fulfillment, setFulfillment,
  originLocationId, setOriginLocationId,
  promotionCode, setPromotionCode,
  shippingAddress, setShippingAddress,
  ownerSiteId, setOwnerSiteId,
  handleCheckout, checkoutLoading, closeCart, site
}: any) {
  return (
    <div className="flex flex-col h-full bg-gray-50/30 dark:bg-gray-950">
      <div className="px-6 py-5 flex items-center justify-between border-b dark:border-gray-800 bg-white dark:bg-gray-950">
        <h2 className="font-bold text-xl text-gray-900 dark:text-gray-100 tracking-tight">Your Cart</h2>
        <span className="text-gray-500 text-sm font-medium">{cart.length} items</span>
      </div>
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-6">
            <ShoppingCart className="h-16 w-16 opacity-20" />
            <div className="text-center">
              <p className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</p>
              <p className="text-sm">Looks like you haven't added anything yet.</p>
            </div>
            <Button variant="outline" className="mt-4 rounded-xl hover:text-black dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white dark:border-gray-700" onClick={closeCart}>
              Continue Shopping
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Items */}
            <div className="space-y-4">
              {cart.map((item: CartItem) => (
                <div key={item.id} className="flex gap-4 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                  <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0">
                     <img src={resolveItemImage(item)} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">{item.name}</h4>
                      <div className="text-gray-500 dark:text-gray-400 text-sm mt-1 font-medium">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.cartPrice)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => updateQty(item.id, -1)}>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <span className="w-6 text-center text-sm font-bold dark:text-white">{item.cartQty}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md bg-white dark:bg-gray-700 shadow-sm" onClick={() => updateQty(item.id, 1)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.cartPrice * item.cartQty)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Checkout Form */}
            <form id="checkout-form" onSubmit={handleCheckout} className="space-y-5 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
              <h3 className="font-bold text-lg border-b dark:border-gray-800 pb-3">Contact & Shipping</h3>
              
              <div className="space-y-4 pt-2">
                <DestinationSelector 
                  value={ownerSiteId} 
                  onChange={setOwnerSiteId} 
                />

                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Full Name</Label>
                  <Input required placeholder="Jane Doe" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800" />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Email Address</Label>
                  <Input required type="email" placeholder="jane@example.com" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800" />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Delivery Method</Label>
                  <Select value={fulfillment} onValueChange={setFulfillment}>
                    <SelectTrigger className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pickup">Store Pickup</SelectItem>
                      <SelectItem value="ship">Ship to Me</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {fulfillment === 'ship' && (
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <Label className="text-xs font-bold uppercase tracking-wider text-gray-500 block">Shipping Address</Label>
                    <Input placeholder="Street Address" value={shippingAddress?.line1} onChange={e => setShippingAddress({...shippingAddress, line1: e.target.value})} required className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800" />
                    <Input placeholder="Apt, Suite, etc. (optional)" value={shippingAddress?.line2} onChange={e => setShippingAddress({...shippingAddress, line2: e.target.value})} className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="City" value={shippingAddress?.city} onChange={e => setShippingAddress({...shippingAddress, city: e.target.value})} required className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800" />
                      <Input placeholder="State" value={shippingAddress?.state} onChange={e => setShippingAddress({...shippingAddress, state: e.target.value})} className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="ZIP Code" value={shippingAddress?.zip} onChange={e => setShippingAddress({...shippingAddress, zip: e.target.value})} required className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800" />
                      <Input placeholder="Country" value={shippingAddress?.country} onChange={e => setShippingAddress({...shippingAddress, country: e.target.value})} className="h-12 rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800" />
                    </div>
                  </div>
                )}
              </div>
            </form>

            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
              <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                <span>Subtotal</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-500 dark:text-gray-400">
                <span>Shipping</span>
                {site?.settings?.shop?.free_shipping_threshold && subtotal >= site.settings.shop.free_shipping_threshold ? (
                  <span className="font-medium text-green-600 dark:text-green-400">Free</span>
                ) : (
                  <span className="font-medium text-gray-900 dark:text-gray-100">Calculated at next step</span>
                )}
              </div>
              <div className="pt-3 border-t dark:border-gray-800 flex justify-between items-center">
                <span className="font-bold text-lg">Total</span>
                <span className="font-black text-2xl text-gray-900 dark:text-gray-100">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subtotal)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 bg-white dark:bg-gray-950 border-t dark:border-gray-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-none">
        <Button 
          type="submit"
          form="checkout-form"
          className="w-full h-14 text-lg font-bold rounded-xl shadow-md transition-all active:scale-[0.98] bg-gray-900 text-white hover:bg-gray-100 hover:text-black dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:hover:text-white" 
          disabled={cart.length === 0 || checkoutLoading}
        >
          {checkoutLoading ? "Processing securely..." : `Checkout • ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subtotal)}`}
        </Button>
        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400 font-medium">
          <ShieldCheck className="h-4 w-4" />
          Secure checkout powered by Stripe
        </div>
      </div>
    </div>
  )
}
