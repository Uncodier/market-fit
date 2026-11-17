"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft, QrCode, RotateCcw, User } from "@/app/components/ui/icons"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"
import { CommerceSearchInput } from "@/app/components/commerce/CommerceSearchInput"
import { CartButton } from "@/app/components/commerce/CartButton"
import { MobileShellSearchExpanded, MobileShellSearchIconButton } from "@/app/components/commerce/MobileShellSearch"
import { BuyerIdentityScan } from "./BuyerIdentityScan"
import { useSelfService } from "./SelfServiceProvider"

type Props = {
  backHref?: string
  onOpenCart?: () => void
  searchQuery?: string
  onSearchChange?: (value: string) => void
}

export function SelfServiceHeader({ backHref, onOpenCart, searchQuery = "", onSearchChange }: Props) {
  const router = useRouter()
  const { context, cart, identity, setIdentity, startNewOrder } = useSelfService()
  const [scanOpen, setScanOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const home = `/shop/${context.location.id}`
  const count = cart.reduce((sum, line) => sum + line.cartQty, 0)
  const identityLabel = identity ? `Not ${identity.name}? Remove` : "Scan buyer QR"
  return <>
    <div className="h-4 w-full shrink-0" />
    <CommerceShellHeader
      brand={<div className="flex min-w-0 items-center gap-2">
        {backHref && <Link href={backHref} className={shellClasses.iconButton} aria-label="Back to menu"><ArrowLeft className="h-4 w-4" /></Link>}
        <Link href={home} data-toolbar-font aria-label={context.site.name} className="flex min-w-0 items-center hover:opacity-80 transition-opacity">
          {context.site.logo_url ? <img src={context.site.logo_url} alt={context.site.name} fetchPriority="high" decoding="async" className="w-8 h-8 min-w-8 rounded-full object-cover border border-border shadow-sm shrink-0" />
            : <span className="text-xl font-black tracking-tight text-gray-900 dark:text-gray-100 truncate lowercase max-w-[150px] md:max-w-none">{context.site.name}</span>}
        </Link>
      </div>}
      hideCenterOnMobile
      center={onSearchChange && <div className="hidden md:block absolute left-1/2 top-1/2 z-[15] w-2/5 -translate-x-1/2 -translate-y-1/2">
        <CommerceSearchInput aria-label="Search menu" placeholder="Search menu…" value={searchQuery} onChange={onSearchChange} />
      </div>}
      mobileExpanded={onSearchChange && mobileSearchOpen ? <MobileShellSearchExpanded value={searchQuery} onChange={onSearchChange} placeholder="Search menu…" open={mobileSearchOpen} onOpenChange={setMobileSearchOpen} /> : undefined}
      actions={<div className="flex items-center justify-end gap-1 md:gap-3 min-w-0">
        {onSearchChange && <MobileShellSearchIconButton value={searchQuery} label="Search menu" onOpen={() => setMobileSearchOpen(true)} />}
        <div data-commerce-shell-actions-core className="flex items-center justify-end gap-4 min-w-0">
          <button type="button" className={shellClasses.iconButton} aria-label={identityLabel} title={identityLabel} onClick={() => identity ? setIdentity(null) : setScanOpen(true)}>
            {identity ? <User className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
          </button>
          <button type="button" className={shellClasses.iconButton} aria-label="Start new order" title="Start new order" onClick={() => {
            startNewOrder()
            onSearchChange?.("")
            if (backHref) router.push(home)
          }}><RotateCcw className="h-4 w-4" /></button>
          <CartButton variant="shell" cartCount={count} aria-label={`Cart, ${count} items`} className={`relative ${shellClasses.iconButton}`} iconClassName="h-4 w-4"
            onClick={onOpenCart} href={onOpenCart ? undefined : `${home}?cart=1`} />
        </div>
      </div>}
    />
    <BuyerIdentityScan open={scanOpen} onOpenChange={setScanOpen} />
  </>
}