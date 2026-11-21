"use client"

import { useLayoutEffect, useRef, type Dispatch, type SetStateAction } from "react"
import { loadAccessibleSites, type LoadSitesDeps } from "./site-load-sites"
import { applyCurrentSite } from "./site-set-current"
import type { Site } from "./site-types"
import { cacheSiteSelection, clearSiteSelectionCache, discardForeignSiteSelection, readSiteSelection } from "./site-selection-cache"
import { isDemoModeActive } from "@/lib/demo-utils"
import { refreshSiteBillingRecord } from "./site-refresh-billing"

type LifecycleDeps = Omit<LoadSitesDeps, "supabase" | "selectSite" | "reload"> & {
  supabaseRef: { current: LoadSitesDeps["supabase"] }
  authUserIdRef: { current: string | null }
}

export const SITE_HYDRATION_TIMEOUT_MS = 10_000

/** One generation owns all publications, including deferred React state updaters. */
export function useSiteLoadingLifecycle(deps: LifecycleDeps) {
  const latest = useRef(deps)
  const generation = useRef(0)
  const active = useRef(true)
  const hydrating = useRef(false)
  const selection = useRef<Promise<void> | null>(null)
  const initialLoad = useRef<Promise<void> | null>(null)
  const controller = useRef<AbortController | null>(null)
  const revalidationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function retire() {
    if (revalidationTimer.current) clearTimeout(revalidationTimer.current)
    revalidationTimer.current = null
    generation.current += 1
    controller.current?.abort()
    controller.current = null
    hydrating.current = false
    selection.current = null
    initialLoad.current = null
  }

  function begin() {
    retire()
    const next = new AbortController()
    controller.current = next
    return { request: generation.current, signal: next.signal }
  }
  useLayoutEffect(() => {
    // CRUD can clear/change selection without going through selectSite.
    if (!hydrating.current && deps.currentSite?.id !== latest.current.currentSite?.id) {
      retire()
    }
    latest.current = deps
  })
  useLayoutEffect(() => {
    active.current = true
    return () => { active.current = false; retire() }
  }, [])

  function invalidate() {
    clearSiteSelectionCache()
    retire()
    latest.current = { ...latest.current, currentSite: null, isInitialized: false }
  }

  function retireDeniedScope() {
    retire()
    latest.current = { ...latest.current, currentSite: null }
  }

  async function bounded(request: number, signal: AbortSignal, operation: () => Promise<void>, initial: boolean | (() => boolean)) {
    let timer: ReturnType<typeof setTimeout> | undefined
    let onAbort = () => {}
    const cancelled = new Promise<void>(resolve => {
      onAbort = resolve
      if (signal.aborted) resolve()
      else signal.addEventListener("abort", onAbort, { once: true })
    })
    const deadline = new Promise<void>(resolve => {
      timer = setTimeout(() => {
        if (active.current && generation.current === request) {
          retire()
          const state = latest.current
          if (typeof initial === "function" ? initial() : initial) state.setCurrentSite(null)
          state.setError(new Error("Site loading timed out. Please try again."))
          state.setIsLoading(false)
        }
        resolve()
      }, SITE_HYDRATION_TIMEOUT_MS)
    })
    try { await Promise.race([operation(), deadline, cancelled]) }
    finally { clearTimeout(timer); signal.removeEventListener("abort", onAbort) }
  }

  function guardSetter<T>(setter: Dispatch<SetStateAction<T>>, isCurrent: () => boolean) {
    return (value: SetStateAction<T>) => {
      if (!isCurrent()) return
      setter(previous => !isCurrent() ? previous :
        typeof value === "function" ? (value as (previous: T) => T)(previous) : value)
    }
  }

  function refreshBilling(site: Site | undefined, isCurrent: () => boolean) {
    if (!site || site.billing_read_status !== "unavailable" || !isCurrent()) return
    const stillSelected = () => isCurrent() && latest.current.currentSite?.id === site.id
    // Billing is an independent user-scoped RLS read, never a workspace/POS gate.
    void refreshSiteBillingRecord(site.id, {
      setSites: guardSetter(latest.current.setSites, stillSelected),
      setCurrentSite: guardSetter(latest.current.setCurrentSite, stillSelected),
    }).catch(() => { /* Keep the last known billing or its unavailable marker. */ })
    return true
  }

  async function select(site: Site, isCurrent: () => boolean, requireSettings = false) {
    if (!isCurrent()) return
    const state = latest.current
    if (!hydrating.current && state.currentSite?.id === site.id) return
    hydrating.current = true
    latest.current = { ...latest.current, currentSite: site }
    state.setIsLoading(true)
    try {
      await applyCurrentSite({
        site, currentSite: null, supabase: state.supabaseRef.current,
        requireSettings,
        setSites: guardSetter(state.setSites, isCurrent),
        setCurrentSite: guardSetter(state.setCurrentSite, isCurrent),
      })
    } finally {
      if (isCurrent()) {
        hydrating.current = false
        state.setIsLoading(false)
      }
    }
  }

  async function selectSite(site: Site) {
    if (!hydrating.current && latest.current.currentSite?.id === site.id) return
    const { request, signal } = begin()
    const isCurrent = () => active.current && generation.current === request
    cacheSiteSelection(latest.current.authUserIdRef.current, site)
    const pending = bounded(request, signal, async () => {
      await select(site, isCurrent)
      refreshBilling(site, isCurrent)
    }, true)
    selection.current = pending
    try { await pending }
    finally { if (selection.current === pending) selection.current = null }
  }

  async function loadSites(fresh = false) {
    // A metadata refresh cannot supersede an explicit selection's settings read.
    if (selection.current) return selection.current
    if (initialLoad.current) return initialLoad.current
    const state = latest.current
    if (!active.current || !state.isMounted || !state.supabaseRef.current) return
    const { request, signal } = begin()
    const isCurrent = () => active.current && generation.current === request
    let cacheHydrated = false
    const selectLoadedSite = async (site: Site) => {
      await select(site, isCurrent)
      if (isCurrent()) cacheHydrated = true
    }
    const pending = bounded(request, signal, async () => {
      let userId = state.authUserIdRef.current
      if (!userId) {
        try {
          const { data: { session } } = await state.supabaseRef.current.auth.getSession()
          userId = session?.user?.id ?? null
        } catch { /* The authorized list still reports session failures. */ }
        if (!isCurrent()) return
        // Auth events are newer than this pending SDK read. Never overwrite their
        // identity (the initial event can arrive while the ref is still null).
        userId = state.authUserIdRef.current ?? userId
        state.authUserIdRef.current = userId
      }
      discardForeignSiteSelection(userId)
      const cached = !state.currentSite && !isDemoModeActive() ? readSiteSelection(userId) : null
      if (cached) {
        // Publish identity without waiting for the full list. Settings remain independently
        // gated, so currency and checkout configuration never come from invented defaults.
        latest.current = { ...latest.current, currentSite: cached }
        state.setCurrentSite(cached)
        hydrating.current = true
      }
      const hydration = cached ? select(cached, isCurrent, true).then(() => {
        if (!isCurrent()) return
        cacheHydrated = true
        state.setIsInitialized(true)
      }).catch(error => {
        if (!isCurrent()) return
        state.setCurrentSite(null)
        state.setError(error instanceof Error ? error : new Error(String(error)))
      }) : Promise.resolve()
      const listing = loadAccessibleSites({
        ...state, supabase: state.supabaseRef.current, sessionUserId: userId,
        currentSite: cached ?? state.currentSite,
        isInitialized: Boolean(cached) || (state.isInitialized && !hydrating.current),
        isCurrent, signal, fresh, selectSite: selectLoadedSite, reload: loadSites,
        onAccessDenied: retireDeniedScope,
      }).then(async result => {
        const billingStarted = refreshBilling(result?.site, isCurrent)
        if (result?.authoritative === false && isCurrent()) {
          const remainingMs = result.revalidateAt - performance.now()
          if (!result.selectionMissing && remainingMs > 0) {
            // A fresh cache hit should save DB work. Reconcile once at expiry,
            // without adding time already spent hydrating settings to its budget.
            revalidationTimer.current = setTimeout(() => {
              const refresh = () => { if (isCurrent()) void loadSites(true) }
              // The timer may expire while cached settings are still hydrating.
              // Wait for that load to release deduplication instead of losing the refresh.
              if (initialLoad.current) void initialLoad.current.then(refresh, () => {})
              else refresh()
            }, remainingMs)
            return
          }
          // Reconcile the hint once under the same cancellation/deadline scope.
          // The first list has already published; this must not gate hydrated POS.
          const fresh = await loadAccessibleSites({
            ...latest.current, supabase: state.supabaseRef.current, sessionUserId: userId,
            isInitialized: true, isCurrent, signal, fresh: true,
            selectSite: selectLoadedSite, reload: loadSites,
            onAccessDenied: retireDeniedScope,
          })
          if (!billingStarted) refreshBilling(fresh?.site, isCurrent)
        }
      })
      await Promise.all([hydration, listing])
    }, () => !cacheHydrated && (!state.isInitialized || !state.currentSite))
    if (!state.isInitialized || hydrating.current) initialLoad.current = pending
    try { await pending }
    finally { if (initialLoad.current === pending) initialLoad.current = null }
  }

  return { loadSites, selectSite, invalidate }
}