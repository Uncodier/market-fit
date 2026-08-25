"use client"

import { Button } from "@/app/components/ui/button"
import { CreditCard, Moon, Sun } from "@/app/components/ui/icons"
import { LocaleSelector } from "@/app/components/commerce/LocaleSelector"
import { CurrencySelector } from "@/app/components/commerce/CurrencySelector"
import { useTheme } from "@/app/context/ThemeContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"

export function ShopSiteFooter({ siteName }: { siteName: string }) {
  const { theme, toggleTheme } = useTheme()
  const { t } = useLocalization()

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-2xl font-black tracking-tight text-gray-400 dark:text-gray-600">
          {siteName}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          &copy; {new Date().getFullYear()} {siteName}.{" "}
          {t("shop.allRightsReserved") || "All rights reserved."}{" "}
          {t("shop.poweredBy") || "Powered by Makinari."}
        </div>
        <div className="flex items-center gap-2">
          <CreditCard className="h-8 w-8 text-gray-300 dark:text-gray-700" />
          <CurrencySelector className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400" />
          <LocaleSelector className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400" />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-800"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5 text-gray-400 hover:text-black dark:hover:text-white" />
            ) : (
              <Moon className="h-5 w-5 text-gray-500 hover:text-black dark:hover:text-white" />
            )}
          </Button>
        </div>
      </div>
    </footer>
  )
}

export function ShopMobileCartCta({
  cartCount,
  subtotal,
  currency,
  onOpen,
}: {
  cartCount: number
  subtotal: number
  currency?: string
  onOpen: () => void
}) {
  const { t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-950 border-t dark:border-gray-800 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-none z-30 md:hidden animate-in slide-in-from-bottom-full">
      <Button
        className="w-full h-14 text-lg rounded-xl font-bold flex items-center justify-between px-6"
        onClick={onOpen}
      >
        <div className="flex items-center gap-2">
          <span className="bg-white/20 px-2 py-0.5 rounded-md text-sm">{cartCount}</span>
          <span>{t("shop.checkout") || "Checkout"}</span>
        </div>
        <span>{formatPrice(subtotal, currency || "USD")}</span>
      </Button>
    </div>
  )
}
