let cachedAgents: unknown[] | null = null
let cachedSiteId: string | null = null

export function getCachedAgents<T>(siteId: string | undefined): T[] | null {
  if (cachedAgents && cachedSiteId === siteId) {
    return cachedAgents as T[]
  }
  return null
}

export function setCachedAgents<T>(agents: T[], siteId: string | null) {
  cachedAgents = agents
  cachedSiteId = siteId
}

export function invalidateAgentsCache() {
  cachedAgents = null
  cachedSiteId = null
}
