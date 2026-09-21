import {
  NAVIGATION_AREAS,
  NAVIGATION_MENU_AREA_ORDER,
  type AreaNavItem,
} from "@/app/config/navigation-areas"
import type { ShortcutRecord } from "./shortcut-types"

function matchesCanonicalRoute(item: AreaNavItem, url: URL): boolean {
  if (item.href !== url.pathname) return false
  if (item.dashboardTab) {
    const tab = url.searchParams.get("tab")
    return item.dashboardTab === "performance"
      ? !tab || tab === "performance"
      : tab === item.dashboardTab
  }
  if (item.settingsTab) {
    const tab = url.searchParams.get("tab")
    return item.settingsTab === "general"
      ? !tab || tab === "general"
      : tab === item.settingsTab
  }
  if (item.robotsMode) {
    return url.searchParams.get("mode") === item.robotsMode
  }
  return true
}

function canonicalShortcutKey(entry: ShortcutRecord): string | null {
  if (!entry.isCustom || !entry.href) return null
  try {
    const url = new URL(entry.href, "http://local")
    for (const areaKey of NAVIGATION_MENU_AREA_ORDER) {
      const item = NAVIGATION_AREAS[areaKey].items.find((candidate) =>
        matchesCanonicalRoute(candidate, url),
      )
      if (item) return item.key
    }
  } catch {
    return null
  }
  return null
}

export function canonicalizeShortcutRecords(
  entries: ShortcutRecord[],
): ShortcutRecord[] {
  const result: ShortcutRecord[] = []
  const indexById = new Map<string, number>()

  for (const entry of entries) {
    const canonicalKey = canonicalShortcutKey(entry)
    const normalized = canonicalKey
      ? { id: canonicalKey, pinned: entry.pinned }
      : entry
    const existingIndex = indexById.get(normalized.id)
    if (existingIndex === undefined) {
      indexById.set(normalized.id, result.length)
      result.push(normalized)
      continue
    }
    if (normalized.pinned && !result[existingIndex].pinned) {
      result[existingIndex] = { ...result[existingIndex], pinned: true }
    }
  }

  return result
}
