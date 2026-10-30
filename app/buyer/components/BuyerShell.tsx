"use client"

import React from "react"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { useRouter, usePathname } from "next/navigation"
import { useTheme } from "@/app/context/ThemeContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Sun, Moon, Globe, Monitor, ShoppingCart, User } from "@/app/components/ui/icons"
import { AccountScreenLoading } from './AccountScreenLoading'
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"
import { CartButton } from "@/app/components/commerce/CartButton"
import { TopBarPrimaryActionsSlot } from "@/app/components/navigation/topbar-primary-actions"
import { AccountSearchActionsSlot, AccountSearchSlot } from "./AccountSearch"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { isSafeInternalPath } from "@/lib/auth/post-auth-redirect"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"

type BuyerShellProps = {
  children: React.ReactNode
  /** When false, guests can view the shell without being redirected to sign-in. */
  requireAuth?: boolean
}

export function BuyerShell({ children, requireAuth = true }: BuyerShellProps) {
  const { user, isLoading } = useAuth()
  const session = React.useMemo(() => user ? { user } : null, [user])
  const router = useRouter()
  const pathname = usePathname()
  const { setTheme } = useTheme()
  const { setLocale, t } = useLocalization()

  const [cartCount, setCartCount] = React.useState(0)

  React.useEffect(() => {
    const checkCart = () => {
      let count = 0
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith("market-cart-")) {
          try {
            const cart: unknown = JSON.parse(localStorage.getItem(key) || "[]")
            if (Array.isArray(cart)) count += cart.reduce((sum: number, item: { cartQty?: unknown }) =>
              sum + (typeof item?.cartQty === "number" && Number.isFinite(item.cartQty) ? item.cartQty : 0), 0)
          } catch {
            // ignore malformed cart entries
          }
        }
      }
      setCartCount(count)
    }

    checkCart()
    window.addEventListener("storage", checkCart)
    return () => window.removeEventListener("storage", checkCart)
  }, [])

  React.useEffect(() => {
    if (!requireAuth) return
    if (!isLoading && !session) {
      const currentPath = `${window.location.pathname}${window.location.search}`
      const returnTo = isSafeInternalPath(currentPath) ? currentPath : "/buyer"
      router.push(
        `/auth?returnTo=${encodeURIComponent(returnTo)}`
      )
    }
  }, [requireAuth, session, isLoading, router, pathname])

  const isAuthLoading = requireAuth && (isLoading || !session)
  const showNav = requireAuth && Boolean(session)
  const isMiniExperience = Boolean(
    pathname?.match(/^\/buyer\/(reservations|course|ticket|book|downloads)\//) ||
    pathname?.match(/^\/home\/preview\/(library|reservations|subscriptions)\//)
  )
  const unified = pathname === "/home" || pathname?.startsWith("/home/")
  const portalBase = unified ? "/home" : "/buyer"
  const homeHref = session ? portalBase : "/marketplace"
  const signInLabel = t("signIn") || "Sign In"
  const signInHref = `/auth?returnTo=${encodeURIComponent(pathname || "/buyer")}`

  const purchasesHref = `${portalBase}/orders`
  const purchasesLabel = t("buyer.layout.purchases") || "Purchases"

  const initial =
    user?.user_metadata?.first_name?.charAt(0) ||
    user?.email?.charAt(0)?.toUpperCase() ||
    "U"

  return (
    <div className={cn(
      "flex min-h-screen w-full flex-col bg-muted/30",
      isMiniExperience && "h-[100dvh] overflow-hidden w-full max-w-[100vw]"
    )}>
      {!isMiniExperience && (
        <>
          <div className="h-4 w-full shrink-0" />
          <CommerceShellHeader
            headerClassName={pathname === '/home/submissions' || pathname === '/home/tenders' ? '!bg-transparent dark:!bg-transparent !backdrop-blur-none !shadow-none' : undefined}
            hideCenterOnMobile
            center={!isAuthLoading ? <AccountSearchSlot /> : undefined}
            brand={
              <Link href={homeHref} className="shrink-0 flex items-center hover:opacity-80 transition-opacity">
                <img
                  src="/images/combination_mark.png"
                  alt="Market Fit Logo"
                  className="h-5 w-auto object-contain dark:brightness-0 dark:invert hidden lg:block"
                />
                <img
                  src="/images/logo.png"
                  alt="Market Fit Logo"
                  className="h-6 w-6 object-contain dark:brightness-0 dark:invert block lg:hidden"
                />
              </Link>
            }
            actions={
              <div className="flex items-center gap-1 md:gap-3">
                {!isAuthLoading && <AccountSearchActionsSlot />}
                <TopBarPrimaryActionsSlot />
                <div className="hidden md:flex items-center gap-1 md:gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={shellClasses.iconButton}>
                        <Globe className="h-5 w-5" />
                        <span className="sr-only">
                          {t("commerce.language.change") || "Change language"}
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setLocale("en")}>English</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocale("es")}>Español</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`${shellClasses.iconButton} relative`}>
                        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                        <span className="sr-only">
                          {t("buyer.layout.footer.toggleTheme") || "Toggle theme"}
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setTheme("light")}>
                        <Sun className="mr-2 h-4 w-4" />
                        <span>{t("buyer.layout.footer.themeLight") || "Light"}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("dark")}>
                        <Moon className="mr-2 h-4 w-4" />
                        <span>{t("buyer.layout.footer.themeDark") || "Dark"}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("system")}>
                        <Monitor className="mr-2 h-4 w-4" />
                        <span>{t("buyer.layout.footer.themeSystem") || "System"}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="order-2 md:order-1 flex items-center">
                  <CartButton
                    href="/marketplace?cart=1"
                    cartCount={cartCount}
                    hideIfEmpty={true}
                    variant="shell"
                    className={`relative ${shellClasses.iconButton}`}
                    iconClassName="h-4 w-4"
                  />
                </div>

                <div className="order-1 md:order-2 flex items-center shrink-0">
                  {isLoading && requireAuth ? (
                    <div className="w-9 h-9 min-w-9 rounded-full bg-muted flex items-center justify-center border border-border shadow-sm animate-pulse shrink-0" />
                  ) : session ? (
                    <Link
                      href={`${portalBase}/profile`}
                      className="flex items-center gap-2 outline-none hover:opacity-80 transition-opacity rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ml-1 shrink-0"
                    >
                      {user?.user_metadata?.avatar_url || user?.user_metadata?.picture ? (
                        <img
                          src={user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
                          alt="Avatar"
                          className="w-9 h-9 min-w-9 rounded-full object-cover border border-border shadow-sm shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 min-w-9 rounded-full bg-muted flex items-center justify-center border border-border shadow-sm shrink-0">
                          <span className="text-sm font-medium text-muted-foreground">{initial}</span>
                        </div>
                      )}
                    </Link>
                  ) : (
                    <>
                      <Link
                        href={signInHref}
                        className={`md:hidden ${shellClasses.iconButton}`}
                        aria-label={signInLabel}
                      >
                        <User className="h-4 w-4" />
                      </Link>
                      <Link
                        href={signInHref}
                        className={`hidden md:inline-flex ${shellClasses.primaryCta} ml-1`}
                      >
                        {signInLabel}
                      </Link>
                    </>
                  )}
                </div>
                {showNav && !unified && (
                  <nav className="-order-1 flex items-center">
                    <Link
                      href={purchasesHref}
                      aria-label={purchasesLabel}
                      aria-current={pathname.startsWith(purchasesHref) ? "page" : undefined}
                      className={cn(
                        shellClasses.navItem,
                        "!px-3 lg:!px-4",
                        pathname.startsWith(purchasesHref)
                          ? shellClasses.navItemActive
                          : shellClasses.navItemInactive
                      )}
                    >
                      <ShoppingCart size={16} className="shrink-0" />
                      <span className="hidden sm:inline-block leading-none">{purchasesLabel}</span>
                    </Link>
                  </nav>
                )}
              </div>
            }
          />
        </>
      )}

      <main
        className={cn(
          "flex-1 flex flex-col min-w-0 w-full relative",
          isMiniExperience
            ? "min-h-0 overflow-y-auto"
            : "max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8"
        )}
      >
        {isAuthLoading ? (
          <AccountScreenLoading pathname={pathname} />
        ) : (
          children
        )}
      </main>

      {!isMiniExperience && (
        <footer className="w-full border-t border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <img
                src="/images/logo.png"
                alt="Market Fit"
                className="h-4 w-4 object-contain dark:brightness-0 dark:invert grayscale opacity-50"
              />
              <span>
                &copy; {new Date().getFullYear()} Makinari.{" "}
                {t("buyer.layout.footer.allRightsReserved") || "All rights reserved."}
              </span>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
