"use client"

import { useEffect, useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { TemporaryWorkspaceLicense } from "@/lib/billing/startup-trial"

export function useTemporaryWorkspaceLicenseClock(endsAt?: string) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const end = Date.parse(endsAt ?? "")
    let timer: ReturnType<typeof setTimeout>
    function check() {
      const remaining = end - Date.now()
      if (remaining > 0) timer = setTimeout(check, Math.min(remaining, 86_400_000))
      else setTick(tick => tick + 1)
    }
    if (end > Date.now()) check()
    return () => clearTimeout(timer)
  }, [endsAt])
  return Date.now()
}

export function TemporaryWorkspaceLicenseNotice({ license }: { license: TemporaryWorkspaceLicense }) {
  const { locale, t } = useLocalization()
  const name = { engine: "Engine", foundry: "Foundry", enterprise: "Reactor" }[license.plan]
  const grace = license.kind === 'emergency_grace'
  return <p className="text-sm text-muted-foreground">
    <strong>{t('billing.access.tier', { plan: name }) || `${name} workspace access`}</strong> {t('billing.access.through') || 'through'}{" "}
    <time dateTime={license.ends_at}>{new Date(license.ends_at).toLocaleString(locale || "en", {
      dateStyle: "medium", timeStyle: "short",
    })}</time>. {grace ? (t('billing.access.grace') || 'Emergency access does not pay your invoice or add credits.') :
      (t('billing.access.noRenewal') || 'Automatic renewal is off.')}
  </p>
}