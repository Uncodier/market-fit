"use client"

import { useLocalization } from "@/app/context/LocalizationContext"

export function ConnectorProviderMode({ source }: { source?: "byok" | "platform" }) {
  const { t } = useLocalization()
  return <div className="space-y-1 text-sm text-muted-foreground">
    <p>{t(source === "platform" ? "connectors.platformMode" : source === "byok" ? "connectors.byokMode" : "connectors.providerModeUnknown")}</p>
    <p className="text-xs">{t("connectors.providerCosts")}</p>
  </div>
}