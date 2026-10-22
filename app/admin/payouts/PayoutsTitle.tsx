"use client"

import { useLocalization } from "@/app/context/LocalizationContext"

export function PayoutsTitle() {
  const { t } = useLocalization()

  return (
    <div>
      <h1 className="text-3xl font-bold">{t("content.payouts.title")}</h1>
      <p className="text-muted-foreground mt-2">{t("content.payouts.description")}</p>
    </div>
  )
}