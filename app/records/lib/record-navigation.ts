const STORAGE_KEY = "records:view-navigation"
const SNAPSHOT_LIMIT = 5
const SAFE_ID = /^[a-zA-Z0-9_-]+$/

export type OpenRecordFromView = (recordId: string, orderedIds: string[]) => void

type Snapshot = { key: string; siteId: string; ids: string[] }

function readSnapshots(): Snapshot[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]")
    return Array.isArray(value) ? value.filter((entry): entry is Snapshot => (
      entry && typeof entry.key === "string" && typeof entry.siteId === "string" &&
      Array.isArray(entry.ids) && entry.ids.every((id: unknown) => typeof id === "string" && SAFE_ID.test(id))
    )) : []
  } catch {
    return []
  }
}

function recordHref(recordId: string, key?: string) {
  return `/records/${encodeURIComponent(recordId)}${key ? `?recordView=${encodeURIComponent(key)}` : ""}`
}

export function openRecordFromView(siteId: string, recordId: string, orderedIds: string[]) {
  const ids = [...new Set(orderedIds.filter(id => SAFE_ID.test(id)))]
  if (!ids.includes(recordId)) return recordHref(recordId)

  try {
    const key = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("")
    const snapshots = [{ key, siteId, ids }, ...readSnapshots()].slice(0, SNAPSHOT_LIMIT)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots))
    return recordHref(recordId, key)
  } catch {
    return recordHref(recordId)
  }
}

export function getRecordNeighbors(siteId: string, recordId: string, key: string) {
  const snapshot = readSnapshots().find(entry => entry.key === key && entry.siteId === siteId)
  if (!snapshot) return null
  const index = snapshot.ids.indexOf(recordId)
  if (index === -1) return null

  const previous = snapshot.ids[index - 1]
  const next = snapshot.ids[index + 1]
  return {
    previous: previous ? recordHref(previous, key) : null,
    next: next ? recordHref(next, key) : null,
  }
}