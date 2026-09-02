"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, usePathname } from "next/navigation"
import type { BillingData } from "../services/billing-types"
import { toast } from "react-hot-toast"
import { getDemoSiteId, isDemoModeActive, isRealSiteId } from "@/lib/demo-utils"
import { clearCurrentSiteCookie, persistCurrentSiteCookie } from "@/lib/auth/current-site-cookie"
import { getWorkspaceSiteRedirect } from "@/lib/auth/workspace-site-redirect"
import { navigateOrAssign } from "@/lib/navigation/stale-router"
import type { Site, SiteSettings, SiteContextType } from "./site-types"
import { cleanUUID } from "./site-storage"
import { persistSiteSettings } from "./site-update-settings"
import { applyCurrentSite, fetchSiteSettings } from "./site-set-current"
import { loadAccessibleSites } from "./site-load-sites"
import { updateSiteRecord, createSiteRecord, deleteSiteRecord } from "./site-crud"

export type {
  Site,
  SiteSettings,
  RoundRobinCalendar,
  ResourceUrl,
  BusinessHours,
  CompetitorUrl,
  Product,
  Service,
} from "./site-types"


// Crear el contexto
const SiteContext = createContext<SiteContextType | undefined>(undefined)

// Hook personalizado para usar el contexto
export function useSite() {
  const context = useContext(SiteContext)
  if (context === undefined) {
    throw new Error("useSite must be used within a SiteProvider")
  }
  return context
}

/** Returns undefined instead of throwing when SiteProvider is missing (stale chunks / duplicate context). */
export function useOptionalSite() {
  return useContext(SiteContext)
}

// Props del proveedor
interface SiteProviderProps {
  children: ReactNode
}


// Componente proveedor
export function SiteProvider({ children }: SiteProviderProps) {
  const [currentSite, setCurrentSite] = useState<Site | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  
  // ✅ NEW STATES: Track sites loading attempts and session validity
  const [sitesLoadAttempted, setSitesLoadAttempted] = useState(false)
  const [hasValidSession, setHasValidSession] = useState(false)
  const hasValidSessionRef = useRef(false)
  const isLoadingRef = useRef(true)
  
  // Sincronizar ref con state
  useEffect(() => {
    hasValidSessionRef.current = hasValidSession
  }, [hasValidSession])

  useEffect(() => {
    if (currentSite?.id) persistCurrentSiteCookie(currentSite.id)
  }, [currentSite?.id])

  useEffect(() => {
    isLoadingRef.current = isLoading
  }, [isLoading])
  
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const unauthorizedRetryRef = useRef(0)
  
  // ✅ Only consider redirects after sites have actually finished loading at least once
  const [sitesLoaded, setSitesLoaded] = useState(false)
  
  // Navigation hooks
  const router = useRouter()
  const pathname = usePathname()
  
  // Referencia segura a supabase (inicializada solo en useEffect)
  const supabaseRef = useRef<any>(null)
  
  useEffect(() => {
    try {
      supabaseRef.current = createClient()
      const currentSiteId = localStorage.getItem('currentSiteId')
      if (currentSiteId) {
        const cleanedId = cleanUUID(currentSiteId)
        if (cleanedId && cleanedId !== currentSiteId) {
          localStorage.setItem('currentSiteId', cleanedId)
        }
      }
    } catch (err) {
      console.error("Error initializing Supabase client:", err)
    }
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])
  
  const loadSites = async () => {
    return loadAccessibleSites({
      supabase: supabaseRef.current,
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
      selectSite: handleSetCurrentSite,
      reload: () => { void loadSites() },
    })
  }

  // Cargar sitios al iniciar el provider, pero solo después de la hidratación
  useEffect(() => {
    if (!isMounted || !supabaseRef.current) return
    
    loadSites() // Initial load is always allowed
    
    // Safety timeout to ensure loading state is resolved
    const loadingTimeout = setTimeout(() => {
      if (isLoadingRef.current) {
        console.warn("Loading timeout reached, forcing loading to false")
        setIsLoading(false)
        setIsInitialized((initialized) => initialized || true)
      }
    }, 10000)
    
    // Suscribirse a eventos de autenticación para cargar sitios cuando el usuario inicie sesión
    const { data: { subscription } } = supabaseRef.current.auth.onAuthStateChange(
      (event: 'SIGNED_IN' | 'SIGNED_OUT' | 'USER_UPDATED' | 'PASSWORD_RECOVERY' | 'TOKEN_REFRESHED' | 'INITIAL_SESSION', session: any) => {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          // Check if we already have a valid session (cross-tab auth sync or initial load)
          if (hasValidSessionRef.current) {
            // Only update session without reloading sites to avoid blocking UI
            setHasValidSession(!!session)
            return
          }
          
          if (session) {
            setHasValidSession(true)
            setSitesLoadAttempted(false) // ✅ Reset for new load
            loadSitesWithPrevention()
          }
        } else if (event === 'SIGNED_OUT') {
          setSites([])
          setCurrentSite(null)
          setHasValidSession(false)
          setSitesLoadAttempted(true) // ✅ Mark as "loaded" (empty)
          setIsLoading(false)
          try {
            localStorage.removeItem("currentSiteId")
            clearCurrentSiteCookie()
          } catch (e) {
            console.error("Error removing currentSiteId from localStorage:", e)
          }
        } else if (event === 'TOKEN_REFRESHED') {
          if (session && !hasValidSessionRef.current) {
            setHasValidSession(true)
            setSitesLoadAttempted(false)
            loadSitesWithPrevention()
            return
          }
          setHasValidSession(!!session)
        }
      }
    )
    
    return () => {
      clearTimeout(loadingTimeout)
      subscription.unsubscribe()
    }
  }, [isMounted])

  // Shop clears the demo cookie; workspace pages restore it via ?client=.
  // Rebind the supabase client and reload so we do not keep a real site selected.
  useEffect(() => {
    if (!isMounted || !isInitialized || isLoading) return
    const demoSiteId = getDemoSiteId()
    if (!demoSiteId || currentSite?.id === demoSiteId) return
    supabaseRef.current = createClient()
    void loadSites()
  }, [pathname, isMounted, isInitialized, isLoading, currentSite?.id])

  // Efecto separado para manejar las suscripciones, solo después de la inicialización
  useEffect(() => {
    if (!isInitialized || !isMounted || !supabaseRef.current) return

    let sitesSubscription: any = null;

    // Only subscribe after a delay to avoid immediate triggers during initialization
    const subscriptionTimer = setTimeout(() => {
      // Usar un nombre de canal único para evitar colisiones si se reutiliza el cliente
      const channelName = `sites-db-changes-${Date.now()}`;
      
      // Suscribirse a cambios en la tabla sites
      sitesSubscription = supabaseRef.current
        .channel(channelName)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'sites' 
        }, (payload: { eventType: string; new: any; old: any }) => {
          
          // Be more conservative about when to reload
          if (payload.eventType === 'INSERT') {
            // Only reload if this is a new site for current user
            if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
            refreshTimeoutRef.current = setTimeout(() => {
              loadSitesWithPrevention();
            }, 500);
          } else if (payload.eventType === 'DELETE') {
            // Only reload if the deleted site affects current user
            if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
            refreshTimeoutRef.current = setTimeout(() => {
              loadSitesWithPrevention();
            }, 500);
          } else if (payload.eventType === 'UPDATE') {
            // For updates, be very selective - only reload if it's the current site AND it's a significant change
            const newRecord = payload.new as Site;
            if (currentSite?.id === newRecord.id) {
              // Check if it's a significant change that would affect the settings page
              const oldRecord = payload.old as Site;
              const significantChanges = newRecord.name !== oldRecord.name || 
                                       newRecord.url !== oldRecord.url ||
                                       newRecord.description !== oldRecord.description;
              
              if (significantChanges) {
                if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
                refreshTimeoutRef.current = setTimeout(() => {
                  loadSitesWithPrevention();
                }, 500);
              }
            }
          }
        })
        .subscribe()
    }, 2000); // Delay subscription by 2 seconds to avoid initialization conflicts
    
    return () => {
      clearTimeout(subscriptionTimer);
      if (sitesSubscription && supabaseRef.current) {
        try {
          supabaseRef.current.removeChannel(sitesSubscription);
        } catch (error) {
          console.error("Error unsubscribing from sites channel:", error);
        }
      }
    }
  }, [isInitialized, isMounted, currentSite?.id || null]) // currentSite?.id needed for closure in UPDATE handling

  // Keep demo accounts on the page they loaded (robots iframe, catalog, etc.).
  // Real users on a wrapper path without a selected site bounce to /projects.
  useEffect(() => {
    // Add a delay to ensure all state updates are complete
    const redirectTimer = setTimeout(() => {
      // Only redirect if:
      // 1. Component is mounted and fully initialized
      // 2. Not currently loading sites
      // 3. Sites load has COMPLETED at least once
      // 4. Has a valid session
      // 5. No sites available
      // 6. Not already on create-site page or auth pages
      // 7. Not trying to redirect FROM create-site (this was the bug!)
      if (
        !isMounted ||
        !isInitialized ||
        isLoading ||
        !sitesLoaded ||
        !supabaseRef.current
      ) {
        return
      }

      const realSites = sites.filter((site) => isRealSiteId(site.id))
      const redirectTo = getWorkspaceSiteRedirect({
        pathname,
        isDemoMode: isDemoModeActive(),
        hasValidSession,
        realSiteCount: realSites.length,
        hasRealCurrentSite: Boolean(
          currentSite?.id && realSites.some((site) => site.id === currentSite.id)
        ),
      })

      if (redirectTo) {
        navigateOrAssign(router, redirectTo, { markUI: false })
      }
    }, 1000) // ✅ Increased delay from 100ms to 1000ms

    return () => clearTimeout(redirectTimer)
  }, [isMounted, isInitialized, isLoading, sitesLoaded, hasValidSession, sites.length, currentSite?.id, pathname, router])
  
  const handleSetCurrentSite = async (site: Site) => {
    return applyCurrentSite({
      site,
      currentSite,
      supabase: supabaseRef.current,
      setCurrentSite,
      setSites,
    })
  }

  const shouldPreventRefresh = () => {
    if (typeof window === "undefined") return false
    return (
      sessionStorage.getItem("preventAutoRefresh") === "true" ||
      sessionStorage.getItem("JUST_BECAME_VISIBLE") === "true" ||
      sessionStorage.getItem("JUST_GAINED_FOCUS") === "true"
    )
  }

  const isOnProtectedPage = () => {
    if (typeof window === "undefined") return false
    const path = window.location.pathname
    return path === "/settings" || path === "/create-site" || path === "/demo"
  }

  const handleUpdateSettings = async (siteId: string, settings: Partial<SiteSettings>) => {
    return persistSiteSettings({
      supabase: supabaseRef.current,
      siteId,
      settings,
      currentSite,
      setCurrentSite,
      setSites,
      loadSites,
      setError,
      shouldPreventRefresh,
      isOnProtectedPage,
    })
  }

  const crudDeps = {
    supabase: supabaseRef.current,
    currentSite,
    sites,
    setCurrentSite,
    setSites,
    setError,
    setIsLoading,
    loadSites,
    updateSettings: handleUpdateSettings,
    selectSite: handleSetCurrentSite,
    shouldPreventRefresh,
    isOnProtectedPage,
  }

  const handleUpdateSite = async (site: Site) => updateSiteRecord(site, crudDeps)
  const handleCreateSite = async (newSite: Omit<Site, 'id' | 'created_at' | 'updated_at'>) =>
    createSiteRecord(newSite, crudDeps)
  const handleDeleteSite = async (id: string) => deleteSiteRecord(id, crudDeps)

  const handleGetSettings = async (siteId: string) => {
    try {
      return await fetchSiteSettings(supabaseRef.current, siteId)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    }
  }

  const updateBilling = async (siteId: string, billingData: BillingData) => {
    try {
      setIsLoading(true);
      const { billingService } = await import("../services/billing-service")
      const result = await billingService.saveBillingInfo(siteId, billingData);
      
      if (result.success) {
        // Refresh site data to get the updated billing info
        await loadSites();
        toast.success("Billing information updated successfully");
      } else {
        toast.error(result.error || "Failed to update billing information");
      }
      
      return result;
    } catch (error) {
      console.error("Error updating billing:", error);
      toast.error("Failed to update billing information");
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      setIsLoading(false);
    }
  };

  const getBillingInfo = async (siteId: string) => {
    try {
      const { billingService } = await import("../services/billing-service")
      return await billingService.getBillingInfo(siteId);
    } catch (error) {
      console.error("Error getting billing info:", error);
      return { data: null, error };
    }
  };

  const purchaseCredits = async (siteId: string, amount: number) => {
    try {
      setIsLoading(true);
      
      // Use our database RPC function directly
      const supabase = createClient();
      const { data, error } = await supabase.rpc('purchase_credits', {
        site_id: siteId,
        amount: amount,
        payment_method: 'credit_card'
      });
      
      if (error) {
        throw error;
      }
      
      // Refresh site data to get the updated credits
      await loadSites();
      toast.success(`Successfully purchased ${amount} credits`);
      
      return { success: true };
    } catch (error) {
      console.error("Error purchasing credits:", error);
      toast.error("Failed to purchase credits");
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      setIsLoading(false);
    }
  };

  // Wrapper para loadSites que respeta la prevención de refresh
  const loadSitesWithPrevention = async () => {
    if (shouldPreventRefresh() || isOnProtectedPage()) {
      return
    }
    return loadSites()
  }

  // Valor del contexto
  const value = {
    sites,
    currentSite: currentSite || null,
    isLoading,
    error,
    setCurrentSite: handleSetCurrentSite,
    updateSite: handleUpdateSite,
    createSite: handleCreateSite,
    deleteSite: handleDeleteSite,
    refreshSites: loadSitesWithPrevention,
    updateSettings: handleUpdateSettings,
    getSettings: handleGetSettings,
    updateBilling,
    getBillingInfo,
    purchaseCredits,
  }
  
  return (
    <SiteContext.Provider value={value}>
      {children}
    </SiteContext.Provider>
  )
} 