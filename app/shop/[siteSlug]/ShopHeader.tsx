"use client"

import Link from "next/link"
import { Search, User } from "@/app/components/ui/icons"
import { CartButton } from "@/app/components/commerce/CartButton"
import { CommerceShareControl } from "@/app/components/commerce/CommerceShareControl"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"
import {
  MobileShellSearchExpanded,
  MobileShellSearchIconButton,
} from "@/app/components/commerce/MobileShellSearch"
import { useCommerceSignInHref } from "@/app/components/commerce/use-commerce-sign-in-href"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/app/components/ui/sheet"
import { CartSidebar } from "./CartSidebar"
import type { CatalogItem } from "@/app/types"

type CartItem = CatalogItem & {
  cartQty: number
  cartPrice: number
  reservationStart?: string
  reservationEnd?: string
}

type SessionLike = {
  user: {
    user_metadata?: {
      avatar_url?: string
      picture?: string
      name?: string
    }
  }
} | null

type Props = {
  site: any
  siteSlug: string
  searchQuery: string
  setSearchQuery: (value: string) => void
  searchPlaceholder: string
  searchLabel: string
  mobileSearchOpen: boolean
  setMobileSearchOpen: (open: boolean) => void
  session: SessionLike
  signInLabel: string
  cart: CartItem[]
  cartCount: number
  subtotal: number
  isCartOpen: boolean
  setIsCartOpen: (open: boolean) => void
  updateQty: (id: string, delta: number) => void
  customerName: string
  setCustomerName: (value: string) => void
  customerEmail: string
  setCustomerEmail: (value: string) => void
  fulfillment: "pickup" | "ship" | "none" | "dine_in"
  setFulfillment: (value: "pickup" | "ship" | "none" | "dine_in") => void
  originLocationId: string
  setOriginLocationId: (value: string) => void
  locations: any[]
  promotionCode: string
  setPromotionCode: (value: string) => void
  promoDiscount: number
  setPromoDiscount: (value: number) => void
  shippingAddress: {
    line1: string
    line2: string
    city: string
    state: string
    zip: string
    country: string
  }
  setShippingAddress: (value: Props["shippingAddress"]) => void
  ownerSiteId: string | null
  setOwnerSiteId: (value: string | null) => void
  handleCheckout: (e: React.FormEvent) => void | Promise<void>
  checkoutLoading: boolean
  paymentMethod: string
  setPaymentMethod: (value: string) => void
  orderTiming?: "now" | "scheduled"
  setOrderTiming?: (value: "now" | "scheduled") => void
  scheduledFor?: Date | null
  setScheduledFor?: (value: Date | null) => void
  isOpen?: boolean
  nextOpenSlot?: { at: Date; label: string } | null
  locationAvailable?: boolean
  deliveryTimeLabel?: string | null
}

export function ShopHeader({
  site,
  siteSlug,
  searchQuery,
  setSearchQuery,
  searchPlaceholder,
  searchLabel,
  mobileSearchOpen,
  setMobileSearchOpen,
  session,
  signInLabel,
  cart,
  cartCount,
  subtotal,
  isCartOpen,
  setIsCartOpen,
  updateQty,
  customerName,
  setCustomerName,
  customerEmail,
  setCustomerEmail,
  fulfillment,
  setFulfillment,
  originLocationId,
  setOriginLocationId,
  locations,
  promotionCode,
  setPromotionCode,
  promoDiscount,
  setPromoDiscount,
  shippingAddress,
  setShippingAddress,
  ownerSiteId,
  setOwnerSiteId,
  handleCheckout,
  checkoutLoading,
  paymentMethod,
  setPaymentMethod,
  orderTiming,
  setOrderTiming,
  scheduledFor,
  setScheduledFor,
  isOpen,
  nextOpenSlot,
  locationAvailable,
  deliveryTimeLabel,
}: Props) {
  const { href: signInHref, onClick: onSignInClick } = useCommerceSignInHref()

  return (
    <>
      <div className="h-4 w-full shrink-0" />
      <CommerceShellHeader
        mobileExpanded={
          mobileSearchOpen ? (
            <MobileShellSearchExpanded
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={searchPlaceholder}
              open={mobileSearchOpen}
              onOpenChange={setMobileSearchOpen}
            />
          ) : undefined
        }
        brand={
          <Link
            href={`/shop/${siteSlug}`}
            className="shrink-0 flex items-center hover:opacity-80 transition-opacity"
          >
            {site.logo_url ? (
              <img src={site.logo_url} alt={site.name} className="h-6 object-contain" />
            ) : (
              <span className="text-xl font-black tracking-tight text-gray-900 dark:text-gray-100 truncate max-w-[150px] md:max-w-none">
                {site.name}
              </span>
            )}
          </Link>
        }
        hideCenterOnMobile
        center={
          <div className="hidden md:block absolute left-1/2 top-1/2 z-[15] w-2/5 -translate-x-1/2 -translate-y-1/2">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                className="w-full pl-9 h-9 text-sm bg-muted/50 focus:bg-white dark:focus:bg-gray-950 border border-transparent focus:border-black/10 dark:focus:border-white/10 rounded-full transition-all outline-none shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        }
        actions={
          <div className="flex items-center justify-end gap-1 md:gap-3 min-w-0">
            <MobileShellSearchIconButton
              value={searchQuery}
              label={searchLabel}
              onOpen={() => setMobileSearchOpen(true)}
            />
            <div
              data-commerce-shell-actions-core
              className="flex items-center justify-end gap-4 min-w-0"
            >
              <div className="hidden md:contents">
                <CommerceShareControl
                  className={`relative ${shellClasses.iconButton}`}
                  iconClassName="h-4 w-4"
                  title={site.name}
                />
              </div>
              <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
                <SheetTrigger asChild>
                  <CartButton
                    cartCount={cartCount}
                    subtotal={subtotal}
                    currency={cart[0]?.currency}
                    variant="shell"
                    className={`relative ${shellClasses.iconButton}`}
                    iconClassName="h-4 w-4"
                  />
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-full sm:max-w-md p-0 flex flex-col bg-white border-l-0 shadow-2xl"
                >
                  <SheetTitle className="sr-only">Shopping Cart</SheetTitle>
                  <CartSidebar
                    cart={cart}
                    session={session}
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
                    locations={locations}
                    promotionCode={promotionCode}
                    setPromotionCode={setPromotionCode}
                    promoDiscount={promoDiscount}
                    setPromoDiscount={setPromoDiscount}
                    shippingAddress={shippingAddress}
                    setShippingAddress={setShippingAddress}
                    ownerSiteId={ownerSiteId}
                    setOwnerSiteId={setOwnerSiteId}
                    handleCheckout={handleCheckout}
                    checkoutLoading={checkoutLoading}
                    closeCart={() => setIsCartOpen(false)}
                    site={site}
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
                    orderTiming={orderTiming}
                    setOrderTiming={setOrderTiming}
                    scheduledFor={scheduledFor}
                    setScheduledFor={setScheduledFor}
                    isOpen={isOpen}
                    nextOpenSlot={nextOpenSlot}
                    locationAvailable={locationAvailable}
                    deliveryTimeLabel={deliveryTimeLabel}
                  />
                </SheetContent>
              </Sheet>

              {session ? (
                <Link href="/buyer" className="hover:opacity-80 transition-opacity shrink-0">
                  {session.user.user_metadata?.avatar_url ||
                  session.user.user_metadata?.picture ? (
                    <img
                      src={
                        session.user.user_metadata?.avatar_url ||
                        session.user.user_metadata?.picture
                      }
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
                <>
                  <Link
                    href={signInHref}
                    onClick={onSignInClick}
                    className={`md:hidden ${shellClasses.iconButton}`}
                    aria-label={signInLabel}
                  >
                    <User className="h-4 w-4" />
                  </Link>
                  <Link
                    href={signInHref}
                    onClick={onSignInClick}
                    className={`hidden md:inline-flex ${shellClasses.primaryCta} ml-1`}
                  >
                    {signInLabel}
                  </Link>
                </>
              )}
            </div>
          </div>
        }
      />
    </>
  )
}
