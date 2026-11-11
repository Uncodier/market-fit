import {
  NAVIGATION_AREAS,
  buildNavItemHref,
  isNavItemActive,
  type AreaNavItem,
} from "@/app/config/navigation-areas"
import type { ShortcutRecord } from "./shortcut-types"

export interface MobileWorkspaceTab {
  key: string
  href: string
  item: AreaNavItem
}

const items = Object.values(NAVIGATION_AREAS).flatMap((area) => area.items)

export function mobileTabsFromShortcuts(entries: ShortcutRecord[]): MobileWorkspaceTab[] {
  const tabs: MobileWorkspaceTab[] = []
  // The sidebar inserts Overview automatically, even before the first visit.
  const history = entries.filter((entry) => !(entry.id === "reportOverview" && entry.pinned))
  for (const entry of history) {
    const item = items.find((candidate) => candidate.key === entry.id && !candidate.hidden)
    let tab: MobileWorkspaceTab | null = null
    if (entry.isCustom && entry.href?.startsWith("/") && !entry.href.startsWith("//")) {
      const url = new URL(entry.href, "https://workspace.local")
      if (url.origin === "https://workspace.local") {
        tab = resolveMobileWorkspaceTab(url.pathname, url.searchParams.toString())
      }
    } else if (item) {
      tab = { key: item.key, item, href: buildNavItemHref(item) }
    }
    if (tab && !tabs.some((existing) => existing.key === tab.key)) tabs.push(tab)
    if (tabs.length === 3) break
  }
  return tabs.length ? tabs : defaultMobileWorkspaceTabs()
}

export function defaultMobileWorkspaceTabs(): MobileWorkspaceTab[] {
  return ["chat", "leads", "controlCenter"].map((key) => {
    const item = items.find((candidate) => candidate.key === key)!
    return { key, item, href: item.href }
  })
}

export function resolveMobileWorkspaceTab(
  pathname: string,
  search: string,
): MobileWorkspaceTab | null {
  const params = new URLSearchParams(search)
  const item = items
    .filter((candidate) => !candidate.hidden && isNavItemActive(candidate, pathname, params))
    .sort((a, b) => b.href.length - a.href.length)[0]
  if (!item) return null
  return { key: item.key, href: search ? `${pathname}?${search}` : pathname, item }
}

/** Keep existing positions stable; newly opened modules replace the oldest slot. */
export function updateMobileWorkspaceTabs(
  tabs: MobileWorkspaceTab[],
  active: MobileWorkspaceTab | null,
): MobileWorkspaceTab[] {
  if (!active) return tabs
  const existing = tabs.findIndex((tab) => tab.key === active.key)
  if (existing < 0) return [...tabs.slice(-2), active]
  if (tabs[existing].href === active.href) return tabs
  return tabs.map((tab, index) => index === existing ? active : tab)
}