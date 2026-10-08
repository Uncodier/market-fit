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

export type LoadSitesDeps = {
  supabase: any
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
}

export async function loadAccessibleSites(deps: LoadSitesDeps) {
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
    reload,
  } = deps
    if (!isMounted || !supabase) {
      return
    }

    // Reset loaded flag at the start of a new load
    setSitesLoaded(false)
    // ✅ MARK that we attempted to load sites (kept for diagnostics)
    setSitesLoadAttempted(true)
    
    let userId: string | null = null

    // Read the local session for demo site ownership only.
    // Do not call auth.getUser() here: it always hits the Auth API from the
    // browser, and a Failed to fetch (blocked, aborted, offline) was treated
    // as logout and surfaced as a Next.js Console TypeError overlay.
    try {
      const { data: { session } } = await supabase.auth.getSession()
      userId = session?.user?.id ?? null
    } catch {
      userId = null
    }
    
    let keepLoading = false

    try {
      // Always set loading to true when starting to load sites, regardless of initialization status
      setIsLoading(true)
      setError(null)

      const savedSiteId = getLocalStorage("currentSiteId")

      const {
        sites: accessibleSites,
        detail,
        error: sitesError,
        aborted,
        unauthorized,
      } = await fetchAccessibleSitesClient(supabase, savedSiteId)

      if (aborted) {
        return
      }

      const demoActive = isDemoModeActive()

      if (unauthorized && !demoActive) {
        const action = unauthorizedSitesLoadAction({
          hasLocalUser: Boolean(userId),
          retriesSoFar: unauthorizedRetryRef.current,
        })

        if (action === "retry") {
          unauthorizedRetryRef.current += 1
          keepLoading = true
          setTimeout(() => {
            void reload()
          }, 400)
          return
        }

        unauthorizedRetryRef.current = 0
        // Keep previous sites. Do not paint an empty create-site state.
        if (!isInitialized) {
          setIsInitialized(true)
        }

        if (action === "finish") {
          // Local session exists; API stayed unauthorized. Let the wrapper bounce to /projects.
          setHasValidSession(true)
          setSitesLoaded(true)
          return
        }

        setHasValidSession(false)
        keepLoading = true
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
        for (const demo of availableDemos) {
          // Check if it already exists to prevent duplicates
          if (!allSitesData.some(site => site.id === demo.id)) {
            allSitesData.push({
              id: demo.id,
              name: demo.name,
              url: demo.url || null,
              logo_url: null,
              description: demo.description,
              user_id: userId || "demo-user",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        }
      }
      
      // Cargar focusMode desde localStorage y agregar datos de billing
      const sitesWithData = allSitesData.map((site: any) => {
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
          // No incluimos settings aquí, se cargarán específicamente para el sitio actual
          settings: undefined,
          // Add billing data if available
          billing: isDemoSite ? demoBilling : (siteBilling ? hydrateSiteBilling(siteBilling) : undefined)
        }
      })
      
      // Ensure unique sites based on ID to prevent React key duplication errors
      const uniqueSites = Array.from(
        new Map(sitesWithData.map((site: any) => [site.id, site])).values()
      );
      
      setSites(previous => mergeLoadedSiteBilling(previous, uniqueSites as Site[], billingRevision))
      // Same-site selection deliberately skips settings reloads, so publish the
      // financial read independently using current state, never a captured closure.
      setCurrentSite(previous => {
        if (!previous) return previous
        const loaded = (uniqueSites as Site[]).find(site => site.id === previous.id)
        if (!loaded) return previous
        const merged = mergeLoadedSiteBilling([previous], [loaded], billingRevision)[0]
        return { ...previous, billing: merged.billing, billing_read_status: merged.billing_read_status }
      })
      setSitesLoaded(true)
      
      // Si hay sitios, intentamos restaurar el sitio guardado (no auto-seleccionar el primero)
      if (sitesWithData.length > 0) {
        const preferredSiteId = resolvePreferredSiteId({
          savedSiteId: getLocalStorage("currentSiteId"),
          demoSiteId: getDemoSiteId(),
        })
        const savedSite = preferredSiteId
          ? sitesWithData.find((site: any) => site.id === preferredSiteId)
          : null
        
        // PRIORIDAD 1: Si hay un sitio guardado válido, usarlo siempre
        if (savedSite) {
          await selectSite(savedSite)
        }
        // PRIORIDAD 2: Si ya estamos inicializados, tenemos sitio actual, pero no está guardado
        else if (isInitialized && currentSite && !savedSite) {
          // Verificar que el sitio actual aún existe en la lista
          const existingSite = sitesWithData.find((site: any) => site.id === currentSite.id)
          if (existingSite) {
            await selectSite(existingSite)
          } else {
            // No seleccionar automáticamente otro sitio; esperar a que el usuario elija en /projects
          }
        }
        // PRIORIDAD 3: Si no hay sitio actual ni guardado, NO auto-seleccionar. Se manejará con redirect a /projects
      }

      if (!isInitialized) {
        setIsInitialized(true)
      }
    } catch (err) {
      console.error("Error loading sites:", err instanceof Error ? err.message : String(err))
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      if (!keepLoading) {
        setIsLoading(false)
      }
    }
  }
