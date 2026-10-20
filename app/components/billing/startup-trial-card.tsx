"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import {
  getStartupTrial, startStartupTrial, waitForStartupTrial,
  STARTUP_TRIAL_REFRESH_TIMEOUT_MS, type StartupTrial,
} from "@/app/services/startup-trial"
import { Button } from "../ui/button"
import { SectionCard, SectionCardHeader, SectionCardContent, SectionCardFooter } from "../ui/section-card"

// Remount immediately on site changes so another site's eligibility is never clickable.
export function StartupTrialCard({ siteId }: { siteId: string }) {
  return <SiteStartupTrialCard key={siteId} siteId={siteId} />
}

function countdown(milliseconds: number): string {
  const minutes = Math.ceil(Math.max(0, milliseconds) / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  return `${days}d ${hours}h ${minutes % 60}m remaining`
}

function SiteStartupTrialCard({ siteId }: { siteId: string }) {
  const { refreshSiteBilling } = useSite()
  const permissions = useOptionalPermissions()
  const canActivate = permissions?.siteId === siteId && permissions.capabilities?.update === true &&
    (permissions.capabilities.is_owner || ["owner", "admin"].includes(permissions.capabilities.role ?? ""))
  const [trial, setTrial] = useState<StartupTrial | null>(null)
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
    if (!reconcile) setTrial(null)
    let refreshRequired = reconcile
    try {
      const loaded = await getStartupTrial(siteId, controller)
      if (request.current !== controller) return
      applyTrial(loaded)
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
  }, [applyTrial, refreshBilling, siteId])

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
  if ((!trial || trial.state === "unavailable") && !error && !refreshWarning) return null

  return <SectionCard id="startup-trial" className="mb-6" aria-busy={operation !== null}>
    <SectionCardHeader title="Startup trial" description="Try Startup for 15 days." />
    <SectionCardContent>
      <p className="text-sm">50 one-time credits total, not a monthly allowance. Credits do not renew and unused trial credits expire when the trial ends.</p>
      <p className="text-sm text-muted-foreground">No card required. No automatic billing or paid subscription. Your 15 days start only when you click Start.</p>
      {operation === "load" && <p role="status" className="text-sm">Checking trial availability…</p>}
      {operation === "start" && <p role="status" className="text-sm">Confirming trial activation…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error === "start"
        ? "Trial activation could not be confirmed. Reload trial status before trying again; your trial may already have started."
        : "Startup trial is currently unavailable. Reload trial status or try again later."}</p>}
      {trial?.state === "eligible" && <p className="text-sm">{canActivate
        ? "Your site is eligible. Start when you are ready."
        : "Ask a site owner or admin with update permission to activate the trial."}</p>}
      {trial?.state === "active" && <div className="space-y-2 text-sm">
        <p className="font-medium">{expirationDue ? "Trial time has ended. Confirming current status…" : "Startup trial is active"}</p>
        {!expirationDue && <p aria-label="Trial time remaining">{countdown(remainingMs)}</p>}
        <p>Trial credits remaining: {trial.credits_remaining} of 50</p>
        <p>Ends <time dateTime={trial.ends_at!}>{new Date(trial.ends_at!).toLocaleString("en-US")}</time></p>
      </div>}
      {trial?.state === "expired" && <p className="text-sm">Your Startup trial has ended. Trial credits do not renew. Choose a paid plan explicitly to continue with Startup (Foundry).</p>}
      {trial?.state === "converted" && <p className="text-sm">Your site has moved to a paid plan. The one-time Startup trial cannot be restarted.</p>}
      {confirmed && <p role="status" className="text-sm">Trial activation is confirmed. It will not be restarted.</p>}
      {refreshWarning && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">{confirmed
        ? "Trial activation is confirmed, but billing information could not be refreshed. Reload billing information; do not restart the trial."
        : "Trial status was checked, but billing information could not be refreshed. Reload billing information to confirm your latest balance."}</p>}
    </SectionCardContent>
    {(trial?.state === "eligible" || trial?.state === "active" || trial?.state === "expired" || error || refreshWarning) &&
      <SectionCardFooter className="flex-wrap">
        {trial?.state === "eligible" && <Button type="button" size="sm" data-permission="allow"
          disabled={!canActivate || operation !== null} onClick={() => void activate()}>Start 15-day Startup trial</Button>}
        {(trial?.state === "active" || trial?.state === "expired") && <Button asChild variant="outline" size="sm" data-permission="allow">
          <a href="#subscription-plan">View paid Startup (Foundry) plans</a>
        </Button>}
        {error && <Button type="button" variant="outline" size="sm" disabled={operation !== null}
          onClick={() => void load()}>Reload trial status</Button>}
        {refreshWarning && <Button type="button" variant="outline" size="sm" disabled={operation !== null}
          onClick={() => void retryRefresh()}>Reload billing information</Button>}
      </SectionCardFooter>}
  </SectionCard>
}