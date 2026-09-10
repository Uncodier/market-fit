import type { Site } from "../../app/context/site-types"
import { getLogoFromCache, saveLogoToCache } from "./logo-cache"

export async function syncSiteLogosInBackground(
  sites: Site[],
  setSites: React.Dispatch<React.SetStateAction<Site[]>>,
  currentSite?: Site | null,
  setCurrentSite?: React.Dispatch<React.SetStateAction<Site | null>>
) {
  if (typeof window === 'undefined' || sites.length === 0) return

  const idsToFetch: string[] = []
  const sitesToUpdate: { id: string; logo_url: string | null }[] = []

  // Check cache for each site
  for (const site of sites) {
    if (site.id.startsWith('demo-')) continue // Demo sites don't need this
    if (site.logo_url !== undefined) continue // Already has logo_url (null or string) from hydration or previous fetch

    const cached = await getLogoFromCache(site.id)
    if (cached !== undefined) {
      // It was in cache (either string or null)
      sitesToUpdate.push({ id: site.id, logo_url: cached })
    } else {
      // Not in cache, we need to fetch it
      idsToFetch.push(site.id)
    }
  }

  // Update immediately with what we found in cache
  if (sitesToUpdate.length > 0) {
    setSites(prev => {
      let changed = false
      const next = prev.map(p => {
        const update = sitesToUpdate.find(u => u.id === p.id)
        if (update && p.logo_url !== update.logo_url) {
          changed = true
          return { ...p, logo_url: update.logo_url }
        }
        return p
      })
      return changed ? next : prev
    })

    if (currentSite && setCurrentSite) {
      const currentUpdate = sitesToUpdate.find(u => u.id === currentSite.id)
      if (currentUpdate && currentSite.logo_url !== currentUpdate.logo_url) {
        setCurrentSite(prev => prev ? { ...prev, logo_url: currentUpdate.logo_url } : prev)
      }
    }
  }

  // Fetch missing from server
  if (idsToFetch.length > 0) {
    try {
      const res = await fetch(`/api/sites/logos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: idsToFetch })
      })
      if (!res.ok) return
      
      const payload = await res.json()
      if (!payload.success || !payload.logos) return
      
      const newSitesToUpdate: { id: string; logo_url: string | null }[] = []

      // Save to cache and prepare state update
      for (const id of idsToFetch) {
        const logo = payload.logos[id] || null
        await saveLogoToCache(id, logo)
        newSitesToUpdate.push({ id, logo_url: logo })
      }

      if (newSitesToUpdate.length > 0) {
        setSites(prev => {
          let changed = false
          const next = prev.map(p => {
            const update = newSitesToUpdate.find(u => u.id === p.id)
            if (update && p.logo_url !== update.logo_url) {
              changed = true
              return { ...p, logo_url: update.logo_url }
            }
            return p
          })
          return changed ? next : prev
        })

        if (currentSite && setCurrentSite) {
          const currentUpdate = newSitesToUpdate.find(u => u.id === currentSite.id)
          if (currentUpdate && currentSite.logo_url !== currentUpdate.logo_url) {
            setCurrentSite(prev => prev ? { ...prev, logo_url: currentUpdate.logo_url } : prev)
          }
        }
      }
    } catch (e) {
      console.error("Failed to sync site logos in background", e)
    }
  }
}
