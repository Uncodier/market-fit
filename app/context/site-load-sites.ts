"use client"

import type { Site } from "./site-types"
import { hydrateSiteBilling } from "./site-billing-data"
import type { Dispatch, SetStateAction } from "react"
import { captureBillingRevision, mergeLoadedSiteBilling } from "./site-billing-freshness"
import { getLocalStorage } from "./site-storage"
import { isDemoModeActive, getDemoSiteId, resolvePreferredSiteId } from "@/lib/demo-utils"
import { unauthorizedSitesLoadAction } from "@/lib/auth/workspace-site-redirect"
import { fetchAccessibleSitesClient } from "@/lib/sites/fetch-accessible-sites"
import { postgrestErrorMessage } from "@/lib/supabase/postgrest-error"
import { cacheSiteSelection, clearSiteSelectionCache } from "./site-selection-cache"
import { clearCurrentSiteCookie } from "@/lib/auth/current-site-cookie"

export type LoadSitesDeps = {
  supabase: Parameters<typeof fetchAccessibleSitesClient>[0] & {
    auth: { getSession(): Promise<{ data: { session: { user?: { id?: string } } | null } }> }
  }
  isMounted: boolean
  isInitialized: boolean
  currentSite: Site | null
  unauthorizedRetryRef: { current: number }
  setSitesLoaded: (v: boolean) => void
  setSitesLoadAttempted: (v: boolean) => void
  setIsLoading: (v: boolean) => void
  setError: (e: Error | null) => void
  setHasValidSession: (v: boolean) => void
  setIsInitialized: (v: boolean | ((prev: boolean) => boolean)) => void
  setSites: Dispatch<SetStateAction<Site[]>>
  setCurrentSite: Dispatch<SetStateAction<Site | null>>
  selectSite: (site: Site) => Promise<void>
  reload: () => void
  isCurrent?: () => boolean
  onAccessDenied?: () => void
  onSelectionRemoved?: () => void
  sessionUserId?: string | null
  signal?: AbortSignal
  fresh?: boolean
}

export async function loadAccessibleSites(deps: LoadSitesDeps): Promise<{
  site?: Site; authoritative: boolean; selectionMissing: boolean; revalidateAt: number
} | undefined> {
  const billingRevision = captureBillingRevision()
  const {
    supabase,
    isMounted,
    isInitialized,
    currentSite,
    unauthorizedRetryRef,
    setSitesLoaded,
    setSitesLoadAttempted,
    setIsLoading,
    setError,
    setHasValidSession,
    setIsInitialized,
    setSites,
    setCurrentSite,
    selectSite,
    isCurrent: ownsRequest = () => true,
  } = deps
    const isCurrent = () => !deps.signal?.aborted && ownsRequest()
    if (!isMounted || !supabase || !isCurrent()) {
      return
    }

    // A same-workspace refresh must not replace hydrated UI with its loading gate.
    const demoSiteId = getDemoSiteId()
    const background = isInitialized && Boolean(currentSite) &&
      (!demoSiteId || demoSiteId === currentSite?.id)
    if (!background) {
      setSitesLoaded(false)
      setIsLoading(true)
    }
    setError(null)
    // ✅ MARK that we attempted to load sites (kept for diagnostics)
    setSitesLoadAttempted(true)
    
    let userId: string | null = deps.sessionUserId ?? null

    // Read local identity for cache scoping and demo ownership, never authorization.
    // Do not call auth.getUser() here: it always hits the Auth API from the
    // browser, and a Failed to fetch (blocked, aborted, offline) was treated
    // as logout and surfaced as a Next.js Console TypeError overlay.
    try {
      if (deps.sessionUserId === undefined) {
        const { data: { session } } = await supabase.auth.getSession()
        userId = session?.user?.id ?? null
      }
    } catch {
      userId = null
    }
    if (!isCurrent()) return
    
    let keepLoading = false

    try {
      const savedSiteId = currentSite?.id ?? getLocalStorage("currentSiteId")

      const {
        sites: accessibleSites,
        detail,
        error: sitesError,
        aborted,
        unauthorized,
        forbidden,
        authoritative = true,
        revalidateAfterMs = 0,
      } = await fetchAccessibleSitesClient(supabase, savedSiteId, deps.signal, deps.fresh)
      const revalidateAt = performance.now() + revalidateAfterMs

      if (!isCurrent() || aborted) {
        return
      }

      const demoActive = isDemoModeActive()

      if ((unauthorized || forbidden) && !demoActive) {
        const action = forbidden ? null : unauthorizedSitesLoadAction({
          hasLocalUser: Boolean(userId),
          retriesSoFar: unauthorizedRetryRef.current,
        })

        if (action === "retry") {
          unauthorizedRetryRef.current += 1
          keepLoading = true
          // Retry this list operation, not the deduplicated outer hydration.
          // Keep the same generation/deadline while settings load independently.
          await new Promise(resolve => setTimeout(resolve, 400))
          if (isCurrent()) return await loadAccessibleSites(deps)
          return
        }

        unauthorizedRetryRef.current = 0
        // Retire any parallel settings hydrate before clearing the denied scope.
        deps.onAccessDenied?.()
        clearSelection(savedSiteId)
        setCurrentSite(null)
        setSites([])
        setError(new Error(forbidden
          ? postgrestErrorMessage(sitesError, "Workspace access is not permitted")
          : "Site access could not be authenticated. Please sign in again."))
        setIsLoading(false)
        if (!isInitialized) {
          setIsInitialized(true)
        }

        if (forbidden) {
          // A location denial is not logout or proof that the account has zero sites.
          setSitesLoaded(false)
          return
        }

        if (action === "finish") {
          // Local session exists; API stayed unauthorized. Let the wrapper bounce to /projects.
          setHasValidSession(true)
          setSitesLoaded(true)
          return
        }

        setHasValidSession(false)
        return
      }

      if (sitesError && !demoActive) {
        console.error(
          "Error fetching accessible sites:",
          postgrestErrorMessage(sitesError, "Failed to load sites")
        )
        throw new Error(postgrestErrorMessage(sitesError, "Failed to load sites"))
      }

      unauthorizedRetryRef.current = 0
      setHasValidSession(true)

      // Apply detail hydration to the target site
      if (detail && detail.id) {
        const targetSite = accessibleSites.find(s => s.id === detail.id)
        if (targetSite) {
          targetSite.logo_url = detail.logo_url
          targetSite.tracking = detail.tracking
          targetSite.resource_urls = detail.resource_urls
        }
      }

      const allSitesData = [...accessibleSites]
      
      // Demo accounts are only available while demo mode is active.
      // Do not inject them into workspace/buyer site lists.
      if (typeof window !== 'undefined' && isDemoModeActive()) {
        const { availableDemos } = await import('@/lib/demo-data/index');
        if (!isCurrent()) return
        for (const demo of availableDemos) {
          // Check if it already exists to prevent duplicates
          if (!allSitesData.some(site => site.id === demo.id)) {
            allSitesData.push({
              id: demo.id,
              name: demo.name,
              url: demo.url || null,
              logo_url: null,
              resource_urls: null,
              description: demo.description,
              user_id: userId || "demo-user",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        }
      }
      
      // Cargar focusMode desde localStorage y agregar datos de billing
      const sitesWithData = allSitesData.map(site => {
        // Find billing data for this site (now coming from API)
        const siteBilling = site.billing
        
        // Full credits for demo sites
        const isDemoSite = site.id.startsWith('demo-')
        const demoBilling = isDemoSite ? {
          plan: 'enterprise' as const,
          masked_card_number: '1234',
          card_name: 'Demo User',
          card_expiry: '12/29',
          auto_renew: true,
          credits_available: 99999,
          credits_used: 0,
          account_balance: 0
        } : undefined
        
        return {
          ...site,
          focus_mode: getLocalStorage(`site_${site.id}_focus_mode`, site.focus_mode || 50),
          // Settings are hydrated separately for the selected site.
          settings: undefined,
          // Add billing data if available
          billing: isDemoSite ? demoBilling : (siteBilling ? hydrateSiteBilling(siteBilling) : undefined)
        }
      })
      
      // Ensure unique sites based on ID to prevent React key duplication errors
      const uniqueSites = Array.from(
        new Map<string, Site>(sitesWithData.map(site => [site.id, site])).values()
      );

      const selectedId = currentSite?.id ?? getLocalStorage("currentSiteId")
      const selected = uniqueSites.find(site => site.id === selectedId)
      if (selected) cacheSiteSelection(userId, selected)
      else if (selectedId && authoritative) {
        deps.onSelectionRemoved?.()
        clearSelection(selectedId)
        setIsLoading(false)
      }
      // A cached selector is a hint, not evidence that the active scope was revoked.
      if (!authoritative && currentSite && !uniqueSites.some(site => site.id === currentSite.id)) {
        uniqueSites.push(currentSite)
      }
      
      setSites(previous => isCurrent()
        ? mergeLoadedSiteBilling(previous, uniqueSites, billingRevision)
        : previous)
      // Same-site selection deliberately skips settings reloads, so publish the
      // financial read independently using current state, never a captured closure.
      setCurrentSite(previous => {
        if (!isCurrent() || !previous) return previous
        const loaded = uniqueSites.find(site => site.id === previous.id)
        // A successful authorized list no longer containing this site revokes selection.
        if (!loaded) return authoritative ? null : previous
        const merged = mergeLoadedSiteBilling([previous], [loaded], billingRevision)[0]
        return { ...previous, ...merged, settings: previous.settings }
      })
      // Without an active identity, a cache miss must not enable the empty-list
      // redirect before the authoritative revalidation can restore the saved ID.
      setSitesLoaded(authoritative || Boolean(currentSite))
      
      // Si hay sitios, intentamos restaurar el sitio guardado (no auto-seleccionar el primero)
      if (sitesWithData.length > 0) {
        const preferredSiteId = resolvePreferredSiteId({
          savedSiteId: currentSite?.id ?? getLocalStorage("currentSiteId"),
          demoSiteId: getDemoSiteId(),
        })
        const savedSite = preferredSiteId
          ? sitesWithData.find(site => site.id === preferredSiteId)
          : null
        
        // PRIORIDAD 1: Si hay un sitio guardado válido, usarlo siempre
        if (savedSite && (!background || savedSite.id !== currentSite?.id)) {
          await selectSite(savedSite)
        }
        // PRIORIDAD 2: Si ya estamos inicializados, tenemos sitio actual, pero no está guardado
        else if (isInitialized && currentSite && !savedSite) {
          // Verificar que el sitio actual aún existe en la lista
          const existingSite = sitesWithData.find(site => site.id === currentSite.id)
          if (existingSite && !background) {
            await selectSite(existingSite)
          } else {
            // No seleccionar automáticamente otro sitio; esperar a que el usuario elija en /projects
          }
        }
        // PRIORIDAD 3: Si no hay sitio actual ni guardado, NO auto-seleccionar. Se manejará con redirect a /projects
      }

      if (isCurrent() && !isInitialized) {
        setIsInitialized(true)
      }
      return { site: uniqueSites.find(site => site.id === selectedId), authoritative,
        selectionMissing: Boolean(selectedId && !selected), revalidateAt }
    } catch (err) {
      if (!isCurrent()) return
      console.error("Error loading sites:", err instanceof Error ? err.message : String(err))
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      if (isCurrent() && !background && !keepLoading) {
        setIsLoading(false)
      }
    }
  }

function clearSelection(selectedId: string | null) {
  clearSiteSelectionCache()
  // Another tab may have selected a different site in the meantime.
  try {
    if (selectedId && localStorage.getItem("currentSiteId") === selectedId) {
      localStorage.removeItem("currentSiteId")
      clearCurrentSiteCookie()
    }
  } catch { /* Selection invalidation in memory is still authoritative. */ }
}
