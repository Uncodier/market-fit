import type { Site } from "../../context/SiteContext"

export interface SaveOptions {
  currentSite: Site
  updateSite: (site: any) => Promise<void>
  updateSettings: (siteId: string, settings: any) => Promise<void>
  refreshSites: () => Promise<void>
  setIsSaving: (saving: boolean) => void
  t?: (key: string, params?: Record<string, string | number>) => string
}

// Helper function to check if refresh should be prevented
export const shouldPreventRefresh = () => {
  if (typeof window === 'undefined') return false
  const preventRefresh = sessionStorage.getItem('preventAutoRefresh')
  const justBecameVisible = sessionStorage.getItem('JUST_BECAME_VISIBLE')
  const justGainedFocus = sessionStorage.getItem('JUST_GAINED_FOCUS')
  
  return preventRefresh === 'true' || justBecameVisible === 'true' || justGainedFocus === 'true'
}

// Helper function to update site state locally without refresh
export const updateSiteLocally = (currentSite: Site, siteUpdate: any, settingsUpdate: any, updateSite: (site: any) => Promise<void>) => {
  const updatedSite = {
    ...currentSite,
    ...siteUpdate,
    settings: {
      ...currentSite.settings,
      ...settingsUpdate,
      shop: {
        ...currentSite.settings?.shop,
        ...settingsUpdate.shop
      },
      channels: {
        ...currentSite.settings?.channels,
        ...settingsUpdate.channels,
        email: {
          ...currentSite.settings?.channels?.email,
          ...settingsUpdate.channels?.email
        },
        whatsapp: {
          ...currentSite.settings?.channels?.whatsapp,
          ...settingsUpdate.channels?.whatsapp
        },
        website: {
          ...currentSite.settings?.channels?.website,
          ...settingsUpdate.channels?.website
        }
      }
    }
  }
  updateSite(updatedSite as any)
}

