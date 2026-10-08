"use client"

import { useRef, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { prepareSiteBilling } from "@/app/services/initialize-site-billing"
import { BillingSetupWarning } from "@/app/components/billing/billing-setup-warning"

/** Mounted per site: retries never insert another site or replay external setup. */
export function BillingInitialization({ siteId, hasBilling, billingReadFailed = false }: {
  siteId: string; hasBilling: boolean; billingReadFailed?: boolean
}) {
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
    try {
      if (billingReadFailed) {
        // A failed read must never trigger an initial grant for an existing account.
        await refreshSiteBilling(siteId)
        setMessage(null)
      } else {
        setMessage(await prepareSiteBilling(siteId, refreshSiteBilling))
      }
    } catch {
      setMessage("Billing information could not be loaded. Your payment status has not changed. Retry loading billing or contact support.")
    } finally {
      setIsLoading(false)
      inFlight.current = false
    }
  }

  if (siteId.startsWith("demo-")) return null
  if (isLoading) return <p role="status" className="my-4 text-sm">{billingReadFailed ? "Loading billing information..." : "Confirming billing setup..."}</p>
  if (hasBilling && !billingReadFailed) return null
  if (billingReadFailed) return <div role="alert" className="my-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-slate-950">
    <p>{message ?? "Billing information could not be loaded. This does not mean your subscription is unpaid or initial credits are missing."}</p>
    <button type="button" className="mt-3 rounded-md border bg-white px-4 py-2" onClick={() => void retry()}>Retry loading billing</button>
  </div>
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