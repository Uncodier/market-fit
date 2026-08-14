"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, Moon, Sun, User } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useTheme } from "@/app/context/ThemeContext"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"
import { useCommerceSignInHref } from "@/app/components/commerce/use-commerce-sign-in-href"
import { CartButton } from "@/app/components/commerce/CartButton"
import { getCartItems } from "@/app/commerce/cart-storage"
import { resolveInternalBackHref } from "@/app/documents/internal-back"

export type PublicDocumentShopNavProps = {
  siteId?: string | null
  siteName?: string | null
  logoUrl?: string | null
  currency?: string | null
}

/** Shop chrome for public document views — hidden when printing. */
export function PublicDocumentShopNav({
  siteId,
  siteName,
  logoUrl,
  currency,
}: PublicDocumentShopNavProps) {
  const { t } = useLocalization()
  const { isDarkMode, toggleTheme } = useTheme()
  const { user } = useAuth()
  const session = user ? { user } : null
  const pathname = usePathname()
  const { href: signInHref, onClick: onSignInClick } = useCommerceSignInHref()

  const shopHref = siteId ? `/shop/${siteId}` : "/marketplace"
  const [cartCount, setCartCount] = useState(0)
  const [subtotal, setSubtotal] = useState(0)
  const [cartCurrency, setCartCurrency] = useState(currency || "USD")
  const [backHref, setBackHref] = useState<string | null>(null)

  useEffect(() => {
    setBackHref(resolveInternalBackHref(pathname))
  }, [pathname])

  useEffect(() => {
    const checkCart = () => {
      const cart = getCartItems("cart", "shop", siteId || null).filter(
        (c: any) => !siteId || !c.site_id || c.site_id === siteId
      )
      setCartCount(cart.reduce((s: number, c: any) => s + (c.cartQty || 0), 0))
      setSubtotal(
        cart.reduce((s: number, c: any) => s + (c.cartPrice || 0) * (c.cartQty || 0), 0)
      )
      const fromCart = cart.find((c: any) => c.currency)?.currency
      setCartCurrency(fromCart || currency || "USD")
    }

    checkCart()
    window.addEventListener("storage", checkCart)
    return () => window.removeEventListener("storage", checkCart)
  }, [siteId, currency])

  return (
    <>
      <div className="h-4 w-full shrink-0 print:hidden" />
      <CommerceShellHeader
        className="print:hidden"
        brand={
          <div className="flex items-center min-w-0">
            {backHref ? (
              <Link
                href={backHref}
                className={`${shellClasses.iconButton} shrink-0 md:mr-2`}
                aria-label={t("common.back") || "Back"}
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
            ) : null}
            <Link
              href={shopHref}
              className={`shrink-0 flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0 ${
                backHref
                  ? "border-l border-black/10 dark:border-white/10 pl-3 ml-1"
                  : ""
              }`}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={siteName || "Shop"}
                  className="h-6 object-contain shrink-0"
                />
              ) : (
                <span className="text-xl font-black tracking-tight text-gray-900 dark:text-gray-100 truncate max-w-[180px] md:max-w-none">
                  {siteName || "Shop"}
                </span>
              )}
            </Link>
          </div>
        }
        actions={
          <div
            data-commerce-shell-actions-core
            className="flex items-center justify-end gap-3 md:gap-4 min-w-0"
          >
            <button
              type="button"
              onClick={toggleTheme}
              className={`${shellClasses.iconButton} relative`}
              aria-label={t("buyer.layout.footer.toggleTheme") || "Toggle theme"}
            >
              {isDarkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <CartButton
              href={`${shopHref}?cart=1`}
              cartCount={cartCount}
              subtotal={subtotal}
              currency={cartCurrency}
              hideIfEmpty={false}
              variant="shell"
              className={`relative ${shellClasses.iconButton}`}
              iconClassName="h-4 w-4"
            />
            {session ? (
              <Link href="/buyer" className="hover:opacity-80 transition-opacity shrink-0">
                {session.user.user_metadata?.avatar_url ||
                session.user.user_metadata?.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
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
    </>
  )
}
