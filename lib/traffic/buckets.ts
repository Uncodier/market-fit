import type { TrafficBucket } from "./types"

export function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

/** Escaping the prefix itself makes reserved-label protection collision-safe. */
export function recordedLabel(name: string, reserved: string[], prefix = "Recorded: "): string {
  return reserved.some(label => label.toLowerCase() === name.toLowerCase()) || name.startsWith(prefix)
    ? `${prefix}${name}`
    : name
}

export function countBucket(counts: Map<string, number>, name: string): void {
  counts.set(name, (counts.get(name) ?? 0) + 1)
}

export function sortedBuckets(counts: Map<string, number>, top?: number, alwaysVisible: string[] = []): TrafficBucket[] {
  const rows = Array.from(counts, ([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
  if (top === undefined || rows.length <= top) return rows
  const retained = rows.filter(row => alwaysVisible.includes(row.name))
  const ranked = rows.filter(row => !alwaysVisible.includes(row.name))
  const visible = [...ranked.slice(0, top), ...retained]
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
  if (ranked.length <= top) return visible
  return [
    ...visible,
    { name: "Other", value: ranked.slice(top).reduce((sum, row) => sum + row.value, 0) },
  ]
}