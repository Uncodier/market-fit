export type InstanceFilterTab = "all" | "nodes" | "workflows" | "files" | "requirements"
export type InstanceSortBy = "newest" | "oldest" | "name_asc" | "name_desc" | "status"

export interface RobotInstance {
  id: string
  name?: string
  status?: string
  requirement_title?: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export interface InstanceAssetPreview {
  id: string
  file_path?: string
  name?: string
  file_name?: string
  file_type?: string
}

export interface InstanceStats {
  nodes: number
  workflows: number
  assets: number
  requirements: number
  recentAssets: InstanceAssetPreview[]
  avatarUrl: string | null
}

export interface InstanceLogPreview {
  message?: string
  details?: { attachments?: Array<{ name?: string; file_name?: string; title?: string }> }
  created_at?: string
}

export interface InstanceMessages {
  user: InstanceLogPreview | null
  agent: InstanceLogPreview | null
}

const ACTIVE_STATUSES = ["running", "active", "starting", "pending", "initializing"]

export function getInstanceDisplayName(instance: RobotInstance) {
  return instance.requirement_title || instance.name || `mk-${instance.id.slice(-4)}`
}

export function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

export function getInstanceStatusKey(status?: string) {
  if (["running", "active"].includes(status || "")) return "active"
  if (status === "paused") return "paused"
  if (["starting", "pending", "initializing"].includes(status || "")) return "pending"
  if (["failed", "error"].includes(status || "")) return "failed"
  if (["stopped", "completed", "done"].includes(status || "")) return "completed"
  return status || "inactive"
}

export function getInstanceStatusLabel(status?: string) {
  const key = getInstanceStatusKey(status)
  if (key === "active") return "Running"
  if (key === "paused") return "Paused"
  if (key === "pending") return "Starting"
  if (key === "failed") return "Failed"
  if (key === "completed") return "Stopped"
  if (key === "inactive") return "Inactive"
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatLogMessage(log: InstanceLogPreview | null) {
  if (!log) return ""

  let message = log.message || ""
  const attachments = log.details?.attachments
  if (Array.isArray(attachments) && attachments.length > 0) {
    const attachment = attachments[0]
    const name = attachment?.name || attachment?.file_name || attachment?.title
    const attachmentName = name ? `: ${name}` : ""
    const attachmentText =
      attachments.length > 1 ? `[${attachments.length} attachments]` : `[Attachment${attachmentName}]`
    message = message ? `${message} ${attachmentText}` : attachmentText
  }

  return message
}

export function getInstancePreview(messages?: InstanceMessages) {
  const userMessage = formatLogMessage(messages?.user || null)
  const agentMessage = formatLogMessage(messages?.agent || null)
  return userMessage || agentMessage || ""
}

export function instanceMatchesTab(stats: InstanceStats | undefined, tab: InstanceFilterTab) {
  if (tab === "all") return true
  if (!stats) return true
  if (tab === "nodes") return stats.nodes > 0
  if (tab === "workflows") return stats.workflows > 0
  if (tab === "files") return stats.assets > 0
  return stats.requirements > 0
}

function instanceTimestamp(instance: RobotInstance) {
  return new Date(instance.updated_at || instance.created_at || 0).getTime()
}

export function filterAndSortInstances(
  instances: RobotInstance[],
  searchQuery: string,
  tab: InstanceFilterTab,
  sortBy: InstanceSortBy,
  statsById: Record<string, InstanceStats>
) {
  const query = normalizeSearch(searchQuery.trim())

  const filtered = instances.filter((instance) => {
    if (!instanceMatchesTab(statsById[instance.id], tab)) return false
    if (!query) return true
    const name = normalizeSearch(getInstanceDisplayName(instance))
    return name.includes(query) || instance.id.toLowerCase().includes(query)
  })

  return [...filtered].sort((a, b) => {
    if (sortBy === "name_asc") return getInstanceDisplayName(a).localeCompare(getInstanceDisplayName(b))
    if (sortBy === "name_desc") return getInstanceDisplayName(b).localeCompare(getInstanceDisplayName(a))
    if (sortBy === "status") {
      const aActive = ACTIVE_STATUSES.includes(a.status || "") ? 1 : 0
      const bActive = ACTIVE_STATUSES.includes(b.status || "") ? 1 : 0
      if (aActive !== bActive) return bActive - aActive
    }

    const aTime = instanceTimestamp(a)
    const bTime = instanceTimestamp(b)
    return sortBy === "oldest" ? aTime - bTime : bTime - aTime
  })
}

export function countInstancesByTab(
  instances: RobotInstance[],
  statsById: Record<string, InstanceStats>
) {
  const counts = { all: instances.length, nodes: 0, workflows: 0, files: 0, requirements: 0 }

  instances.forEach((instance) => {
    const stats = statsById[instance.id]
    if (!stats) return
    if (stats.nodes > 0) counts.nodes += 1
    if (stats.workflows > 0) counts.workflows += 1
    if (stats.assets > 0) counts.files += 1
    if (stats.requirements > 0) counts.requirements += 1
  })

  return counts
}
