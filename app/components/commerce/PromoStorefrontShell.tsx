"use client"

import Link from "next/link"
import { ArrowLeft, User } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"
import { useCommerceSignInHref } from "@/app/components/commerce/use-commerce-sign-in-href"
import { CartButton } from "@/app/components/commerce/CartButton"
import { LocaleSelector } from "@/app/components/commerce/LocaleSelector"
import { CurrencySelector } from "@/app/components/commerce/CurrencySelector"

export type PromoBundleSite = {
  id: string
  name?: string | null
  logo_url?: string | null
}

type Props = {
  backHref: string
  surface: "shop" | "marketplace"
  site?: PromoBundleSite | null
  cartCount: number
  subtotal: number
  /** Source currency of cart amounts (must match cart item prices). */
  currency?: string
  children: React.ReactNode
}

/** PDP-matching chrome (header + footer) for promotion detail pages. */
export function PromoStorefrontShell({
  backHref,
  surface,
  site = null,
  cartCount,
  subtotal,
  currency = "USD",
  children,
}: Props) {
  const { t } = useLocalization()
  const { user } = useAuth()
  const session = user ? { user } : null
  const { href: signInHref, onClick: onSignInClick } = useCommerceSignInHref()
  const siteName = site?.name || null
  const siteLogo = site?.logo_url || null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="h-4 w-full shrink-0" />
      <CommerceShellHeader
        brand={
          <div className="flex items-center min-w-0">
            <Link href={backHref} className={`${shellClasses.iconButton} shrink-0 md:mr-2`}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
            {siteName ? (
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
            ) : surface === "marketplace" ? (
              <Link
                href="/marketplace"
                className="ml-1 text-sm font-black tracking-tight text-primary truncate"
              >
                MARKETPLACE
              </Link>
            ) : null}
          </div>
        }
        actions={
          <div
            data-commerce-shell-actions-core
            className="flex items-center justify-end gap-4 min-w-0"
          >
            <CartButton
              href={`${backHref}?cart=1`}
              cartCount={cartCount}
              subtotal={subtotal}
              currency={currency}
              hideIfEmpty={false}
              variant="shell"
              className={`relative ${shellClasses.iconButton}`}
              iconClassName="h-4 w-4"
            />
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

      {children}

      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12 mt-auto hidden lg:block">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-2xl font-black tracking-tight text-gray-400 dark:text-gray-600">
            {siteName || (surface === "marketplace" ? "Makinari" : "Shop")}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} {siteName || "Makinari"}. All rights reserved.
          </div>
          <div className="flex items-center gap-2">
            <CurrencySelector className="rounded-full" storeCurrency={currency} />
            <LocaleSelector className="rounded-full" />
          </div>
        </div>
      </footer>
    </div>
  )
}
