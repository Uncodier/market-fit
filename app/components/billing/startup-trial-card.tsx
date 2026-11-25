"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import {
  getBillingTrial, getStartupTrial, startStartupTrial, waitForStartupTrial,
  STARTUP_TRIAL_REFRESH_TIMEOUT_MS, type StartupTrial,
} from "@/app/services/startup-trial"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Progress } from "../ui/progress"
import { ArrowRight, Clock, Sparkles } from "../ui/icons"
import { SectionCard, SectionCardHeader, SectionCardContent, SectionCardFooter } from "../ui/section-card"
import { STARTUP_TRIAL_CREDITS } from "@/lib/billing/startup-trial"
import { PaidThroughNotice } from "./paid-through-notice"

// Remount immediately on site changes so another site's eligibility is never clickable.
export function StartupTrialCard({ siteId, recoveryScope }: { siteId: string; recoveryScope?: string }) {
  return <SiteStartupTrialCard key={JSON.stringify([siteId, recoveryScope])} siteId={siteId} includeRecovery={!!recoveryScope} />
}

function countdown(milliseconds: number): string {
  const minutes = Math.ceil(Math.max(0, milliseconds) / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  return `${days}d ${hours}h ${minutes % 60}m`
}

function SiteStartupTrialCard({ siteId, includeRecovery }: { siteId: string; includeRecovery: boolean }) {
  const { refreshSiteBilling } = useSite()
  const permissions = useOptionalPermissions()
  const canActivate = permissions?.siteId === siteId && permissions.capabilities?.update === true &&
    (permissions.capabilities.is_owner || ["owner", "admin"].includes(permissions.capabilities.role ?? ""))
  const [trial, setTrial] = useState<StartupTrial | null>(null)
  const [paidThrough, setPaidThrough] = useState<string>()
  const [operation, setOperation] = useState<"load" | "start" | "reconcile" | "refresh" | null>("load")
  const [error, setError] = useState<"load" | "start" | null>(null)
  const [refreshWarning, setRefreshWarning] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [clock, setClock] = useState(Date.now)
  const [offset, setOffset] = useState(0)
  const request = useRef<AbortController | null>(null)
  const refresh = useRef(refreshSiteBilling)
  const nextExpirationCheck = useRef(0)

  useEffect(() => { refresh.current = refreshSiteBilling }, [refreshSiteBilling])

  const applyTrial = useCallback((loaded: StartupTrial) => {
    const now = Date.now()
    setTrial(loaded)
    setClock(now)
    setOffset(Date.parse(loaded.server_now) - now)
  }, [])

  const refreshBilling = useCallback(async (controller: AbortController) => {
    try {
      await waitForStartupTrial(() => refresh.current(siteId), controller, STARTUP_TRIAL_REFRESH_TIMEOUT_MS)
      if (request.current === controller) setRefreshWarning(false)
    } catch {
      if (request.current === controller) setRefreshWarning(true)
    }
  }, [siteId])

  const load = useCallback(async (reconcile = false) => {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setOperation(reconcile ? "reconcile" : "load")
    setError(null)
    setPaidThrough(undefined)
    if (!reconcile) setTrial(null)
    let refreshRequired = reconcile
    try {
      const loaded = includeRecovery ? await getBillingTrial(siteId, controller) : await getStartupTrial(siteId, controller)
      if (request.current !== controller) return
      applyTrial(loaded)
      if ("paid_through" in loaded && typeof loaded.paid_through === "string") setPaidThrough(loaded.paid_through)
      // An earlier activation may have committed despite a lost POST response.
      // Hydrate shared permissions/balances on every confirmed active status read.
      refreshRequired ||= loaded.state === "active" || loaded.state === "expired" || loaded.state === "converted"
    } catch {
      if (request.current === controller) {
        setTrial(null)
        setError("load")
      }
    } finally {
      // A GET may reconcile an expired grant even when its response was interrupted.
      if (request.current === controller) {
        const completion = refreshRequired ? new AbortController() : controller
        request.current = completion
        if (refreshRequired) await refreshBilling(completion)
        if (request.current === completion) {
          request.current = null
          setOperation(null)
        }
      }
    }
  }, [applyTrial, includeRecovery, refreshBilling, siteId])

  useEffect(() => {
    void load()
    return () => {
      const controller = request.current
      request.current = null
      controller?.abort()
    }
  }, [load])

  useEffect(() => {
    if (trial?.state !== "active") return
    const tick = () => setClock(Date.now())
    const interval = setInterval(tick, 1000)
    window.addEventListener("focus", tick)
    document.addEventListener("visibilitychange", tick)
    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", tick)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [trial?.state])

  const remainingMs = trial?.ends_at ? Date.parse(trial.ends_at) - (clock + offset) : 0
  const expirationDue = trial?.state === "active" && remainingMs <= 0
  useEffect(() => {
    if (!expirationDue || operation || request.current || clock < nextExpirationCheck.current) return
    // Avoid a tight retry loop if a boundary response still reports active.
    nextExpirationCheck.current = Date.now() + 30_000
    void load(true)
  }, [clock, expirationDue, load, operation])

  async function activate() {
    if (!canActivate || trial?.state !== "eligible" || operation || request.current) return
    const controller = new AbortController()
    request.current = controller
    setOperation("start")
    setError(null)
    try {
      const activated = await startStartupTrial(siteId, controller)
      if (request.current !== controller) return
      applyTrial(activated)
      setConfirmed(true)
      await refreshBilling(controller)
    } catch {
      if (request.current === controller) {
        // The POST may have succeeded: only an explicit GET retry can unlock activation.
        setTrial(null)
        setError("start")
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        setOperation(null)
      }
    }
  }

  async function retryRefresh() {
    if (operation || request.current) return
    const controller = new AbortController()
    request.current = controller
    setOperation("refresh")
    await refreshBilling(controller)
    if (request.current === controller) {
      request.current = null
      setOperation(null)
    }
  }

  // Do not advertise a trial before its eligibility is known or when it is denied.
  // Unconfirmed operations and hydration failures retain their recovery controls.
  const recoveryNotice = paidThrough ? <PaidThroughNotice key={paidThrough} paidThrough={paidThrough} /> : null
  if ((!trial || trial.state === "unavailable") && !error && !refreshWarning) return recoveryNotice

  const isActive = trial?.state === "active" && !expirationDue
  const statusLabel = expirationDue ? "Confirming status" : {
    eligible: "Ready to start", active: "Active", expired: "Ended", converted: paidThrough ? "Previously converted" : "Paid plan", unavailable: "Unavailable",
  }[trial?.state ?? "unavailable"]

  return <>{recoveryNotice}<SectionCard id="startup-trial" className="mb-6" aria-busy={operation !== null}>
    <SectionCardHeader className="gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/50">
            <Sparkles size={22} aria-hidden={true} />
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="text-lg font-semibold tracking-tight">Startup trial</h3>
            <p className="text-sm text-muted-foreground">{isActive ? "Startup trial is active" : "Try Startup for 15 days."}</p>
          </div>
        </div>
        {trial && <Badge variant="outline" className={isActive
          ? "gap-1.5 border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
          : "bg-muted/40 px-2.5 py-1 font-medium text-muted-foreground"}>
          {isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />}
          {statusLabel}
        </Badge>}
      </div>
    </SectionCardHeader>
    <SectionCardContent className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
      {operation === "load" && <p role="status" className="text-sm">Checking trial availability…</p>}
      {operation === "start" && <p role="status" className="text-sm">Confirming trial activation…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error === "start"
        ? "Trial activation could not be confirmed. Reload trial status before trying again; your trial may already have started."
        : "Startup trial is currently unavailable. Reload trial status or try again later."}</p>}
      {trial?.state === "eligible" && <p className="text-sm">{canActivate
        ? "Your site is eligible. Start when you are ready."
        : "Ask a site owner or admin with update permission to activate the trial."}</p>}
      {trial?.state === "active" && <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-border/60 bg-muted/20 p-4 sm:p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock size={16} aria-hidden={true} /> Time remaining
          </p>
          {expirationDue ? <p role="status" className="text-sm font-medium">Trial time has ended. Confirming current status…</p>
            : <p aria-label="Trial time remaining" className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
              {countdown(remainingMs)}<span className="sr-only"> remaining</span>
            </p>}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Ends <time dateTime={trial.ends_at!}>
            {new Date(trial.ends_at!).toLocaleString("en-US", {
              month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
            })}
          </time></p>
        </div>
        <div className="min-w-0 rounded-xl border border-border/60 bg-muted/20 p-4 sm:p-5">
          <p className="mb-3 text-sm font-medium text-muted-foreground">Trial credits remaining</p>
          <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
            <span className="text-2xl font-semibold tracking-tight sm:text-3xl">{trial.credits_remaining}</span>
            <span className="text-sm text-muted-foreground">of {STARTUP_TRIAL_CREDITS} credits</span>
          </p>
          <Progress className="mt-3 h-1.5" indicatorClassName="bg-emerald-500 dark:bg-emerald-400 motion-reduce:transition-none"
            value={trial.credits_remaining / STARTUP_TRIAL_CREDITS * 100}
            aria-label="Trial credits remaining" aria-valuetext={`${trial.credits_remaining} of ${STARTUP_TRIAL_CREDITS} credits remaining`} />
        </div>
      </div>}
      {trial?.state === "expired" && <p className="text-sm">Your Startup trial has ended. Trial credits do not renew. Choose a paid plan explicitly to continue with Startup (Foundry).</p>}
      {trial?.state === "converted" && <p className="text-sm">Your site has moved to a paid plan. The one-time Startup trial cannot be restarted.</p>}
      {confirmed && <p role="status" className="text-sm">Trial activation is confirmed. It will not be restarted.</p>}
      {refreshWarning && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">{confirmed
        ? "Trial activation is confirmed, but billing information could not be refreshed. Reload billing information; do not restart the trial."
        : "Trial status was checked, but billing information could not be refreshed. Reload billing information to confirm your latest balance."}</p>}
      <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
        <p>50 one-time credits total, not a monthly allowance. Credits do not renew and unused trial credits expire when the trial ends.</p>
        <p>No card required. No automatic billing or paid subscription.{trial?.state === "eligible" && " Your 15 days start only when you click Start."}</p>
      </div>
    </SectionCardContent>
    {(trial?.state === "eligible" || trial?.state === "active" || trial?.state === "expired" || error || refreshWarning) &&
      <SectionCardFooter className="flex-col items-stretch gap-3 px-5 sm:flex-row sm:flex-wrap sm:items-center sm:px-6">
        {(trial?.state === "active" || trial?.state === "expired") && <p className="mr-auto text-xs text-muted-foreground">Continue with Startup on your terms.</p>}
        {trial?.state === "eligible" && <Button type="button" size="sm" data-permission="allow"
          disabled={!canActivate || operation !== null} onClick={() => void activate()}>Start 15-day Startup trial</Button>}
        {(trial?.state === "active" || trial?.state === "expired") && <Button asChild variant="outline" size="sm" className="whitespace-normal text-center" data-permission="allow">
          <a href="#subscription-plan">View paid Startup (Foundry) plans <ArrowRight size={16} className="ml-2 shrink-0" aria-hidden={true} /></a>
        </Button>}
        {error && <Button type="button" variant="outline" size="sm" disabled={operation !== null}
          onClick={() => void load()}>Reload trial status</Button>}
        {refreshWarning && <Button type="button" variant="outline" size="sm" disabled={operation !== null}
          onClick={() => void retryRefresh()}>Reload billing information</Button>}
      </SectionCardFooter>}
  </SectionCard></>
}