"use client"

import { Button } from "@/app/components/ui/button"
import { Sun, Moon } from "@/app/components/ui/icons"
import { LocaleSelector } from "@/app/components/commerce/LocaleSelector"
import { CurrencySelector } from "@/app/components/commerce/CurrencySelector"
import { useTheme } from "@/app/context/ThemeContext"
import { useLocalization } from "@/app/context/LocalizationContext"

export function MarketplaceFooter({
  effectiveKind,
  setSelectedKind,
  setSelectedSubtype,
}: {
  effectiveKind: string
  setSelectedKind: (kind: string) => void
  setSelectedSubtype: (subtype: string) => void
}) {
  const { t } = useLocalization()
  const { theme, toggleTheme } = useTheme()

  const go = (kind: string) => {
    setSelectedKind(kind)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <footer className="bg-muted/30 border-t py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between gap-8">
        <div>
          <div className="text-2xl font-black tracking-tight text-primary mb-2">MARKETPLACE</div>
          <div className="text-sm text-muted-foreground mb-4 max-w-sm">
            {t("marketplace.footer.desc") ||
              "Discover and purchase products, services, and digital assets."}
          </div>
          <div className="text-sm text-muted-foreground mb-4">
            &copy; {new Date().getFullYear()} Makinari Inc.{" "}
            {t("marketplace.footer.rights") || "All rights reserved."}
          </div>
          <div className="flex items-center gap-2">
            <CurrencySelector className="rounded-full" />
            <LocaleSelector className="rounded-full" />
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        <div className="flex gap-12">
          <div>
            <h4 className="font-bold mb-4">{t("marketplace.categories.title") || "Categories"}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <button onClick={() => go("all")} className="hover:text-foreground transition-colors">
                  {t("marketplace.categories.all") || "All Items"}
                </button>
              </li>
              <li>
                <button onClick={() => go("product")} className="hover:text-foreground transition-colors">
                  {t("marketplace.categories.products") || "Products"}
                </button>
              </li>
              <li>
                <button onClick={() => go("service")} className="hover:text-foreground transition-colors">
                  {t("marketplace.categories.services") || "Services"}
                </button>
              </li>
              <li>
                <button onClick={() => go("digital_asset")} className="hover:text-foreground transition-colors">
                  {t("marketplace.categories.digitalAssets") || "Digital Assets"}
                </button>
              </li>
              <li>
                <button onClick={() => go("recurring")} className="hover:text-foreground transition-colors">
                  {t("marketplace.categories.subscriptions") || "Subscriptions"}
                </button>
              </li>
            </ul>
          </div>
          {effectiveKind === "digital_asset" && (
            <div>
              <h4 className="font-bold mb-4">{t("marketplace.subtypes.title") || "Subtypes"}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {[
                  ["all", "marketplace.subtypes.all", "All"],
                  ["course", "marketplace.subtypes.courses", "Courses"],
                  ["ticket", "marketplace.subtypes.tickets", "Tickets"],
                  ["pass", "marketplace.subtypes.passes", "Passes"],
                  ["license", "marketplace.subtypes.licenses", "Licenses"],
                  ["file", "marketplace.subtypes.files", "Files"],
                ].map(([value, key, fallback]) => (
                  <li key={value}>
                    <button
                      onClick={() => {
                        setSelectedSubtype(value)
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }}
                      className="hover:text-foreground transition-colors"
                    >
                      {t(key) || fallback}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}
