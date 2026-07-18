"use client"

import { useState, useMemo } from "react"
import { CatalogItem } from "@/app/types"
import { checkoutCart, CheckoutLine } from "@/app/commerce/checkout"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Card } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { toast } from "sonner"
import { Store, Archive, DatabaseIcon, ChevronDown, Plus, CreditCard } from "@/app/components/ui/icons"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/app/components/ui/sheet"

interface CartItem extends CatalogItem {
  cartQty: number;
  cartPrice: number;
}

export default function ShopClient({ site, initialCatalog, locations }: { site: any, initialCatalog: CatalogItem[], locations: any[] }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  
  const [fulfillment, setFulfillment] = useState<'pickup' | 'ship' | 'none'>('pickup')
  const [originLocationId, setOriginLocationId] = useState<string>(locations[0]?.id || '')
  
  const [shippingAddress, setShippingAddress] = useState({
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
    country: ""
  })

  // Customer details for on-the-fly lead creation
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)

  const items = initialCatalog.filter(i => 
    i.availability_mode !== 'manual' || i.availability_status === 'available'
  )

  const addToCart = (item: CatalogItem) => {
    const existing = cart.find(c => c.id === item.id)
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, cartQty: c.cartQty + 1 } : c))
    } else {
      setCart([...cart, { ...item, cartQty: 1, cartPrice: item.target_sale_price || 0 }])
    }
    toast.success(`Added ${item.name} to cart`)
    setIsCartOpen(true)
  }

  const [promotionCode, setPromotionCode] = useState("")

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
      setOrderSuccess(true)
      setCart([])
      setCheckoutLoading(false)
    }
  }

  if (orderSuccess) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-xl shadow-sm border text-center">
        <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Confirmed!</h2>
        <p className="text-gray-600 mb-6">
          Thank you for your order. We've received it and will process it shortly.
        </p>
        <Button onClick={() => setOrderSuccess(false)} className="w-full">
          Continue Shopping
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Floating Cart Button for Mobile (when not open) */}
      <div className="fixed bottom-6 right-6 z-50 md:hidden">
        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
          <SheetTrigger asChild>
            <Button size="lg" className="rounded-full h-14 w-14 shadow-lg relative">
              <Store className="h-6 w-6" />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                  {cart.reduce((s, c) => s + c.cartQty, 0)}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
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
              handleCheckout={handleCheckout}
              checkoutLoading={checkoutLoading}
            />
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Products Grid */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-xl border">
              No products available at the moment.
            </div>
          ) : (
            items.map(item => (
              <Card key={item.id} className="flex flex-col overflow-hidden hover:shadow-md transition-shadow bg-white">
                <div className="aspect-square bg-gray-50 flex items-center justify-center border-b">
                  {item.kind === 'product' ? <Archive className="h-16 w-16 text-gray-300" /> : <DatabaseIcon className="h-16 w-16 text-gray-300" />}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="font-semibold text-lg text-gray-900 mb-1">{item.name}</h3>
                  {item.description && (
                    <p className="text-sm text-gray-500 line-clamp-2 mb-4 flex-1">
                      {item.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <span className="font-bold text-lg text-gray-900">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.target_sale_price || 0)}
                    </span>
                    <Button onClick={() => addToCart(item)} size="sm">
                      Add to Cart
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Desktop Cart Sidebar */}
        <div className="hidden md:block w-96 flex-shrink-0 sticky top-6">
          <div className="bg-white rounded-xl border shadow-sm flex flex-col h-[calc(100vh-100px)]">
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
              handleCheckout={handleCheckout}
              checkoutLoading={checkoutLoading}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function CartSidebar({
  cart, subtotal, updateQty,
  customerName, setCustomerName,
  customerEmail, setCustomerEmail,
  fulfillment, setFulfillment,
  originLocationId, setOriginLocationId,
  promotionCode, setPromotionCode,
  shippingAddress, setShippingAddress,
  handleCheckout, checkoutLoading
}: any) {
  return (
    <>
      <div className="p-5 border-b bg-gray-50/50">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Store className="h-5 w-5" /> Your Cart
        </h2>
      </div>
      
      <div className="flex-1 overflow-auto p-5 space-y-4">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
            <Store className="h-12 w-12 opacity-20" />
            <p>Your cart is empty</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map((item: CartItem) => (
              <div key={item.id} className="flex gap-3 pb-4 border-b">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 leading-tight">{item.name}</h4>
                  <div className="text-gray-500 text-sm mt-1">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.cartPrice)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 justify-between">
                  <span className="font-medium text-gray-900">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.cartPrice * item.cartQty)}
                  </span>
                  <div className="flex items-center gap-1 bg-gray-50 rounded-md border p-0.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQty(item.id, -1)}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <span className="w-4 text-center text-xs font-medium">{item.cartQty}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQty(item.id, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            
            <div className="pt-2 pb-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Taxes</span>
                <span className="text-gray-400 text-sm">Calculated at checkout</span>
              </div>
            </div>
            
            <form id="checkout-form" onSubmit={handleCheckout} className="space-y-4 pt-4 border-t">
              <h3 className="font-medium">Contact Information</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs mb-1">Full Name</Label>
                  <Input required placeholder="Jane Doe" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs mb-1">Email Address</Label>
                  <Input required type="email" placeholder="jane@example.com" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs mb-1">How would you like to receive your order?</Label>
                  <Select value={fulfillment} onValueChange={setFulfillment}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pickup">Store Pickup</SelectItem>
                      <SelectItem value="ship">Ship to Me</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {fulfillment === 'ship' && (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-medium border-t pt-4 mt-2">Shipping Address</h4>
                    <Input placeholder="Street Address" value={shippingAddress?.line1} onChange={e => setShippingAddress({...shippingAddress, line1: e.target.value})} required />
                    <Input placeholder="Apt, Suite, etc. (optional)" value={shippingAddress?.line2} onChange={e => setShippingAddress({...shippingAddress, line2: e.target.value})} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="City" value={shippingAddress?.city} onChange={e => setShippingAddress({...shippingAddress, city: e.target.value})} required />
                      <Input placeholder="State / Province" value={shippingAddress?.state} onChange={e => setShippingAddress({...shippingAddress, state: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="ZIP / Postal Code" value={shippingAddress?.zip} onChange={e => setShippingAddress({...shippingAddress, zip: e.target.value})} required />
                      <Input placeholder="Country" value={shippingAddress?.country} onChange={e => setShippingAddress({...shippingAddress, country: e.target.value})} />
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <Label className="text-xs mb-1">Discount Code</Label>
                  <Input placeholder="Promo code..." value={promotionCode} onChange={e => setPromotionCode(e.target.value)} />
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      <div className="p-5 bg-gray-50 border-t">
        <Button 
          type="submit"
          form="checkout-form"
          className="w-full h-12 text-lg" 
          disabled={cart.length === 0 || checkoutLoading}
        >
          {checkoutLoading ? "Processing..." : `Checkout • ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subtotal)}`}
        </Button>
      </div>
    </>
  )
}
