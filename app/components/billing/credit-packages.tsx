"use client"

import { Button } from "../ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"

export const CREDIT_PACKAGES = [
  { credits: 20, price: 20, pricePerCredit: 1.00 },
  { credits: 52, price: 49.25, pricePerCredit: 0.95, discount: "1.5% off" },
  { credits: 515, price: 500, pricePerCredit: 0.97, discount: "3% off" },
] as const

export type CreditPackage = (typeof CREDIT_PACKAGES)[number]

interface CreditPackagesProps {
  onBuy: (pkg: CreditPackage) => void
}

export function CreditPackages({ onBuy }: CreditPackagesProps) {
  const { t } = useLocalization()

  return (
    <div className="divide-y rounded-lg border">
      {CREDIT_PACKAGES.map((pkg) => (
        <div key={pkg.credits} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">
                {pkg.credits} {t("billing.credits.credits") || "Credits"}
              </p>
              {pkg.discount && (
                <span className="text-xs text-muted-foreground">{pkg.discount}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              ${pkg.pricePerCredit.toFixed(2)} {t("billing.credits.perCredit") || "per credit"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-sm font-medium tabular-nums">${pkg.price}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => onBuy(pkg)}>
              {t("billing.credits.buy") || "Buy"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
