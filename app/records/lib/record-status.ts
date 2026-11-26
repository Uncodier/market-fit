import type { RecordItem } from "../actions"

const DEFAULT_STATUSES = ["draft", "published", "archived"]

export function recordStatusGroup(status: string | null | undefined) {
  return status?.trim() || "draft"
}

export function recordStatusGroups(records: RecordItem[]) {
  const statuses = new Set(records.map(record => recordStatusGroup(record.status)))
  return [...DEFAULT_STATUSES.filter(status => status !== "archived"),
    ...Array.from(statuses).filter(status => !DEFAULT_STATUSES.includes(status)).sort(), "archived"]
}

export function recordStatusLabel(status: string, translate: (key: string) => string) {
  const key = `status.${status}`
  const label = translate(key)
  return label && label !== key ? label : status.charAt(0).toUpperCase() + status.slice(1)
}