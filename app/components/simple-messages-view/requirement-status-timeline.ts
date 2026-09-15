export interface RequirementStatusTimelineEntry {
  id?: string
  requirement_id?: string
  stage?: string
  message?: string
  created_at?: string
  preview_url?: string | null
  source_code?: string | null
  repo_url?: string | null
  requirements?: { id?: string } | Array<{ id?: string }> | null
  [key: string]: unknown
}

export interface RequirementStatusTimelineItem {
  type: 'requirement_status'
  timestamp: string
  data: RequirementStatusTimelineEntry
}

function timeMs(value?: string): number {
  const timestamp = value ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(timestamp) ? timestamp : 0
}

function requirementId(status: RequirementStatusTimelineEntry): string {
  if (status.requirement_id) return status.requirement_id
  if (Array.isArray(status.requirements)) return status.requirements[0]?.id ?? ''
  return status.requirements?.id ?? ''
}

function statusSignature(status: RequirementStatusTimelineEntry): string {
  return [
    requirementId(status),
    status.stage?.trim().toLowerCase() ?? '',
    status.message?.trim() ?? '',
  ].join('\u0000')
}

export function buildRequirementStatusTimelineItem(
  statuses: RequirementStatusTimelineEntry[]
): RequirementStatusTimelineItem | null {
  if (statuses.length === 0) return null

  const chronological = [...statuses].sort(
    (left, right) => timeMs(left.created_at) - timeMs(right.created_at)
  )
  const latestStatus = chronological[chronological.length - 1]
  const latestSignature = statusSignature(latestStatus)
  const anchorStatus =
    chronological.find((status) => statusSignature(status) === latestSignature) ??
    latestStatus

  const latestWith = (field: 'source_code' | 'preview_url' | 'repo_url') =>
    [...chronological].reverse().find((status) => status[field])?.[field] ?? null

  const timestamp = anchorStatus.created_at ?? latestStatus.created_at
  if (!timestamp) return null

  return {
    type: 'requirement_status',
    timestamp,
    data: {
      ...latestStatus,
      created_at: timestamp,
      source_code: latestWith('source_code'),
      preview_url: latestWith('preview_url'),
      repo_url: latestWith('repo_url'),
    },
  }
}
