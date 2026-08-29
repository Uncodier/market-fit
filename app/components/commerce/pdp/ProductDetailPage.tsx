"use client"

import { CatalogItem } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ArrowLeft, Moon, ShoppingCart, Sun, User } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { useTheme } from "@/app/context/ThemeContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
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

import { PDP_ADD_TO_CART_PRIMARY_AFTER } from "./pdp-purchase-cta"

interface ProductDetailPageProps {
  item: CatalogItem & { site?: any, _shop?: any }
  site?: any
  backUrl: string
  experience?: PdpExperience
  catalogSize?: number
}

export function ProductDetailPage({ item, site, backUrl, experience, catalogSize = 0 }: ProductDetailPageProps) {
  const { t } = useLocalization()
  const { theme, toggleTheme } = useTheme()
  const { setStoreCurrency } = useDisplayCurrency()
  const { user } = useAuth()
  const session = user ? { user } : null
  const pathname = usePathname()
  const { href: signInHref, onClick: onSignInClick } = useCommerceSignInHref()
  
  const [cartCount, setCartCount] = useState(0)
  const [subtotal, setSubtotal] = useState(0)
  const [clientExperience, setClientExperience] = useState<PdpExperience | undefined>(experience)
  const resolvedExperience = experience || clientExperience

  const isMarketplace = pathname?.startsWith('/marketplace')
  const storeCurrency = site?.settings?.currency || item.currency || 'USD'
  const cartSource = isMarketplace ? 'marketplace' : 'shop'
  const cartSiteId = site?.id || item.site_id || item.site?.id || null
  const effectiveCatalogSize = isMarketplace
    ? Math.max(catalogSize, PDP_ADD_TO_CART_PRIMARY_AFTER + 1)
    : catalogSize

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

  useEffect(() => {
    if (storeCurrency) setStoreCurrency(storeCurrency)
  }, [storeCurrency, setStoreCurrency])

  useEffect(() => {
    if (experience || !item.is_recurring || !user?.id) return
    let cancelled = false
    const supabase = createClient()
    void supabase
      .from("subscriptions")
      .select("id, status, catalog_item_id, buyer_user_id")
      .eq("buyer_user_id", user.id)
      .eq("catalog_item_id", item.id)
      .in("status", ["active", "paused"])
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        setClientExperience({ kind: "subscription", subscription: data })
      })
    return () => {
      cancelled = true
    }
  }, [experience, item.id, item.is_recurring, user?.id])
  
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
            <CommerceShareControl
              className={`relative ${shellClasses.iconButton}`}
              iconClassName="h-4 w-4"
              title={item.name}
            />

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

      <main>
        <LayoutComponent item={item} backUrl={backUrl} experience={resolvedExperience} catalogSize={effectiveCatalogSize} />
      </main>

      {/* Footer */}
      <div className="flex-1 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-32 lg:pb-0">
        {site ? (
          <footer className="py-12">
            <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-2xl font-black tracking-tight text-gray-400 dark:text-gray-600">{site.name}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center md:text-left">
                &copy; {new Date().getFullYear()} {site.name}. {t("shop.allRightsReserved") || "All rights reserved."}{" "}
                {t("shop.poweredBy") || "Powered by Makinari."}
              </div>
              <div className="flex items-center gap-2">
                <CurrencySelector className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400" storeCurrency={storeCurrency} />
                <LocaleSelector className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400" />
                <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-800">
                  {theme === "dark" ? <Sun className="h-5 w-5 text-gray-400 hover:text-black dark:hover:text-white" /> : <Moon className="h-5 w-5 text-gray-500 hover:text-black dark:hover:text-white" />}
                </Button>
              </div>
            </div>
          </footer>
        ) : (
          <footer className="py-12">
            <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-2xl font-black tracking-tight text-muted-foreground">Makinari</div>
              <div className="text-sm text-muted-foreground font-medium text-center md:text-left">
                &copy; {new Date().getFullYear()} Makinari. {t("marketplace.footer.rights") || "All rights reserved."}{" "}
                {t("marketplace.footer.poweredBy") || "Powered by Makinari."}
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
    </div>
  )
}