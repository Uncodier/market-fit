"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/app/components/ui/sheet"
import { Button } from "@/app/components/ui/button"
import { Textarea } from "@/app/components/ui/textarea"
import { Input } from "@/app/components/ui/input"
import { Minus, Plus } from "@/app/components/ui/icons"
import { cartLineExtendedTotal, cartLineKey } from "@/app/commerce/cart-modifiers"
import { isItemCompatibleWithFulfillment } from "@/app/commerce/delivery-options"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import type { CheckoutCartSuccess } from "@/app/commerce/checkout-client"
import { runSelfServiceCheckout } from "./run-self-service-checkout"
import { useSelfService } from "./SelfServiceProvider"
import { BuyerIdentityScan } from "./BuyerIdentityScan"
import { recoverSelfServiceAttempt } from "./self-service-attempt"

export function SelfServiceCart({ open, onOpenChange, onSuccess }: {
  open: boolean; onOpenChange: (open: boolean) => void; onSuccess: (result: CheckoutCartSuccess) => void
}) {
  const { context, cart, identity, setIdentity, fulfillment, updateQty, promotion, setPromotion, clearOrder, ready } = useSelfService()
  const { formatPrice } = useDisplayCurrency()
  const [notes, setNotes] = useState("")
  const [coupon, setCoupon] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [scanOpen, setScanOpen] = useState(false)
  const subtotal = cart.reduce((sum, line) => sum + cartLineExtendedTotal(line), 0)
  const incompatible = cart.some((line) => !isItemCompatibleWithFulfillment(line, fulfillment))
  const currency = cart[0]?.currency || context.site.settings?.currency || "USD"

  async function checkout(event: React.FormEvent) {
    event.preventDefault()
    if (loading || !ready) return
    setLoading(true)
    setError("")
    try {
      const recovered = await recoverSelfServiceAttempt(context.location.id)
      if (recovered) { clearOrder(); onOpenChange(false); onSuccess(recovered); return }
      if (!cart.length || incompatible) return
      if (fulfillment !== "pickup" && fulfillment !== "dine_in") throw new Error("Select pickup or dine in.")
      const result = await runSelfServiceCheckout({
        siteId: context.site.id, locationId: context.location.id, cart, fulfillment,
        buyerIdentityQr: identity?.code, promotion: coupon.trim() ? { id: "", code: coupon.trim() } : promotion, notes,
      })
      clearOrder()
      setNotes("")
      setCoupon("")
      onOpenChange(false)
      onSuccess(result)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to place your order. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return <><Sheet open={open} onOpenChange={(value) => { if (!loading) onOpenChange(value) }}>
    <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
      <SheetHeader><SheetTitle>Your order</SheetTitle><SheetDescription>{context.location.name} · {fulfillment === "dine_in" ? "Dine in" : "Pickup"}</SheetDescription></SheetHeader>
      <form onSubmit={checkout} className="mt-6 flex flex-1 flex-col gap-5">
        {!cart.length && <><p>Your cart is empty. Add something from the menu.</p>
          <Button type="submit" disabled={loading}>Recover previous order</Button>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}</>}
        {cart.map((line) => <div key={cartLineKey(line)} className="border-b pb-4">
          <div className="flex justify-between gap-3"><h3 className="font-semibold">{line.name}</h3><span>{formatPrice(cartLineExtendedTotal(line), line.currency || currency)}</span></div>
          {(line.modifiers || []).map((modifier) => <p key={`${modifier.groupId}:${modifier.catalogItemId}`} className="text-sm text-gray-500">{modifier.cartQty} × {modifier.name}</p>)}
          <div className="mt-2 flex items-center gap-3">
            <Button type="button" size="icon" variant="outline" disabled={loading} onClick={() => updateQty(cartLineKey(line), -1)} aria-label={`Decrease ${line.name}`}><Minus className="h-4 w-4" /></Button>
            <span>{line.cartQty}</span>
            <Button type="button" size="icon" variant="outline" disabled={loading} onClick={() => updateQty(cartLineKey(line), 1)} aria-label={`Increase ${line.name}`}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>)}
        {cart.length > 0 && <>
          <p className="text-sm">{identity ? `Ordering as ${identity.name}` : "Ordering anonymously"}</p>
          <Button type="button" variant="outline" disabled={loading} onClick={() => identity ? setIdentity(null) : setScanOpen(true)}>
            {identity ? "Remove buyer identity" : "Scan buyer QR (optional)"}
          </Button>
          {promotion && <div className="flex items-center justify-between text-sm"><span>Offer selected</span><Button type="button" variant="ghost" onClick={() => setPromotion(null)}>Remove offer</Button></div>}
          <label className="space-y-2 text-sm font-medium">Coupon code (optional)<Input value={coupon} onChange={(event) => setCoupon(event.target.value)} disabled={loading} autoComplete="off" maxLength={100} /></label>
          <label className="space-y-2 text-sm font-medium">Order notes (optional)<Textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={loading} maxLength={1000} /></label>
          <div className="mt-auto flex justify-between text-lg font-semibold"><span>Subtotal</span><span>{formatPrice(subtotal, currency)}</span></div>
          <p className="text-sm text-gray-500">Final prices and eligible offers are confirmed when you place your order. Pay cash at the counter or pay by card on your phone after ordering.</p>
          {incompatible && <p role="alert" className="text-sm text-red-600">Some items are unavailable for this fulfillment method. Remove them or switch pickup/dine in.</p>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <Button type="submit" size="lg" disabled={loading || !ready}>{loading ? "Placing order…" : "Place order · Pay at counter"}</Button>
        </>}
      </form>
    </SheetContent>
  </Sheet><BuyerIdentityScan open={scanOpen} onOpenChange={setScanOpen} /></>
}