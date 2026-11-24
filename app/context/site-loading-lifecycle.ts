"use client"

import { useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { clearSelection, loadAccessibleSites, type LoadSitesDeps } from "./site-load-sites"
import { applyCurrentSite } from "./site-set-current"
import type { Site, WorkspaceRequestScope } from "./site-types"
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
  // Keep the request target independent of settings. Only an independently
  // authorized reader may use it after a transient settings failure.
  const [requestScope, setRequestScope] = useState<WorkspaceRequestScope | null>(null)
  const liveScope = useRef<WorkspaceRequestScope | null>(null)
  const [lostAccess, setLostAccess] = useState<(WorkspaceRequestScope & { refreshDirectory?: boolean }) | null>(null)
  const generation = useRef(0)
  const active = useRef(true)
  const hydrating = useRef(false)
  const selection = useRef<Promise<void> | null>(null)
  const initialLoad = useRef<Promise<void> | null>(null)
  const controller = useRef<AbortController | null>(null)
  const selectionReads = useRef<AbortController | null>(null)
  const revalidationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function publishScope(scope: WorkspaceRequestScope | null) {
    liveScope.current = scope
    setRequestScope(scope)
  }

  function retire() {
    if (revalidationTimer.current) clearTimeout(revalidationTimer.current)
    revalidationTimer.current = null
    generation.current += 1
    selectionReads.current?.abort()
    selectionReads.current = null
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
    publishScope(null)
    setLostAccess(null)
    clearSiteSelectionCache()
    retire()
    latest.current = { ...latest.current, currentSite: null, isInitialized: false }
  }

  function retireDeniedScope() {
    publishScope(null)
    retire()
    latest.current = { ...latest.current, currentSite: null }
  }

  function retireRemovedSelection(siteId: string, actorId: string | null) {
    // The successful list MUST still publish its other accessible sites. Only
    // its removed selection (including pending detail and React setters) retires.
    selectionReads.current?.abort()
    selectionReads.current = null
    hydrating.current = false
    publishScope(null)
    if (actorId && !siteId.startsWith('demo-')) setLostAccess({ siteId, actorId })
    latest.current = { ...latest.current, currentSite: null }
    latest.current.setIsInitialized(true)
  }

  function leaveUnavailableSite(scope: WorkspaceRequestScope) {
    const state = latest.current
    if (liveScope.current?.siteId !== scope.siteId || liveScope.current.actorId !== scope.actorId ||
      state.authUserIdRef.current !== scope.actorId) return
    retireDeniedScope()
    clearSelection(scope.siteId)
    setLostAccess({ ...scope, refreshDirectory: true })
    state.setCurrentSite(null)
    state.setSites(sites => sites.filter(site => site.id !== scope.siteId))
    state.setError(null)
    state.setIsLoading(false)
    state.setIsInitialized(true)
    state.setSitesLoaded(true)
    state.setHasValidSession(true)
  }

  async function bounded(request: number, signal: AbortSignal, operation: () => Promise<void>, initial: boolean | (() => boolean)) {
    let timer: ReturnType<typeof setTimeout> | undefined
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
    try { await Promise.race([waitForHydration(operation(), signal), deadline]) }
    finally { clearTimeout(timer) }
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

  async function select(site: Site, isCurrent: () => boolean) {
    if (!isCurrent()) return
    const state = latest.current
    if (!hydrating.current && state.currentSite?.id === site.id) return true
    selectionReads.current?.abort()
    const reads = new AbortController()
    selectionReads.current = reads
    const ownsSelection = () => isCurrent() && !reads.signal.aborted
    const actorId = state.authUserIdRef.current
    publishScope(actorId && !site.id.startsWith('demo-') ? { actorId, siteId: site.id } : null)
    setLostAccess(null)
    hydrating.current = true
    latest.current = { ...latest.current, currentSite: site }
    state.setIsLoading(true)
    try {
      await waitForHydration(applyCurrentSite({
        site, currentSite: null, supabase: state.supabaseRef.current,
        requireSettings: !site.id.startsWith('demo-'), signal: reads.signal,
        setSites: guardSetter(state.setSites, ownsSelection),
        setCurrentSite: guardSetter(state.setCurrentSite, ownsSelection),
      }), reads.signal)
      return ownsSelection()
    } catch (error) {
      // A rejected old-actor/site query can settle after cancellation too.
      if (ownsSelection()) {
        // Keep the read-only request target, not an operational site. Updating
        // the ref here also prevents a same-site retry from being short-circuited.
        latest.current = { ...latest.current, currentSite: null }
        state.setCurrentSite(null)
        state.setError(error instanceof Error ? error : new Error('Selected site settings could not be loaded.'))
      }
      return false
    } finally {
      if (ownsSelection()) {
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
    latest.current.setError(null)
    const pending = bounded(request, signal, async () => {
      if (await select(site, isCurrent)) refreshBilling(site, isCurrent)
    }, true)
    selection.current = pending
    try { await pending }
    finally { if (selection.current === pending) selection.current = null }
  }

  function waitForHydration(work: Promise<void>, reads: AbortSignal) {
    // Some transports settle after cancellation (or not at all). A removed
    // selection must release the parent list and its deadline immediately.
    let onAbort = () => {}
    const cancelled = new Promise<void>(resolve => {
      onAbort = resolve
      if (reads.aborted) resolve()
      else reads.addEventListener('abort', onAbort, { once: true })
    })
    return Promise.race([work, cancelled]).finally(() => reads.removeEventListener('abort', onAbort))
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
      if (await select(site, isCurrent)) cacheHydrated = true
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
      if (!cached && !state.currentSite) publishScope(null)
      if (cached) {
        // Publish identity without waiting for the full list. Settings remain independently
        // gated, so currency and checkout configuration never come from invented defaults.
        latest.current = { ...latest.current, currentSite: cached }
        state.setCurrentSite(cached)
        hydrating.current = true
      }
      const hydration = cached ? select(cached, isCurrent).then(completed => {
        if (!isCurrent() || !completed) return
        cacheHydrated = true
        state.setIsInitialized(true)
      }) : Promise.resolve()
      const listing = loadAccessibleSites({
        ...state, supabase: state.supabaseRef.current, sessionUserId: userId,
        currentSite: cached ?? state.currentSite,
        isInitialized: Boolean(cached) || (state.isInitialized && !hydrating.current),
        isCurrent, signal, fresh, selectSite: selectLoadedSite, reload: loadSites,
        onAccessDenied: retireDeniedScope,
        onSelectionRemoved: retireRemovedSelection,
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
            onSelectionRemoved: retireRemovedSelection,
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

  return { loadSites, selectSite, invalidate, requestScope, lostAccess, leaveUnavailableSite }
}