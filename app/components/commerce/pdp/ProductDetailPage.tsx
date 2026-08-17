"use client"

import { CatalogItem } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ArrowLeft, Moon, ShoppingCart, Sun, User } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { useTheme } from "@/app/context/ThemeContext"
import { useState, useEffect } from "react"
import { ProductPdpLayout } from "./ProductPdpLayout"
import { ServicePdpLayout } from "./ServicePdpLayout"
import { CoursePdpLayout } from "./CoursePdpLayout"
import { TicketPdpLayout } from "./TicketPdpLayout"
import { PassPdpLayout } from "./PassPdpLayout"
import { DigitalPdpLayout } from "./DigitalPdpLayout"
import { resolveItemImage } from "@/app/lib/image-utils"
import { CartButton } from "../CartButton"
import { LocaleSelector } from "../LocaleSelector"
import { CurrencySelector } from "../CurrencySelector"
import { CommerceShareControl } from "../CommerceShareControl"
import { getCartItems } from "@/app/commerce/cart-storage"
import { cartLineExtendedTotal } from "@/app/commerce/cart-modifiers"

import { isAccessOnlyItem } from "@/app/catalog/product-details"
import { PdpExperience } from "./pdp-experience"
import { CommerceShellHeader, shellClasses } from "../CommerceShellHeader"
import { useCommerceSignInHref } from "../use-commerce-sign-in-href"

import { SubscriptionManagePanel } from "./SubscriptionManagePanel"

interface ProductDetailPageProps {
  item: CatalogItem & { site?: any, _shop?: any }
  site?: any
  backUrl: string
  experience?: PdpExperience
}

export function ProductDetailPage({ item, site, backUrl, experience }: ProductDetailPageProps) {
  const { t } = useLocalization()
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const session = user ? { user } : null
  const pathname = usePathname()
  const { href: signInHref, onClick: onSignInClick } = useCommerceSignInHref()
  
  const [cartCount, setCartCount] = useState(0)
  const [subtotal, setSubtotal] = useState(0)

  const isMarketplace = pathname?.startsWith('/marketplace')
  const cartSource = isMarketplace ? 'marketplace' : 'shop'
  const cartSiteId = site?.id || item.site_id || item.site?.id || null

  useEffect(() => {
    const checkCart = () => {
      const cart = getCartItems('cart', cartSource, cartSource === 'shop' ? cartSiteId : null)
        .filter((c: any) => cartSource !== 'shop' || !cartSiteId || !c.site_id || c.site_id === cartSiteId)
      const count = cart.reduce((s: number, c: any) => s + (c.cartQty || 0), 0)
      const sub = cart.reduce((s: number, c: any) => s + cartLineExtendedTotal(c), 0)
      setCartCount(count)
      setSubtotal(sub)
    }
    
    checkCart()
    window.addEventListener('storage', checkCart)
    return () => window.removeEventListener('storage', checkCart)
  }, [cartSource, cartSiteId])
  
  const siteName = site?.name || item.site?.name
  const siteLogo = site?.logo_url || item.site?.logo_url

  const getLayout = () => {
    if (isAccessOnlyItem(item)) return PassPdpLayout;
    
    const hasVariants = item._shop?.hasVariants || (item.metadata?.variant_axes?.length ?? 0) > 0 || (item._shop?.children?.length ?? 0) > 0;
    
    if (item.kind === 'service' || (item.is_reservation && !isAccessOnlyItem(item))) {
      if (hasVariants) return ProductPdpLayout;
      return ServicePdpLayout;
    }
    
    if (item.kind === 'product') return ProductPdpLayout;
    if (item.kind === 'digital_asset') {
      if (item.digital_subtype === 'course') return CoursePdpLayout;
      if (item.digital_subtype === 'ticket') return TicketPdpLayout;
      if (item.digital_subtype === 'file' || item.digital_subtype === 'license') return DigitalPdpLayout;
    }
    return ProductPdpLayout; // fallback
  }

  const LayoutComponent = getLayout();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Spacer for floating header */}
      <div className="h-4 w-full shrink-0" />
      <CommerceShellHeader
        brand={
          <div className="flex items-center min-w-0">
            <Link href={backUrl} className={`${shellClasses.iconButton} shrink-0 md:mr-2`}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
            {siteName && (
              <div className="flex items-center gap-2 border-l border-black/10 dark:border-white/10 pl-3 ml-1 min-w-0">
                {siteLogo ? (
                  <img src={siteLogo} alt="" className="w-6 h-6 object-contain shrink-0" />
                ) : (
                  <div className="w-6 h-6 bg-muted rounded-full shrink-0" />
                )}
                <span className="text-sm font-bold tracking-tight truncate min-w-0">
                  {siteName}
                </span>
              </div>
            )}
          </div>
        }
        actions={
          <div
            data-commerce-shell-actions-core
            className="flex items-center justify-end gap-4 min-w-0"
          >
            <div className="hidden md:contents">
              <CommerceShareControl
                className={`relative ${shellClasses.iconButton}`}
                iconClassName="h-4 w-4"
                title={item.name}
              />
            </div>

            <CartButton
              href={`${backUrl}?cart=1`}
              cartCount={cartCount}
              subtotal={subtotal}
              currency={item?.currency}
              hideIfEmpty={false}
              variant="shell"
              className={`relative ${shellClasses.iconButton}`}
              iconClassName="h-4 w-4"
            />

            {session ? (
              <Link href="/buyer" className="hover:opacity-80 transition-opacity shrink-0">
                {session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture ? (
                  <img
                    src={
                      session.user.user_metadata?.avatar_url ||
                      session.user.user_metadata?.picture
                    }
                      alt="Avatar"
                      className="w-8 h-8 min-w-8 rounded-full object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 min-w-8 rounded-full bg-muted flex items-center justify-center border border-border shrink-0">
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
                  aria-label={t("marketplace.signIn") || "Sign In"}
                >
                  <User className="h-4 w-4" />
                </Link>
                <Link
                  href={signInHref}
                  onClick={onSignInClick}
                  className={`hidden md:inline-flex ${shellClasses.primaryCta} ml-1`}
                >
                  {t("marketplace.signIn") || "Sign In"}
                </Link>
              </>
            )}
          </div>
        }
      />

      <main className="flex-1 pb-24 lg:pb-0">
        <LayoutComponent item={item} backUrl={backUrl} experience={experience} />
      </main>

      {/* Footer */}
      {site ? (
        <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12 mt-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-2xl font-black tracking-tight text-gray-400 dark:text-gray-600">{site.name}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              &copy; {new Date().getFullYear()} {site.name}. All rights reserved. Powered by Uncodie.
            </div>
            <div className="flex items-center gap-2">
              <CurrencySelector className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400" />
              <LocaleSelector className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400" />
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-800">
                {theme === "dark" ? <Sun className="h-5 w-5 text-gray-400 hover:text-black dark:hover:text-white" /> : <Moon className="h-5 w-5 text-gray-500 hover:text-black dark:hover:text-white" />}
              </Button>
            </div>
          </div>
        </footer>
      ) : (
        <footer className="bg-card border-t py-12 mt-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-2xl font-black tracking-tight text-muted-foreground">Makinari</div>
            <div className="text-sm text-muted-foreground font-medium">
              &copy; {new Date().getFullYear()} Makinari. All rights reserved.
            </div>
            <div className="flex items-center gap-2">
              <CurrencySelector className="rounded-full" />
              <LocaleSelector className="rounded-full" />
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}