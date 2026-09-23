import {
  NAVIGATION_AREAS,
  isNavItemActive,
} from "@/app/config/navigation-areas"
import type { ShortcutRecord } from "@/app/components/navigation/shortcut-types"
import {
  loadShortcutsFromLocalStorage,
  notifyShortcutsUpdated,
  saveShortcutsToLocalStorage,
} from "@/app/components/navigation/shortcut-storage"

function findNavigationKey(
  pathname: string,
  searchParams: URLSearchParams,
): string | null {
  for (const [areaKey, area] of Object.entries(NAVIGATION_AREAS)) {
    if (areaKey === "settings") continue

    for (const item of area.items) {
      if (
        item.key !== "contentCreator" &&
        item.key !== "reportOverview" &&
        isNavItemActive(item, pathname, searchParams)
      ) {
        return item.key
      }
    }
  }

  return null
}

function upsertShortcut(
  shortcuts: ShortcutRecord[],
  shortcut: ShortcutRecord,
): ShortcutRecord[] {
  const existingIndex = shortcuts.findIndex((item) => item.id === shortcut.id)
  if (existingIndex === -1) return [...shortcuts, shortcut]

  return shortcuts.map((item, index) =>
    index === existingIndex ? { ...item, ...shortcut } : item,
  )
}

interface PinArtifactShortcutOptions {
  artifactUrl: string
  title: string
}

export function pinArtifactToNavigation({
  artifactUrl,
  title,
}: PinArtifactShortcutOptions): void {
  const siteId = localStorage.getItem("currentSiteId")
  if (!siteId) {
    throw new Error("Select a site before pinning an artifact.")
  }

  const url = new URL(artifactUrl, window.location.origin)
  const searchParams = new URLSearchParams(url.search)
  const navigationKey = findNavigationKey(url.pathname, searchParams)

  searchParams.delete("artifact")
  searchParams.delete("theme")

  const cleanSearch = searchParams.toString()
  const cleanUrl = `${url.pathname}${cleanSearch ? `?${cleanSearch}` : ""}`
  const shortcut: ShortcutRecord = navigationKey
    ? { id: navigationKey, pinned: true }
    : {
        id: `custom-${url.pathname.replace(/\//g, "-")}`,
        title,
        href: cleanUrl,
        isCustom: true,
        pinned: true,
      }

  saveShortcutsToLocalStorage(
    siteId,
    upsertShortcut(loadShortcutsFromLocalStorage(siteId), shortcut),
  )
  notifyShortcutsUpdated(siteId)
}
