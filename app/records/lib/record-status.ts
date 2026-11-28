import type { RecordItem } from "../actions"

export const RECORD_STATUS_OPTIONS: readonly string[] = ["draft", "published", "active", "archived"]

export function recordStatusOptions(current?: string) {
  return current && !RECORD_STATUS_OPTIONS.includes(current) ? [current, ...RECORD_STATUS_OPTIONS] : RECORD_STATUS_OPTIONS
}

export function recordStatusGroup(status: string | null | undefined) {
  return status?.trim() || "draft"
}

export function recordStatusGroups(records: RecordItem[]) {
  const statuses = new Set(records.map(record => recordStatusGroup(record.status)))
  return [...RECORD_STATUS_OPTIONS.filter(status => status !== "archived"),
    ...Array.from(statuses).filter(status => !RECORD_STATUS_OPTIONS.includes(status)).sort(), "archived"]
}

export function recordStatusLabel(status: string, translate: (key: string) => string) {
  const key = `status.${status}`
  const label = translate(key)
  return label && label !== key ? label : status.charAt(0).toUpperCase() + status.slice(1)
}