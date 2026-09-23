import {
  NAVIGATION_AREAS,
  NAVIGATION_MENU_AREA_ORDER,
  isConfigurationNavPath,
  isSettingsNavKey,
  type AreaNavItem,
  type WorkspaceArea,
} from "@/app/config/navigation-areas"
import { canonicalizeShortcutRecords } from "./shortcut-normalization"
import {
  isPinnedShortcutKey,
  SIDEBAR_PINNED_NAV_KEYS,
  type ShortcutRecord,
} from "./shortcut-types"

export type AreaNavItemWithArea = AreaNavItem & { area: WorkspaceArea }

const pinnedNavKeys = new Set<string>(SIDEBAR_PINNED_NAV_KEYS)

export const ALL_SHORTCUT_ITEMS: AreaNavItemWithArea[] =
  NAVIGATION_MENU_AREA_ORDER.flatMap((areaKey) => {
    if (areaKey === "settings") return []

    return NAVIGATION_AREAS[areaKey].items.flatMap((item) =>
      pinnedNavKeys.has(item.key) || isSettingsNavKey(item.key)
        ? []
        : [{ ...item, area: areaKey }],
    )
  })

export function withoutConfigurationShortcuts(
  entries: ShortcutRecord[],
): ShortcutRecord[] {
  return entries.filter((entry) => {
    if (!entry.isCustom || !entry.href) return !isSettingsNavKey(entry.id)

    try {
      const url = new URL(entry.href, "http://local")
      return (
        !isConfigurationNavPath(url.pathname, url.searchParams) &&
        url.pathname !== "/onboarding" &&
        url.pathname !== "/navigation"
      )
    } catch {
      return true
    }
  })
}

export function prepareSidebarShortcuts(
  entries: ShortcutRecord[],
): ShortcutRecord[] {
  const shortcuts = withoutConfigurationShortcuts(
    canonicalizeShortcutRecords(entries).filter(
      (entry) => !isPinnedShortcutKey(entry.id),
    ),
  )

  if (shortcuts.some((entry) => entry.id === "reportOverview")) {
    return shortcuts
  }

  return [...shortcuts, { id: "reportOverview", pinned: true }]
}
