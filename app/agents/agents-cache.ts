let cachedAgents: unknown[] | null = null
let cachedScope: string | null = null

export function getCachedAgents<T>(scope: string | undefined): T[] | null {
  if (cachedAgents && cachedScope === scope) {
    return cachedAgents as T[]
  }
  return null
}

export function setCachedAgents<T>(agents: T[], scope: string) {
  cachedAgents = agents
  cachedScope = scope
}

export function invalidateAgentsCache() {
  cachedAgents = null
  cachedScope = null
}
