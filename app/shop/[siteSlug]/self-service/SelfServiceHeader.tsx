"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, ShoppingCart } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { BuyerIdentityScan } from "./BuyerIdentityScan"
import { useSelfService } from "./SelfServiceProvider"

export function SelfServiceHeader({ backHref, onOpenCart }: { backHref?: string; onOpenCart?: () => void }) {
  const { context, cart, identity, setIdentity, startNewOrder } = useSelfService()
  const [scanOpen, setScanOpen] = useState(false)
  const home = `/shop/${context.location.id}`
  const count = cart.reduce((sum, line) => sum + line.cartQty, 0)
  return <>
    <header className="sticky top-0 z-40 border-b bg-white text-gray-900">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {backHref && <Link href={backHref} aria-label="Back to menu"><ArrowLeft className="h-5 w-5" /></Link>}
          <div><h1 className="font-bold">{context.site.name}</h1><p className="text-sm text-gray-500">{context.location.name} · Self-service</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {identity ? <Button type="button" variant="outline" onClick={() => setIdentity(null)}>Not {identity.name}? Remove</Button>
            : <Button type="button" variant="outline" onClick={() => setScanOpen(true)}>Scan buyer QR</Button>}
          <Button type="button" variant="ghost" onClick={() => { startNewOrder(); if (backHref) window.location.assign(home) }}>Start new order</Button>
          {onOpenCart ? <Button type="button" onClick={onOpenCart} aria-label={`Cart, ${count} items`}><ShoppingCart className="mr-2 h-4 w-4" />{count}</Button>
            : <Button asChild><Link href={`${home}?cart=1`} aria-label={`Cart, ${count} items`}><ShoppingCart className="mr-2 h-4 w-4" />{count}</Link></Button>}
        </div>
      </div>
    </header>
    <BuyerIdentityScan open={scanOpen} onOpenChange={setScanOpen} />
  </>
}