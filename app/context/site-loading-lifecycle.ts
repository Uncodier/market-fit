"use client"

import { useLayoutEffect, useRef, type Dispatch, type SetStateAction } from "react"
import { loadAccessibleSites, type LoadSitesDeps } from "./site-load-sites"
import { applyCurrentSite } from "./site-set-current"
import type { Site } from "./site-types"
import { cacheSiteSelection, clearSiteSelectionCache, discardForeignSiteSelection, readSiteSelection } from "./site-selection-cache"
import { isDemoModeActive } from "@/lib/demo-utils"

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
  useLayoutEffect(() => {
    // CRUD can clear/change selection without going through selectSite.
    if (!hydrating.current && deps.currentSite?.id !== latest.current.currentSite?.id) {
      generation.current += 1
    }
    latest.current = deps
  })
  useLayoutEffect(() => {
    active.current = true
    return () => { active.current = false; generation.current += 1 }
  }, [])

  function invalidate() {
    clearSiteSelectionCache()
    generation.current += 1
    hydrating.current = false
    selection.current = null
    initialLoad.current = null
    latest.current = { ...latest.current, currentSite: null, isInitialized: false }
  }

  async function bounded(request: number, operation: () => Promise<void>, initial: boolean | (() => boolean)) {
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<void>(resolve => {
      timer = setTimeout(() => {
        if (active.current && generation.current === request) {
          generation.current += 1
          hydrating.current = false
          const state = latest.current
          if (typeof initial === "function" ? initial() : initial) state.setCurrentSite(null)
          state.setError(new Error("Site loading timed out. Please try again."))
          state.setIsLoading(false)
        }
        resolve()
      }, SITE_HYDRATION_TIMEOUT_MS)
    })
    try { await Promise.race([operation(), deadline]) }
    finally { clearTimeout(timer) }
  }

  function guardSetter<T>(setter: Dispatch<SetStateAction<T>>, isCurrent: () => boolean) {
    return (value: SetStateAction<T>) => {
      if (!isCurrent()) return
      setter(previous => !isCurrent() ? previous :
        typeof value === "function" ? (value as (previous: T) => T)(previous) : value)
    }
  }

  async function select(site: Site, isCurrent: () => boolean, requireSettings = false) {
    if (!isCurrent()) return
    const state = latest.current
    if (!hydrating.current && state.currentSite?.id === site.id) return
    hydrating.current = true
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
    const request = ++generation.current
    cacheSiteSelection(latest.current.authUserIdRef.current, site)
    const pending = bounded(request,
      () => select(site, () => active.current && generation.current === request), true)
    selection.current = pending
    try { await pending }
    finally { if (selection.current === pending) selection.current = null }
  }

  async function loadSites() {
    // A metadata refresh cannot supersede an explicit selection's settings read.
    if (selection.current) return selection.current
    if (initialLoad.current) return initialLoad.current
    const state = latest.current
    if (!active.current || !state.isMounted || !state.supabaseRef.current) return
    const request = ++generation.current
    const isCurrent = () => active.current && generation.current === request
    let cacheHydrated = false
    const pending = bounded(request, async () => {
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
        isCurrent, selectSite: site => select(site, isCurrent), reload: loadSites,
      })
      await Promise.all([hydration, listing])
    }, () => !cacheHydrated && (!state.isInitialized || !state.currentSite))
    if (!state.isInitialized || hydrating.current) initialLoad.current = pending
    try { await pending }
    finally { if (initialLoad.current === pending) initialLoad.current = null }
  }

  return { loadSites, selectSite, invalidate }
}