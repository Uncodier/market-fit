"use client"

import { useEffect, useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { useOptionalSite } from "@/app/context/SiteContext"
import { ChevronRight, CreditCard } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { CreditsWidget } from "./CreditsWidget"
import { NavigationLink } from "./NavigationLink"

const RECHECK_INTERVAL_MS = 75_000

export function SidebarBillingWidget({ actorId, isCollapsed }: { actorId?: string; isCollapsed: boolean }) {
  const site = useOptionalSite()
  const permissions = useOptionalPermissions()
  const current = site?.currentSite
  const scope = site?.requestScope
  if (!current || site.isLoading || current.id.startsWith("demo-")) return null
  if (scope && (scope.actorId !== actorId || scope.siteId !== current.id)) return null

  const capabilities = permissions?.siteId === current.id ? permissions?.capabilities : null
  if (scope && capabilities?.select !== true) return null
  const isOwner = capabilities?.role === "owner" && capabilities.select === true
  if (!isOwner) return <CreditsWidget isCollapsed={isCollapsed} />
  const billing = current.billing
  if (!actorId || !scope || !billing?.stripe_customer_id || current.billing_read_status === "unavailable") return null

  // Never carry a pending invoice result across tenants, actors, or a new settlement.
  const key = JSON.stringify([actorId, current.id, billing.stripe_customer_id, billing.paid_subscription_invoice_id])
  return <PendingInvoiceLink key={key} siteId={current.id} isCollapsed={isCollapsed} />
}

function PendingInvoiceLink({ siteId, isCollapsed }: { siteId: string; isCollapsed: boolean }) {
  const { t } = useLocalization()
  const [hasPendingInvoice, setHasPendingInvoice] = useState(false)

  useEffect(() => {
    let request: AbortController | undefined
    let expiration: ReturnType<typeof setTimeout> | undefined
    let nextCheck = 0

    async function check() {
      if (request || Date.now() < nextCheck) return
      clearTimeout(expiration)
      setHasPendingInvoice(false)
      const controller = new AbortController()
      request = controller
      nextCheck = Date.now() + RECHECK_INTERVAL_MS
      const timeout = setTimeout(() => {
        controller.abort()
        if (request === controller) {
          request = undefined
          setHasPendingInvoice(false)
        }
      }, 15_000)
      try {
        const response = await fetch(`/api/stripe/pending-invoice?siteId=${encodeURIComponent(siteId)}`, {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
        })
        const pending = response.ok && (await response.json())?.hasPendingInvoice === true
        if (controller.signal.aborted) return
        setHasPendingInvoice(pending)
        if (pending) {
          expiration = setTimeout(() => {
            if (document.visibilityState === "visible") void check()
            else setHasPendingInvoice(false)
          }, nextCheck - Date.now())
        }
      } catch {
        if (request === controller) setHasPendingInvoice(false)
      } finally {
        clearTimeout(timeout)
        if (request === controller) request = undefined
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible") void check()
    }

    const deferred = setTimeout(onVisible, 1_000)
    window.addEventListener("focus", onVisible)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearTimeout(deferred)
      clearTimeout(expiration)
      const activeRequest = request
      request = undefined
      activeRequest?.abort()
      window.removeEventListener("focus", onVisible)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [siteId])

  if (!hasPendingInvoice) return null

  const label = t("billing.form.manageSub") || "Manage billing"
  return (
    <div className={cn("px-3 py-2", isCollapsed && "flex justify-center px-0")}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <NavigationLink
              href="/billing"
              aria-label={label}
              className={cn(
                "flex items-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors",
                isCollapsed ? "h-8 w-8 justify-center" : "w-full gap-2 p-3 text-xs font-medium"
              )}
            >
              <CreditCard size={16} className="shrink-0" aria-hidden={true} />
              {!isCollapsed && <>
                <span className="min-w-0 flex-1">{label}</span>
                <ChevronRight size={14} className="shrink-0" aria-hidden={true} />
              </>}
            </NavigationLink>
          </TooltipTrigger>
          {isCollapsed && <TooltipContent side="right" className="z-[9999]">{label}</TooltipContent>}
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}