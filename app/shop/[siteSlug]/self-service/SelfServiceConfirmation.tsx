"use client"

import { useEffect, useState } from "react"
import QRCode from "react-qr-code"
import { Button } from "@/app/components/ui/button"
import type { CheckoutCartSuccess } from "@/app/commerce/checkout-client"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"

export function SelfServiceConfirmation({ order, onStartNew }: { order: CheckoutCartSuccess; onStartNew: () => void }) {
  const [origin, setOrigin] = useState("")
  const { t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()
  useEffect(() => { queueMicrotask(() => setOrigin(window.location.origin)) }, [])
  const path = `/so/${encodeURIComponent(order.publicAccessToken)}`
  return <main className="mx-auto flex max-w-xl flex-1 flex-col items-center gap-6 px-6 py-12 text-center">
    <h1 className="text-3xl font-bold">{t("shop.selfService.confirmation.title")}</h1>
    <p className="text-lg">{t("shop.selfService.confirmation.number")}</p>
    <p className="text-5xl font-bold tracking-wide">{order.orderNumber || t("shop.selfService.confirmation.confirmed")}</p>
    {order.total != null && <p className="text-xl font-semibold">{formatPrice(order.total, order.currency || "USD")}</p>}
    <div className="rounded-xl border bg-amber-50 p-4 text-amber-950">
      <p className="font-semibold">{t(order.total === 0 ? "shop.selfService.confirmation.noPayment" : "shop.selfService.confirmation.pending")}</p>
      <p className="mt-2 text-sm">{t(order.total === 0 ? "shop.selfService.confirmation.viewHelp" : "shop.selfService.confirmation.paymentHelp")}</p>
    </div>
    {origin && <div className="rounded-xl bg-white p-4"><QRCode value={`${origin}${path}`} size={220} title={t("shop.selfService.confirmation.qrTitle")} /></div>}
    <a href={path} target="_blank" rel="noopener noreferrer" className="text-sm underline">{t("shop.selfService.confirmation.view")}</a>
    <p className="text-sm text-gray-500">{t("shop.selfService.confirmation.privacy")}</p>
    <Button type="button" size="lg" className="w-full" onClick={onStartNew}>{t("shop.selfService.confirmation.startNew")}</Button>
  </main>
}