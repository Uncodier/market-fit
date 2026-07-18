"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { listCatalogItems } from "@/app/catalog/actions"
import { resolveUnitPrice } from "@/app/price-lists/actions"
import { checkoutCart, CheckoutLine } from "@/app/commerce/checkout"
import { CatalogItem } from "@/app/types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { SearchInput } from "@/app/components/ui/search-input"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Input } from "@/app/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/app/components/ui/sheet"
import { toast } from "sonner"
import { Archive, Store, Search, X, Plus, ChevronDown, CreditCard, DatabaseIcon, ShoppingCart } from "@/app/components/ui/icons"
import { SimpleSearchSelect } from "@/app/components/ui/simple-search-select"
import { listLocations } from "@/app/inventory/actions"
import { getLeads } from "@/app/leads/actions"
import { useRouter } from "next/navigation"

interface CartItem extends CatalogItem {
  cartQty: number;
  cartPrice: number; // resolved price
}

export default function POSPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const { user } = useAuth()
  const router = useRouter()
  
  const [searchQuery, setSearchQuery] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  
  // Checkout states
  const [leadId, setLeadId] = useState<string | undefined>(undefined)
  const [fulfillment, setFulfillment] = useState<'pickup' | 'ship' | 'dine_in' | 'none'>('none')
  const [originLocationId, setOriginLocationId] = useState<string>("")
  const [promotionCode, setPromotionCode] = useState("")
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)

  // Fetch sellable catalog items (can be optimized to only show active)
  const { data: catalogData, isLoading: catalogLoading } = useSWR(
    currentSite?.id ? ['pos_catalog', currentSite.id, searchQuery] : null,
    () => listCatalogItems({ siteId: currentSite!.id, status: 'active', q: searchQuery, pageSize: 100 })
  )

  const { data: locationsData } = useSWR(currentSite?.id ? ['locations', currentSite.id] : null, () => listLocations(currentSite!.id))
  const { data: leadsData } = useSWR(currentSite?.id ? ['leads', currentSite.id] : null, () => getLeads(currentSite!.id))

  const items = catalogData?.data || []
  const locations = locationsData?.data || []
  
  // Set default location if empty
  useEffect(() => {
    if (locations.length > 0 && !originLocationId) {
      const def = locations.find((l: any) => l.is_default) || locations[0]
      if (def) setOriginLocationId(def.id)
    }
  }, [locations, originLocationId])

  const addToCart = async (item: CatalogItem) => {
    if (!currentSite) return
    
    // Check if unavailable
    if (item.availability_mode === 'manual' && item.availability_status !== 'available') {
      toast.error("Item is not available")
      return
    }

    const existing = cart.find(c => c.id === item.id)
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, cartQty: c.cartQty + 1 } : c))
    } else {
      // Fetch resolved price (using resolveUnitPrice server action)
      const res = await resolveUnitPrice(currentSite.id, item.id);
      const price = res.price || item.target_sale_price || 0
      setCart([...cart, { ...item, cartQty: 1, cartPrice: price }])
    }
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

  const handleCheckout = async () => {
    if (!currentSite || !user) return
    if (cart.length === 0) return
    
    if (!originLocationId) {
      toast.error("Select an origin location")
      return
    }

    if (fulfillment === 'ship' && (!leadId || leadId === 'none')) {
      toast.error("Select a customer for shipping")
      return
    }

    setCheckoutLoading(true)
    
    const lines: CheckoutLine[] = cart.map(c => ({
      catalogItemId: c.id,
      quantity: c.cartQty
    }))

    const res = await checkoutCart({
      siteId: currentSite.id,
      userId: user.id,
      lines,
      leadId: leadId === 'none' ? undefined : leadId,
      fulfillment,
      originLocationId: originLocationId,
      promotionCode: promotionCode || undefined,
      source: 'pos'
    })

    if (res.error) {
      toast.error(res.error)
      setCheckoutLoading(false)
      return
    }

    toast.success("Checkout complete!")
    setCart([])
    setLeadId(undefined)
    setPromotionCode("")
    if (res.saleId) {
      router.push(`/sales/${res.saleId}?artifact=true`)
    }
    
    setCheckoutLoading(false)
  }

  useEffect(() => {
    // Si queremos un titulo especial
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: t('layout.sidebar.pos') || 'Point of Sale'
      }
    });
    window.dispatchEvent(event);
  }, [t]);

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-gray-50/30">
      <StickyHeader>
        <div className="w-full pt-0 flex justify-end md:hidden">
          <Sheet open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
            <SheetContent className="w-full sm:max-w-md p-0 flex flex-col z-[100]">
              <CartPanel 
                cart={cart}
                subtotal={subtotal}
                updateQty={updateQty}
                leadId={leadId}
                setLeadId={setLeadId}
                fulfillment={fulfillment}
                setFulfillment={setFulfillment}
                originLocationId={originLocationId}
                setOriginLocationId={setOriginLocationId}
                promotionCode={promotionCode}
                setPromotionCode={setPromotionCode}
                handleCheckout={handleCheckout}
                checkoutLoading={checkoutLoading}
                leads={leadsData?.leads || []}
                locations={locations}
                isMobile={true}
                closeCart={() => setIsMobileCartOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>
        
        <div className="w-full pt-0">
          <SearchInput 
            placeholder="Search catalog..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>
      </StickyHeader>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Catalog Grid */}
        <div className="flex-1 flex flex-col overflow-hidden border-r bg-gray-50/50">
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {catalogLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <Card key={i} className="animate-pulse h-32"></Card>
                ))
              ) : items.length === 0 ? (
                <div className="col-span-full py-12 text-center text-gray-500">
                  No items found.
                </div>
              ) : (
                items.map(item => {
                  const isAvailable = item.availability_mode !== 'manual' || item.availability_status === 'available'
                  return (
                    <Card 
                      key={item.id} 
                      className={`cursor-pointer transition-shadow hover:shadow-md overflow-hidden flex flex-col h-full ${!isAvailable ? 'opacity-50 grayscale' : ''}`}
                      onClick={() => isAvailable && addToCart(item)}
                    >
                      <div className="p-4 flex-1 flex flex-col">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 text-gray-400">
                            {item.kind === 'product' ? <Archive className="h-4 w-4" /> : <DatabaseIcon className="h-4 w-4" />}
                          </div>
                          <h3 className="font-medium text-sm text-gray-900 line-clamp-2 leading-snug">{item.name}</h3>
                          {item.sku && <p className="text-xs text-gray-500 font-mono mt-1">{item.sku}</p>}
                        </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-bold text-gray-900">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.cartPrice || item.target_sale_price || 0)}
                  </span>
                  {!isAvailable && (
                            <Badge variant="outline" className="text-[10px] text-red-500 border-red-200">Sold Out</Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Right: Cart (Desktop) */}
        <div className="hidden md:flex w-96 flex-col bg-white">
          <CartPanel 
            cart={cart}
            subtotal={subtotal}
            updateQty={updateQty}
            leadId={leadId}
            setLeadId={setLeadId}
            fulfillment={fulfillment}
            setFulfillment={setFulfillment}
            originLocationId={originLocationId}
            setOriginLocationId={setOriginLocationId}
            promotionCode={promotionCode}
            setPromotionCode={setPromotionCode}
            handleCheckout={handleCheckout}
            checkoutLoading={checkoutLoading}
            leads={leadsData?.leads || []}
            locations={locations}
          />
        </div>
      </div>
    </div>
  )
}

function CartPanel({ 
  cart, subtotal, updateQty,
  leadId, setLeadId,
  fulfillment, setFulfillment,
  originLocationId, setOriginLocationId,
  promotionCode, setPromotionCode,
  handleCheckout, checkoutLoading,
  leads, locations
}: any) {
  return (
    <>
      <div className="p-4 border-b bg-gray-50/50">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Store className="h-5 w-5 text-gray-500" /> Current Order
        </h2>
      </div>
      
      {/* Cart Items */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
            <Store className="h-12 w-12 opacity-20" />
            <p>Cart is empty</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((item: CartItem) => (
              <div key={item.id} className="flex items-center gap-3 bg-white p-3 rounded-lg border shadow-sm">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-gray-900 truncate">{item.name}</h4>
                  <div className="text-gray-500 text-xs mt-0.5">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.cartPrice)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-6 w-6 rounded-full" onClick={() => updateQty(item.id, -1)}>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <span className="w-4 text-center text-sm font-medium">{item.cartQty}</span>
                  <Button variant="outline" size="icon" className="h-6 w-6 rounded-full" onClick={() => updateQty(item.id, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Checkout Controls */}
      <div className="p-4 bg-gray-50 border-t space-y-4">
        <div className="space-y-3">
          <Select value={leadId || 'none'} onValueChange={setLeadId}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Walk-in Customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-gray-500 italic">Walk-in Customer</SelectItem>
              {leads.map((l: any) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={fulfillment} onValueChange={setFulfillment}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Fulfillment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Carry Out / Walk-in</SelectItem>
              <SelectItem value="pickup">Store Pickup</SelectItem>
              <SelectItem value="dine_in">Dine In</SelectItem>
              <SelectItem value="ship">Ship to Customer</SelectItem>
            </SelectContent>
          </Select>
          
          {fulfillment !== 'none' && (
            <Select value={originLocationId} onValueChange={setOriginLocationId}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder={fulfillment === 'ship' ? "Ship From Location" : "Origin Location"} />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>From: {l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex gap-2">
            <Input 
              placeholder="Promo code..." 
              value={promotionCode} 
              onChange={e => setPromotionCode(e.target.value)}
              className="bg-white uppercase"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600">Subtotal</span>
            <span className="text-xl font-bold text-gray-900">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subtotal)}
            </span>
          </div>
          <Button 
            className="w-full h-12 text-lg" 
            disabled={cart.length === 0 || checkoutLoading}
            onClick={handleCheckout}
          >
            <CreditCard className="h-5 w-5 mr-2" />
            {checkoutLoading ? "Processing..." : "Charge"}
          </Button>
        </div>
      </div>
    </>
  )
}
