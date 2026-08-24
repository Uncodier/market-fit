/**
 * Menu-only grouping. Routes stay canonical (no URL prefixes for areas).
 *
 * Reports and Finance: each entry is its own destination — dashboard tabs via `?tab=` or standalone `/costs` / `/finance`.
 */

export type WorkspaceArea = "marketing" | "sales" | "operations" | "buying" | "automation" | "applications" | "finance" | "reports" | "settings"

/** Middle sidebar (scroll): Marketing, Sales, Operations, Buying, Finance, Reports */
export const SIDEBAR_SCROLL_AREA_ORDER: WorkspaceArea[] = [
  "marketing",
  "sales",
  "operations",
  "buying",
  "finance",
  "reports",
]

/** Bottom sidebar above Configuration */
export const SIDEBAR_AUTOMATION_AREA_ORDER: WorkspaceArea[] = [
  "applications",
  "automation",
]

/** Apps launcher and navigation modal sections, including Settings. */
export const NAVIGATION_MENU_AREA_ORDER: WorkspaceArea[] = [
  "marketing",
  "sales",
  "operations",
  "buying",
  "automation",
  "finance",
  "reports",
  "applications",
  "settings",
]

/** Same as the launcher; kept for screen-access matching. */
export const ALL_NAV_AREA_ORDER: WorkspaceArea[] = NAVIGATION_MENU_AREA_ORDER

export interface AreaNavItem {
  /** Stable id for i18n / emoji map */
  key: string
  /** Path without query (e.g. `/dashboard`, `/costs`) */
  href: string
  /** When set, navigation uses `/dashboard?tab=…` and active state matches this tab */
  dashboardTab?: string
  /** When set with `/settings`, link and active state use `?tab=` on the settings page */
  settingsTab?: string
  /** When set with `/robots`, link and active state use `?mode=` (Content Creator canvas) */
  robotsMode?: string
  /** When true, item won't be rendered in the sidebar menu */
  hidden?: boolean
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
      { key: "promotions", href: "/promotions" },
      { key: "content", href: "/content" },
      { key: "contentCreator", href: "/robots", robotsMode: "imprenta" },
      { key: "assets", href: "/assets" },
    ],
  },
  sales: {
    categoryKey: "layout.category.sales",
    items: [
      { key: "salesHome", href: "/sales-home", hidden: true },
      { key: "pos", href: "/pos" },
      { key: "catalog", href: "/catalog" },
      { key: "priceLists", href: "/price-lists" },
      { key: "subscriptions", href: "/subscriptions" },
      { key: "sales", href: "/sales" },
      { key: "leads", href: "/leads" },
      { key: "deals", href: "/deals" },
      { key: "quotations", href: "/quotations" },
      { key: "people", href: "/people" },
    ],
  },
  operations: {
    categoryKey: "layout.category.operations",
    items: [
      { key: "chat", href: "/chat" },
      { key: "records", href: "/records" },
      { key: "orders", href: "/orders" },
      { key: "shipments", href: "/shipments" },
      { key: "controlCenter", href: "/control-center" },
      { key: "reservations", href: "/reservations" },
      { key: "visits", href: "/visits" },
      { key: "checkIn", href: "/pos/check-in" },
      { key: "inventory", href: "/inventory" },
      { key: "printers", href: "/settings", settingsTab: "printers" },
    ],
  },
  buying: {
    categoryKey: "layout.category.buying",
    items: [
      { key: "bills", href: "/bills" },
      { key: "transactions", href: "/transactions" },
      { key: "purchasesOrders", href: "/purchases/orders" },
      { key: "purchasesSubscriptions", href: "/purchases/subscriptions" },
      { key: "purchasesQuotes", href: "/purchases/quotes" },
      { key: "purchasesLibrary", href: "/purchases/library" },
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
      { key: "skills", href: "/skills" },
      { key: "workflows", href: "/robots", robotsMode: "workflow" },
    ],
  },
  applications: {
    categoryKey: "layout.category.applications",
    items: [
      { key: "applicationsDatabase", href: "/applications/database" },
      { key: "applicationsRepositories", href: "/applications/repositories" },
    ],
  },
  finance: {
    categoryKey: "layout.category.finance",
    items: [
      { key: "financeReports", href: "/finance" },
      { key: "journalEntries", href: "/accounting/entries" },
      { key: "chartOfAccounts", href: "/accounting" },
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
  settings: {
    categoryKey: "layout.category.settings",
    items: [
      { key: "settingsGeneral", href: "/settings", settingsTab: "general" },
      { key: "company", href: "/settings", settingsTab: "company" },
      { key: "marketplace", href: "/settings", settingsTab: "marketplace" },
      { key: "settingsVisits", href: "/settings", settingsTab: "visits" },
      { key: "team", href: "/settings", settingsTab: "team" },
      { key: "calendar", href: "/settings", settingsTab: "calendar" },
      { key: "social", href: "/settings", settingsTab: "social" },
      { key: "integrations", href: "/integrations" },
      { key: "billing", href: "/billing" },
      { key: "security", href: "/security" },
    ],
  },
}

export function buildNavItemHref(
  item: AreaNavItem,
  currentSearch?: URLSearchParams | string
): string {
  const p = new URLSearchParams(
    typeof currentSearch === "string"
      ? currentSearch
      : currentSearch?.toString() ?? ""
  )
  const isArtifact = p.get("artifact") === "true"

  let baseHref = item.href
  const queryParams = new URLSearchParams()
  
  if (isArtifact) {
    queryParams.set("artifact", "true")
  }

  if (item.dashboardTab) {
    baseHref = "/dashboard"
    queryParams.set("tab", item.dashboardTab)
  } else if (item.settingsTab) {
    baseHref = "/settings"
    queryParams.set("tab", item.settingsTab)
  } else if (item.robotsMode) {
    baseHref = "/robots"
    p.set("mode", item.robotsMode)
    if (isArtifact) p.set("artifact", "true")
    const q = p.toString()
    return q ? `/robots?${q}` : `/robots?mode=${item.robotsMode}`
  }

  const qs = queryParams.toString()
  return qs ? `${baseHref}?${qs}` : baseHref
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
    const cur = searchParams.get("tab")
    if (item.settingsTab === "general") {
      return !cur || cur === "general"
    }
    return cur === item.settingsTab
  }
  if (item.robotsMode) {
    if (!pathname.startsWith("/robots")) return false
    return searchParams.get("mode") === item.robotsMode
  }
  if (!item.href) return false
  if (pathname === item.href) return true
  if (pathname.startsWith(item.href + '/')) return true
  if (pathname.startsWith(item.href + '?')) return true
  return false
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

export function getModuleArea(itemKey: string): WorkspaceArea | undefined {
  for (const [area, config] of Object.entries(NAVIGATION_AREAS)) {
    if (config.items.some((item) => item.key === itemKey)) {
      return area as WorkspaceArea
    }
  }
  return undefined
}

export const SETTINGS_NAV_KEYS = new Set(
  NAVIGATION_AREAS.settings.items.map((item) => item.key)
)

export function isSettingsNavKey(key: string): boolean {
  return SETTINGS_NAV_KEYS.has(key)
}

const CONFIGURATION_PATH_PREFIXES = ["/integrations", "/billing", "/security"]
const SHORTCUT_ELIGIBLE_SETTINGS_TABS = new Set(["printers", "channels", "activities"])

/** Bottom Configuration section — do not pin these as sidebar shortcuts. */
export function isConfigurationNavPath(
  pathname: string,
  searchParams?: URLSearchParams
): boolean {
  if (!pathname) return false
  if (
    CONFIGURATION_PATH_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  ) {
    return true
  }
  if (!pathname.startsWith("/settings")) return false
  const tab = searchParams?.get("tab")
  if (tab && SHORTCUT_ELIGIBLE_SETTINGS_TABS.has(tab)) return false
  return true
}

export function getNavItemTitle(item: AreaNavItem, t: (k: string) => string): string {
  if (item.dashboardTab) {
    const key = `dashboard.tabs.${item.dashboardTab}`
    const translation = t(key)
    return translation === key ? item.dashboardTab : translation
  }
  const sidebarKey = `layout.sidebar.${item.key}`
  const sidebarTitle = t(sidebarKey)
  if (sidebarTitle !== sidebarKey) return sidebarTitle
  if (item.settingsTab) {
    const tabKey = `settings.tabs.${item.settingsTab}`
    const tabTitle = t(tabKey)
    if (tabTitle !== tabKey) return tabTitle
  }
  if (item.key === "skills") {
    const translation = t("settings.tabs.skills")
    return translation === "settings.tabs.skills" ? "Code agent skills" : translation
  }
  if (item.key === "reportCosts") {
    const translation = t("layout.sidebar.costs")
    return translation === "layout.sidebar.costs" ? "Cost reports" : translation
  }
  if (item.key === "contentCreator") {
    const translation = t("layout.sidebar.imprenta")
    return translation === "layout.sidebar.imprenta" ? "Content Creator" : translation
  }
  if (item.key === "workflows") {
    const translation = t("layout.sidebar.workflows")
    return translation === "layout.sidebar.workflows" ? "Workflows" : translation
  }
  return item.key
}
