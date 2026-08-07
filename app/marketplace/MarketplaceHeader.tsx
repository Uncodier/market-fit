"use client"

import Link from "next/link"
import { Search, User, Globe } from "@/app/components/ui/icons"
import { CartButton } from "@/app/components/commerce/CartButton"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"
import {
  MobileShellSearchExpanded,
  MobileShellSearchIconButton,
  MobileShellSearchTrigger,
  useMobileShellSearchCollapsed,
} from "@/app/components/commerce/MobileShellSearch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import type { SupportedLocale } from "@/app/context/LocalizationContext"

type SessionLike = {
  user: {
    user_metadata?: {
      avatar_url?: string
      picture?: string
    }
  }
} | null

type Props = {
  searchQuery: string
  setSearchQuery: (value: string) => void
  searchPlaceholder: string
  searchLabel: string
  mobileSearchOpen: boolean
  setMobileSearchOpen: (open: boolean) => void
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => void
  cartCount: number
  subtotal: number
  currency?: string
  onCartOpen: () => void
  session: SessionLike
  signInLabel: string
}

export function MarketplaceHeader({
  searchQuery,
  setSearchQuery,
  searchPlaceholder,
  searchLabel,
  mobileSearchOpen,
  setMobileSearchOpen,
  locale,
  setLocale,
  cartCount,
  subtotal,
  currency,
  onCartOpen,
  session,
  signInLabel,
}: Props) {
  const searchCollapsed = useMobileShellSearchCollapsed(false)

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
        hideCenterOnMobile={searchCollapsed}
        brand={
          <Link
            href="/marketplace"
            className="shrink-0 flex items-center hover:opacity-80 transition-opacity"
          >
            <img
              src="/images/logo.png"
              alt="Makinari"
              className="h-6 w-6 object-contain dark:brightness-0 dark:invert md:hidden"
            />
            <span className="hidden md:inline text-xl font-black tracking-tight text-primary">
              MARKETPLACE
            </span>
          </Link>
        }
        center={
          <>
            {!searchCollapsed ? (
              <div className="md:hidden flex w-full min-w-0">
                <MobileShellSearchTrigger
                  value={searchQuery}
                  label={searchLabel}
                  onOpen={() => setMobileSearchOpen(true)}
                />
              </div>
            ) : null}
            <div className="hidden md:block w-full relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                className="w-full pl-9 h-9 text-sm bg-muted/50 focus:bg-white dark:focus:bg-gray-950 border border-transparent focus:border-black/10 dark:focus:border-white/10 rounded-full transition-all outline-none shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </>
        }
        actions={
          <div className="flex items-center justify-end gap-1 md:gap-3 min-w-0">
            {searchCollapsed ? (
              <MobileShellSearchIconButton
                value={searchQuery}
                label={searchLabel}
                onOpen={() => setMobileSearchOpen(true)}
              />
            ) : null}
            <div
              data-commerce-shell-actions-core
              className="flex items-center justify-end gap-0.5 md:gap-3 min-w-0"
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={shellClasses.iconButton}>
                    <Globe className="h-5 w-5" />
                    <span className="sr-only">Change language</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setLocale("en")}
                    className={locale === "en" ? "font-semibold" : undefined}
                  >
                    English
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLocale("es")}
                    className={locale === "es" ? "font-semibold" : undefined}
                  >
                    Español
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <CartButton
                cartCount={cartCount}
                subtotal={subtotal}
                currency={currency}
                onClick={onCartOpen}
                variant="shell"
                className={`relative ${shellClasses.iconButton}`}
                iconClassName="h-4 w-4"
              />

              {session ? (
                <Link href="/buyer" className="hover:opacity-80 transition-opacity ml-0.5 shrink-0">
                  {session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture ? (
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
                    href={`/auth?returnTo=${encodeURIComponent("/marketplace")}`}
                    className={`md:hidden ${shellClasses.iconButton}`}
                    aria-label={signInLabel}
                  >
                    <User className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/auth?returnTo=${encodeURIComponent("/marketplace")}`}
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
