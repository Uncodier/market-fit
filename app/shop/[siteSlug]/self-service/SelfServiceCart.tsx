"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/app/components/ui/sheet"
import { Button } from "@/app/components/ui/button"
import { Textarea } from "@/app/components/ui/textarea"
import { Input } from "@/app/components/ui/input"
import { Minus, Plus } from "@/app/components/ui/icons"
import { cartLineExtendedTotal, cartLineKey } from "@/app/commerce/cart-modifiers"
import { isItemCompatibleWithFulfillment } from "@/app/commerce/delivery-options"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import type { CheckoutCartSuccess } from "@/app/commerce/checkout-client"
import { runSelfServiceCheckout } from "./run-self-service-checkout"
import { useSelfService } from "./SelfServiceProvider"
import { BuyerIdentityScan } from "./BuyerIdentityScan"
import { recoverSelfServiceAttempt } from "./self-service-attempt"

const checkoutErrorKeys: Record<string, string> = {
  "Unable to place your order. Please try again.": "shop.selfService.cart.failed",
  "The previous order is unresolved. Ask staff before placing another order.": "shop.selfService.cart.unresolved",
  "An earlier order attempt is unresolved. Restore that order and retry, or ask staff to check it before starting another order.": "shop.selfService.cart.earlierUnresolved",
}

export function SelfServiceCart({ open, onOpenChange, onSuccess }: {
  open: boolean; onOpenChange: (open: boolean) => void; onSuccess: (result: CheckoutCartSuccess) => void
}) {
  const { context, cart, identity, setIdentity, fulfillment, updateQty, promotion, setPromotion, clearOrder, ready } = useSelfService()
  const { t } = useLocalization()
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
      if (fulfillment !== "pickup" && fulfillment !== "dine_in") throw new Error("shop.selfService.cart.selectFulfillment")
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
      const message = failure instanceof Error ? failure.message : "shop.selfService.cart.failed"
      setError(checkoutErrorKeys[message] || message)
    } finally {
      setLoading(false)
    }
  }

  return <><Sheet open={open} onOpenChange={(value) => { if (!loading) onOpenChange(value) }}>
    <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
      <SheetHeader><SheetTitle>{t("shop.selfService.cart.title")}</SheetTitle><SheetDescription>{context.location.name} · {t(fulfillment === "dine_in" ? "shop.selfService.dineIn" : "shop.selfService.pickup")}</SheetDescription></SheetHeader>
      <form onSubmit={checkout} className="mt-6 flex flex-1 flex-col gap-5">
        {!cart.length && <><p>{t("shop.selfService.cart.empty")}</p>
          <Button type="submit" disabled={loading}>{t("shop.selfService.cart.recover")}</Button>
          {error && <p role="alert" className="text-sm text-red-600">{error.startsWith("shop.selfService.") ? t(error) : error}</p>}</>}
        {cart.map((line) => <div key={cartLineKey(line)} className="border-b pb-4">
          <div className="flex justify-between gap-3"><h3 className="font-semibold">{line.name}</h3><span>{formatPrice(cartLineExtendedTotal(line), line.currency || currency)}</span></div>
          {(line.modifiers || []).map((modifier) => <p key={`${modifier.groupId}:${modifier.catalogItemId}`} className="text-sm text-gray-500">{modifier.cartQty} × {modifier.name}</p>)}
          <div className="mt-2 flex items-center gap-3">
            <Button type="button" size="icon" variant="outline" disabled={loading} onClick={() => updateQty(cartLineKey(line), -1)} aria-label={t("shop.selfService.cart.decrease", { name: line.name })}><Minus className="h-4 w-4" /></Button>
            <span>{line.cartQty}</span>
            <Button type="button" size="icon" variant="outline" disabled={loading} onClick={() => updateQty(cartLineKey(line), 1)} aria-label={t("shop.selfService.cart.increase", { name: line.name })}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>)}
        {cart.length > 0 && <>
          <p className="text-sm">{identity ? t("shop.selfService.cart.orderingAs", { name: identity.name }) : t("shop.selfService.cart.anonymous")}</p>
          <Button type="button" variant="outline" disabled={loading} onClick={() => identity ? setIdentity(null) : setScanOpen(true)}>
            {t(identity ? "shop.selfService.cart.removeIdentity" : "shop.selfService.cart.scanIdentity")}
          </Button>
          {promotion && <div className="flex items-center justify-between text-sm"><span>{t("shop.selfService.cart.offerSelected")}</span><Button type="button" variant="ghost" onClick={() => setPromotion(null)}>{t("shop.selfService.cart.removeOffer")}</Button></div>}
          <label className="space-y-2 text-sm font-medium">{t("shop.selfService.cart.coupon")}<Input value={coupon} onChange={(event) => setCoupon(event.target.value)} disabled={loading} autoComplete="off" maxLength={100} /></label>
          <label className="space-y-2 text-sm font-medium">{t("shop.selfService.cart.notes")}<Textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={loading} maxLength={1000} /></label>
          <div className="mt-auto flex justify-between text-lg font-semibold"><span>{t("shop.selfService.cart.subtotal")}</span><span>{formatPrice(subtotal, currency)}</span></div>
          <p className="text-sm text-gray-500">{t("shop.selfService.cart.paymentHelp")}</p>
          {incompatible && <p role="alert" className="text-sm text-red-600">{t("shop.selfService.cart.incompatible")}</p>}
          {error && <p role="alert" className="text-sm text-red-600">{error.startsWith("shop.selfService.") ? t(error) : error}</p>}
          <Button type="submit" size="lg" disabled={loading || !ready}>{t(loading ? "shop.selfService.cart.placing" : "shop.selfService.cart.place")}</Button>
        </>}
      </form>
    </SheetContent>
  </Sheet><BuyerIdentityScan open={scanOpen} onOpenChange={setScanOpen} /></>
}