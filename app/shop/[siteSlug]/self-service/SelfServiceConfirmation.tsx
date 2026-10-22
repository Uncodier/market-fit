"use client"

import { useEffect, useState } from "react"
import QRCode from "react-qr-code"
import { Button } from "@/app/components/ui/button"
import type { CheckoutCartSuccess } from "@/app/commerce/checkout-client"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"

export function SelfServiceConfirmation({ order, onStartNew }: { order: CheckoutCartSuccess; onStartNew: () => void }) {
  const [origin, setOrigin] = useState("")
  const { formatPrice } = useDisplayCurrency()
  useEffect(() => { queueMicrotask(() => setOrigin(window.location.origin)) }, [])
  const path = `/so/${encodeURIComponent(order.publicAccessToken)}`
  return <main className="mx-auto flex max-w-xl flex-1 flex-col items-center gap-6 px-6 py-12 text-center">
    <h1 className="text-3xl font-bold">Order placed</h1>
    <p className="text-lg">Your confirmation number</p>
    <p className="text-5xl font-bold tracking-wide">{order.orderNumber || "Confirmed"}</p>
    {order.total != null && <p className="text-xl font-semibold">{formatPrice(order.total, order.currency || "USD")}</p>}
    <div className="rounded-xl border bg-amber-50 p-4 text-amber-950">
      <p className="font-semibold">{order.total === 0 ? "No payment required" : "Cash payment pending"}</p>
      <p className="mt-2 text-sm">{order.total === 0 ? "Scan this QR code with your phone to view your order." : "Pay at the counter, or scan this QR code with your phone to view your order and pay by card."}</p>
    </div>
    {origin && <div className="rounded-xl bg-white p-4"><QRCode value={`${origin}${path}`} size={220} title="View order and pay on your phone" /></div>}
    <a href={path} target="_blank" rel="noopener noreferrer" className="text-sm underline">View order and mobile payment</a>
    <p className="text-sm text-gray-500">Keep your confirmation number. Your account and order history are not saved on this device.</p>
    <Button type="button" size="lg" className="w-full" onClick={onStartNew}>Start new order</Button>
  </main>
}