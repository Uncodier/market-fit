import {
  ALL_NAV_AREA_ORDER,
  NAVIGATION_AREAS,
  buildNavItemHref,
  isNavItemActive,
  type AreaNavItem,
  type WorkspaceArea,
} from "@/app/config/navigation-areas"
import type { SiteMemberRole } from "@/lib/permissions/types"

export const FALLBACK_ALLOWED_PATH = "/profile"

const ALWAYS_ALLOWED_PREFIXES = [
  "/auth",
  "/profile",
  "/projects",
  "/create-site",
  "/notifications",
  "/navigation",
  "/buyer",
  "/shop",
  "/marketplace",
  "/cart",
  "/book",
  "/checkout",
  "/demo",
  "/onboarding",
]

export type ScreenAccessRole = SiteMemberRole | string | null | undefined

export function isAdminScreenRole(role: ScreenAccessRole): boolean {
  return role === "owner" || role === "admin"
}

/** Owners and admins can invite, update, and remove team members. */
export function canManageTeamMembers(
  isOwner: boolean | undefined,
  role: ScreenAccessRole
): boolean {
  return !!isOwner || isAdminScreenRole(role)
}

export const SITE_MEMBER_ROLES = ["admin", "marketing", "collaborator"] as const
export type WritableSiteMemberRole = (typeof SITE_MEMBER_ROLES)[number]

export function parseWritableSiteMemberRole(value: unknown): WritableSiteMemberRole | null {
  if (typeof value !== "string") return null
  return SITE_MEMBER_ROLES.includes(value as WritableSiteMemberRole)
    ? (value as WritableSiteMemberRole)
    : null
}

/** Maps a stored site_members role to the invitation payload used by magic links. */
export function siteMemberRoleToInvitationRole(role: WritableSiteMemberRole): string {
  switch (role) {
    case "admin":
      return "admin"
    case "collaborator":
      return "create"
    default:
      return "view"
  }
}

export function getBlockableNavItems(): AreaNavItem[] {
  const items: AreaNavItem[] = []
  for (const area of ALL_NAV_AREA_ORDER) {
    for (const item of NAVIGATION_AREAS[area].items) {
      if (!item.hidden) items.push(item)
    }
  }
  return items
}

export function getKnownNavKeys(): Set<string> {
  return new Set(getBlockableNavItems().map((item) => item.key))
}

export function getBlockableNavGroups(): {
  area: WorkspaceArea
  categoryKey: string
  items: AreaNavItem[]
}[] {
  return ALL_NAV_AREA_ORDER.map((area) => ({
    area,
    categoryKey: NAVIGATION_AREAS[area].categoryKey,
    items: NAVIGATION_AREAS[area].items.filter((item) => !item.hidden),
  })).filter((group) => group.items.length > 0)
}

export function sanitizeBlockedScreens(keys: unknown): string[] {
  if (!Array.isArray(keys)) return []
  const known = getKnownNavKeys()
  const unique = new Set<string>()
  for (const key of keys) {
    if (typeof key === "string" && known.has(key)) unique.add(key)
  }
  return [...unique]
}

function navItemMatchScore(item: AreaNavItem): number {
  let score = (item.href || "").length
  if (item.dashboardTab) score += 1000 + item.dashboardTab.length
  if (item.settingsTab) score += 1000 + item.settingsTab.length
  if (item.robotsMode) score += 1000 + item.robotsMode.length
  return score
}

export function getNavKeyForPath(
  pathname: string,
  searchParams: URLSearchParams
): string | null {
  let bestKey: string | null = null
  let bestScore = -1
  for (const item of getBlockableNavItems()) {
    if (!isNavItemActive(item, pathname, searchParams)) continue
    const score = navItemMatchScore(item)
    if (score > bestScore) {
      bestScore = score
      bestKey = item.key
    }
  }
  return bestKey
}

export function isAlwaysAllowedPath(pathname: string): boolean {
  if (pathname === "/") return true
  return ALWAYS_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export function isScreenBlocked(
  role: ScreenAccessRole,
  blockedScreens: string[] | null | undefined,
  navKey: string | null | undefined
): boolean {
  if (!navKey) return false
  if (isAdminScreenRole(role)) return false
  return (blockedScreens || []).includes(navKey)
}

export function firstAllowedNavHref(
  role: ScreenAccessRole,
  blockedScreens: string[] | null | undefined
): string {
  if (isAdminScreenRole(role)) return FALLBACK_ALLOWED_PATH
  const blocked = new Set(blockedScreens || [])
  for (const item of getBlockableNavItems()) {
    if (!blocked.has(item.key)) return buildNavItemHref(item)
  }
  return FALLBACK_ALLOWED_PATH
}
