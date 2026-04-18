/**
 * Menu-only grouping. Routes stay canonical (no URL prefixes for areas).
 *
 * Reports: each entry is its own destination — dashboard tabs via `?tab=` or standalone `/costs`.
 */

export type WorkspaceArea = "marketing" | "sales" | "automation" | "reports"

/** Middle sidebar (scroll): Marketing, Sales, Reports */
export const SIDEBAR_SCROLL_AREA_ORDER: WorkspaceArea[] = [
  "marketing",
  "sales",
  "reports",
]

/** Bottom sidebar above Configuration */
export const SIDEBAR_AUTOMATION_AREA_ORDER: WorkspaceArea[] = ["automation"]

export interface AreaNavItem {
  /** Stable id for i18n / emoji map */
  key: string
  /** Path without query (e.g. `/dashboard`, `/costs`) */
  href: string
  /** When set, navigation uses `/dashboard?tab=…` and active state matches this tab */
  dashboardTab?: string
  /** When set with `/settings`, link and active state use `?tab=` on the settings page */
  settingsTab?: string
}

export const NAVIGATION_AREAS: Record<
  WorkspaceArea,
  { categoryKey: string; items: AreaNavItem[] }
> = {
  marketing: {
    categoryKey: "layout.category.marketing",
    items: [
      { key: "campaigns", href: "/campaigns" },
      { key: "segments", href: "/segments" },
      { key: "content", href: "/content" },
      { key: "assets", href: "/assets" },
    ],
  },
  sales: {
    categoryKey: "layout.category.sales",
    items: [
      { key: "controlCenter", href: "/control-center" },
      { key: "sales", href: "/sales" },
      { key: "leads", href: "/leads" },
      { key: "deals", href: "/deals" },
      { key: "chat", href: "/chat" },
      { key: "people", href: "/people" },
    ],
  },
  automation: {
    categoryKey: "layout.category.automation",
    items: [
      { key: "context", href: "/context" },
      { key: "agentsConfiguration", href: "/agents" },
      { key: "requirements", href: "/requirements" },
      { key: "channels", href: "/settings", settingsTab: "channels" },
      { key: "activities", href: "/settings", settingsTab: "activities" },
    ],
  },
  reports: {
    categoryKey: "layout.category.reports",
    items: [
      { key: "reportPerformance", href: "/dashboard", dashboardTab: "performance" },
      { key: "reportOverview", href: "/dashboard", dashboardTab: "overview" },
      { key: "reportAnalytics", href: "/dashboard", dashboardTab: "analytics" },
      { key: "reportTraffic", href: "/dashboard", dashboardTab: "traffic" },
      { key: "reportCosts", href: "/costs" },
      { key: "reportSales", href: "/dashboard", dashboardTab: "sales" },
    ],
  },
}

export function buildNavItemHref(item: AreaNavItem): string {
  if (item.dashboardTab) {
    return `/dashboard?tab=${item.dashboardTab}`
  }
  if (item.settingsTab) {
    return `/settings?tab=${item.settingsTab}`
  }
  return item.href
}

/** Active state for sidebar items (pathname from `usePathname`, searchParams from `useSearchParams`). */
export function isNavItemActive(
  item: AreaNavItem,
  pathname: string,
  searchParams: URLSearchParams
): boolean {
  if (item.dashboardTab) {
    if (!pathname.startsWith("/dashboard")) return false
    const cur = searchParams.get("tab")
    if (item.dashboardTab === "performance") {
      return !cur || cur === "performance"
    }
    return cur === item.dashboardTab
  }
  if (item.settingsTab) {
    if (!pathname.startsWith("/settings")) return false
    return searchParams.get("tab") === item.settingsTab
  }
  if (!item.href) return false
  return pathname.startsWith(item.href)
}

export function isAreaActive(
  area: WorkspaceArea,
  pathname: string,
  searchParams: URLSearchParams
): boolean {
  return NAVIGATION_AREAS[area].items.some((item) =>
    isNavItemActive(item, pathname, searchParams)
  )
}
