import type { Site } from "../../context/SiteContext"
import type { SiteSettings, UpdateSiteOptions } from "../../context/site-types"
import { requestVoiceAgentResync } from "@/app/agents/voice-sync"

export interface SaveOptions {
  currentSite: Site
  // Writers publish local state; save handlers only refresh when allowed.
  updateSite: (site: any, options?: UpdateSiteOptions) => Promise<void>
  updateSettings: (siteId: string, settings: any) => Promise<void>
  refreshSites: () => Promise<void>
  setIsSaving: (saving: boolean) => void
  t?: (key: string, params?: Record<string, string | number>) => string
}

export async function saveSiteWithSettings(
  site: Site,
  settings: Partial<SiteSettings>,
  options: Pick<SaveOptions, "updateSite" | "updateSettings">,
): Promise<void> {
  await options.updateSite({ ...site, settings: undefined }, { syncVoiceAgent: false })
  try {
    await options.updateSettings(site.id, settings)
  } catch (error) {
    // The site write persisted, but the failed settings write cannot own its sync.
    await requestVoiceAgentResync(site.id)
    throw error
  }
}

// Helper function to check if refresh should be prevented
export const shouldPreventRefresh = () => {
  if (typeof window === 'undefined') return false
  const preventRefresh = sessionStorage.getItem('preventAutoRefresh')
  const justBecameVisible = sessionStorage.getItem('JUST_BECAME_VISIBLE')
  const justGainedFocus = sessionStorage.getItem('JUST_GAINED_FOCUS')
  
  return preventRefresh === 'true' || justBecameVisible === 'true' || justGainedFocus === 'true'
}

