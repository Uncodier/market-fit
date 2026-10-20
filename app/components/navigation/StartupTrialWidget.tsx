"use client"

import { useEffect, useState, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import { useOptionalSite } from "@/app/context/SiteContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { getStartupTrial } from "@/app/services/startup-trial"
import { Button } from "@/app/components/ui/button"
import { Sparkles } from "@/app/components/ui/icons"
import { SectionCard } from "@/app/components/ui/section-card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { navigateOrAssign } from "@/lib/navigation/stale-router"
import { cn } from "@/lib/utils"
import { z } from "zod"

const DEFER_MS = 1_000
const ELIGIBILITY_TTL_MS = 60_000
const siteIdSchema = z.string().uuid()
const trialCopy = "15 days · 50 credits · No card"

interface StartupTrialWidgetProps {
  className?: string
  isCollapsed?: boolean
}

export function StartupTrialWidget(props: StartupTrialWidgetProps) {
  const site = useOptionalSite()?.currentSite
  const permissions = useOptionalPermissions()
  const billing = site?.billing
  const capabilities = permissions?.capabilities

  // This only avoids unnecessary reads. The server owns payment/history eligibility.
  if (!site || !siteIdSchema.safeParse(site.id).success || site.billing_read_status !== "loaded" ||
      !billing || billing.plan !== "commission" || (billing.addons_count ?? 0) !== 0 ||
      billing.trial_started_at != null || billing.trial_ends_at != null || billing.trial_converted_at != null ||
      permissions?.siteId !== site.id || capabilities?.update !== true ||
      !(capabilities.is_owner === true || capabilities.role === "owner" || capabilities.role === "admin")) {
    return null
  }

  // Remount before rendering on relevant changes; a former eligible state is never reused.
  // Balance-only updates deliberately do not trigger another eligibility request.
  const scope = JSON.stringify([
    site.id, capabilities.role, capabilities.is_owner, billing.plan, billing.addons_count,
    billing.paid_subscription_plan, billing.paid_subscription_addons_count,
    billing.paid_subscription_period_start, billing.paid_subscription_period_end,
    billing.paid_subscription_invoice_id, billing.paid_subscription_paid_at,
  ])
  return <ScopedStartupTrialWidget key={scope} siteId={site.id} {...props} />
}

function ScopedStartupTrialWidget({ siteId, className, isCollapsed }: StartupTrialWidgetProps & { siteId: string }) {
  const router = useRouter()
  const [eligibleUntil, setEligibleUntil] = useState(0)

  useEffect(() => {
    let disposed = false
    let deferred: ReturnType<typeof setTimeout> | undefined
    let expiration: ReturnType<typeof setTimeout> | undefined
    let request: AbortController | null = null
    let nextCheck = 0

    async function load() {
      deferred = undefined
      const controller = new AbortController()
      request = controller
      setEligibleUntil(0)
      try {
        // The existing service validates the response and bounds the entire GET to 15s.
        const trial = await getStartupTrial(siteId, controller)
        if (disposed || controller.signal.aborted) return
        if (trial.state === "eligible" && trial.offer_eligible === true) {
          setEligibleUntil(Date.now() + ELIGIBILITY_TTL_MS)
          expiration = setTimeout(() => setEligibleUntil(0), ELIGIBILITY_TTL_MS)
        }
      } catch {
        // Failed or malformed reads must never advertise a trial promise.
        if (!disposed) setEligibleUntil(0)
      } finally {
        if (!disposed) {
          request = null
          nextCheck = Date.now() + ELIGIBILITY_TTL_MS
        }
      }
    }

    function schedule() {
      if (disposed || deferred !== undefined || request || Date.now() < nextCheck) return
      deferred = setTimeout(() => { void load() }, DEFER_MS)
    }
    function onVisible() {
      if (document.visibilityState === "visible") schedule()
    }

    schedule()
    window.addEventListener("focus", schedule)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      disposed = true
      clearTimeout(deferred)
      clearTimeout(expiration)
      request?.abort()
      window.removeEventListener("focus", schedule)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [siteId])

  if (!eligibleUntil) return null

  const href = `/billing?siteId=${encodeURIComponent(siteId)}&tab=billing_info#startup-trial`
  function openBilling(event: MouseEvent<HTMLElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (Date.now() >= eligibleUntil) {
      setEligibleUntil(0)
      return
    }
    navigateOrAssign(router, href)
  }

  if (isCollapsed) {
    return <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon" data-permission="allow"
            aria-label="Activate trial" className={cn("!h-8 !w-8 text-primary my-1", className)} onClick={openBilling}>
            <Sparkles size={18} aria-hidden={true} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <p className="font-medium">Startup trial</p>
          <p>{trialCopy}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  }

  return <SectionCard className={cn("mx-4 my-1 px-3 py-3 space-y-2", className)}>
    <p className="flex items-center gap-2 text-xs font-medium">
      <Sparkles size={16} className="text-primary shrink-0" aria-hidden={true} />
      Startup trial
    </p>
    <p className="text-[10px] text-muted-foreground">{trialCopy}</p>
    <Button asChild variant="secondary" size="sm" data-permission="allow" className="w-full text-xs">
      <a href={href} onClick={openBilling}>Activate trial</a>
    </Button>
  </SectionCard>
}