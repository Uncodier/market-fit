"use client"

import React from "react"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { useRouter, usePathname } from "next/navigation"
import { useTheme } from "@/app/context/ThemeContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { FileText, Repeat, Archive, Home, Sun, Moon, Globe, Monitor, ShoppingCart } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { CommerceShellHeader, shellClasses } from "@/app/components/commerce/CommerceShellHeader"
import { CartButton } from "@/app/components/commerce/CartButton"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/app/components/ui/dropdown-menu"

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const session = user ? { user } : null
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { locale, setLocale, t } = useLocalization()

  const [cartCount, setCartCount] = React.useState(0)

  React.useEffect(() => {
    const checkCart = () => {
      let count = 0
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('market-cart-')) {
          try {
            const cart = JSON.parse(localStorage.getItem(key) || '[]')
            count += cart.reduce((s: any, c: any) => s + (c.cartQty || 0), 0)
          } catch(e) {}
        }
      }
      setCartCount(count)
    }
    
    checkCart()
    window.addEventListener('storage', checkCart)
    return () => window.removeEventListener('storage', checkCart)
  }, [])

  // Redirect to login if no session
  React.useEffect(() => {
    if (!isLoading && !session) {
      router.push(`/auth?returnTo=${encodeURIComponent(pathname === '/buyer' ? '/buyer' : pathname || '/buyer')}`)
    }
  }, [session, isLoading, router, pathname])

  // If loading auth or no session (but we are redirecting), we still render the shell
  // but with a generic loading state in the main content to avoid jarring layout shifts.
  const isAuthLoading = isLoading || !session;

  const navItems = [
    { label: t("buyer.layout.home") || "Home", href: "/buyer", icon: <Home size={16} />, exact: true },
    { label: t("buyer.layout.purchases") || "Purchases", href: "/buyer/orders", icon: <ShoppingCart size={16} /> },
    { label: t("buyer.layout.subscriptions") || "Subscriptions", href: "/buyer/subscriptions", icon: <Repeat size={16} /> },
    { label: t("buyer.layout.quotations") || "Quotations", href: "/buyer/quotes", icon: <FileText size={16} /> },
    { label: t("buyer.layout.assets") || "Assets", href: "/buyer/library", icon: <Archive size={16} /> },
  ]

  const initial = user?.user_metadata?.first_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/30">
      {/* Top Navigation Bar Spacer */}
      <div className="h-4 w-full shrink-0" />
      {/* Floating Navigation Bar */}
      <CommerceShellHeader
        hideCenterOnMobile={false}
        brand={
          <Link href="/buyer" className="shrink-0 flex items-center hover:opacity-80 transition-opacity">
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
        center={
          <div className="flex items-center justify-center overflow-x-auto no-scrollbar mask-fade-right w-full">
            <nav className="flex items-center space-x-0.5 lg:space-x-1 min-w-0">
              {navItems.map((item) => {
                const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      shellClasses.navItem,
                      "px-2.5 lg:px-3 text-xs lg:text-sm whitespace-nowrap min-w-0 flex-shrink",
                      isActive ? shellClasses.navItemActive : shellClasses.navItemInactive
                    )}
                  >
                    <span className="flex h-full items-center justify-center shrink-0">
                      {item.icon}
                    </span>
                    <span className="hidden sm:inline-block truncate leading-none">{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        }
        actions={
          <div className="flex items-center gap-1 md:gap-3">
            <div className="hidden md:flex items-center gap-1 md:gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={shellClasses.iconButton}>
                    <Globe className="h-5 w-5" />
                    <span className="sr-only">{t("buyer.layout.footer.toggleLanguage") || "Toggle language"}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocale("en")}>
                    English
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocale("es")}>
                    Español
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`${shellClasses.iconButton} relative`}>
                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">{t("buyer.layout.footer.toggleTheme") || "Toggle theme"}</span>
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
                className={`relative ${shellClasses.iconButton} h-9 px-3 gap-1.5 border-0 hover:bg-black/5 dark:hover:bg-white/5 !min-w-0`}
                iconClassName="h-4 w-4"
              />
            </div>
            
            <div className="order-1 md:order-2 flex items-center shrink-0">
              <Link
                href="/buyer/profile"
                className="flex items-center gap-2 outline-none hover:opacity-80 transition-opacity rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ml-1 shrink-0"
              >
                {isAuthLoading ? (
                  <div className="w-9 h-9 min-w-9 rounded-full bg-muted flex items-center justify-center border border-border shadow-sm animate-pulse shrink-0" />
                ) : user?.user_metadata?.avatar_url || user?.user_metadata?.picture ? (
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
            </div>
          </div>
        }
      />

      {/* Main Content Area */}
      <main className={cn(
        "flex-1 flex flex-col min-w-0 w-full relative",
        !pathname.match(/^\/buyer\/(reservations|course|ticket|book|downloads)\//) && "max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8"
      )}>
        {isAuthLoading ? (
          <div className="w-full max-w-4xl mx-auto space-y-4 animate-in fade-in duration-500 mt-8 px-4 md:px-8">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : (
          children
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <img
              src="/images/logo.png"
              alt="Market Fit"
              className="h-4 w-4 object-contain dark:brightness-0 dark:invert grayscale opacity-50"
            />
            <span>&copy; {new Date().getFullYear()} Market Fit. {t("buyer.layout.footer.allRightsReserved") || "All rights reserved."}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Locale and Theme have been moved to the top header */}
          </div>
        </div>
      </footer>
    </div>
  )
}
