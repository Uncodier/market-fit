"use client"

import { useRef, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { prepareSiteBilling } from "@/app/services/initialize-site-billing"
import { BillingSetupWarning } from "@/app/components/billing/billing-setup-warning"

/** Mounted per site: retries never insert another site or replay external setup. */
export function BillingInitialization({ siteId, hasBilling }: { siteId: string; hasBilling: boolean }) {
  const { refreshSiteBilling } = useSite()
  const permissions = useOptionalPermissions()
  const canInitialize = permissions?.siteId === siteId &&
    (permissions.capabilities?.is_owner || ["owner", "admin"].includes(permissions.capabilities?.role ?? "")) &&
    permissions.capabilities?.update === true
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const inFlight = useRef(false)

  const retry = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setIsLoading(true)
    const warning = await prepareSiteBilling(siteId, refreshSiteBilling)
    setMessage(warning)
    setIsLoading(false)
    inFlight.current = false
  }

  if (siteId.startsWith("demo-")) return null
  if (isLoading) return <p role="status" className="my-4 text-sm">Confirming billing setup...</p>
  if (message) return <BillingSetupWarning message={message} isLoading={isLoading} onRetry={canInitialize ? () => void retry() : undefined} />
  if (!hasBilling) return <BillingSetupWarning
    message={canInitialize
      ? "Initial credits are not confirmed. Your project is saved; retry billing setup without recreating the project."
      : "Initial credits are not confirmed. Your project is saved; ask a project owner or admin to complete billing setup. Do not recreate the project."}
    isLoading={false}
    onRetry={canInitialize ? () => void retry() : undefined}
  />
  return null
}