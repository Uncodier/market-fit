const INSTANCE_QUERY_KEYS = ["instance", "instance_id", "instanceId"] as const

const ACTIVE_STATUSES = [
  "running",
  "active",
  "starting",
  "pending",
  "initializing",
  "paused",
]

export function resolveInstanceIdParam(
  searchParams: { get: (key: string) => string | null }
): string | null {
  for (const key of INSTANCE_QUERY_KEYS) {
    const value = searchParams.get(key)
    if (value) return value
  }
  return null
}

export function robotsInstanceHref(
  instanceId: string,
  extra?: Record<string, string | undefined | null>
): string {
  const params = new URLSearchParams()
  params.set("instance", instanceId)
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value)
    }
  }
  return `/robots?${params.toString()}`
}

export function isActiveInstanceStatus(status?: string | null): boolean {
  return ACTIVE_STATUSES.includes(status || "")
}

export function sortRobotInstances<
  T extends { status?: string; updated_at?: string; created_at?: string },
>(instances: T[]): T[] {
  return [...instances].sort((a, b) => {
    const aActive = isActiveInstanceStatus(a.status) ? 1 : 0
    const bActive = isActiveInstanceStatus(b.status) ? 1 : 0
    if (aActive !== bActive) return bActive - aActive

    const aTime = new Date(a.updated_at || a.created_at || 0).getTime()
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime()
    return bTime - aTime
  })
}

export function resolveSelectedInstanceId(opts: {
  requestedId: string | null
  localId: string | null
  instanceIds: string[]
  isLoading: boolean
}): string {
  const { requestedId, localId, instanceIds, isLoading } = opts

  if (requestedId && requestedId !== "new") {
    return requestedId
  }

  if (localId && localId !== "new") {
    if (instanceIds.includes(localId) || isLoading) return localId
  }

  if (localId === "new" || requestedId === "new") return "new"
  return instanceIds[0] || "new"
}

export function splitVisibleInstances<T extends { id: string }>(
  sorted: T[],
  selectedId: string | null,
  maxVisible: number
): { visible: T[]; hidden: T[] } {
  const limit = Math.max(1, maxVisible)
  if (sorted.length <= limit) {
    return { visible: sorted, hidden: [] }
  }

  const selectedIndex = selectedId ? sorted.findIndex((item) => item.id === selectedId) : -1
  if (selectedIndex === -1 || selectedIndex < limit) {
    const visible = [...sorted.slice(0, limit)]
    if (selectedIndex >= 0 && !visible.some((item) => item.id === selectedId)) {
      visible[visible.length - 1] = sorted[selectedIndex]
    }
    const visibleIds = new Set(visible.map((item) => item.id))
    return {
      visible,
      hidden: sorted.filter((item) => !visibleIds.has(item.id)),
    }
  }

  const visible = [...sorted.slice(0, limit - 1), sorted[selectedIndex]]
  const visibleIds = new Set(visible.map((item) => item.id))
  return {
    visible,
    hidden: sorted.filter((item) => !visibleIds.has(item.id)),
  }
}

export function shouldIgnoreInstanceTabChange(opts: {
  nextId: string
  currentId: string
  requestedId: string | null
  instanceIds: string[]
  isLoading: boolean
}): boolean {
  const { nextId, currentId, requestedId, instanceIds, isLoading } = opts
  if (nextId === currentId) return true
  if (!requestedId || requestedId === "new") return false
  if (nextId === requestedId) return false
  if (isLoading) return true
  return !instanceIds.includes(requestedId)
}
