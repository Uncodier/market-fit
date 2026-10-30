import { NAVIGATION_AREAS, getNavItemTitle } from '@/app/config/navigation-areas'
import { localeMessages } from '@/app/context/locale-catalog'

const screens = Object.values(NAVIGATION_AREAS).flatMap(area => area.items)
const screenPaths = [...new Set(screens.map(item => item.href))].sort((a, b) => b.length - a.length)

/** Resolve real sidebar destinations, not menu categories or URL grouping segments. */
export function workspaceScreenRoot(fullPath: string): string | null {
  const pathname = fullPath.split(/[?#]/)[0]
  return screenPaths.find(path => pathname === path || pathname.startsWith(`${path}/`)) ?? null
}

export function workspaceScreenTitle(fullPath: string, t?: (key: string) => string): string | null {
  const [pathname, query] = fullPath.split('?')
  const params = new URLSearchParams(query)
  if (pathname === '/settings/procurement') {
    const key = 'procurement.navigation.settings'
    const translated = t?.(key)
    return translated && translated !== key ? translated : localeMessages.en[key]
  }
  const candidates = screens.filter(item => item.href === pathname)
  const item = candidates.find(item =>
    (item.settingsTab && item.settingsTab === params.get('tab')) ||
    (item.dashboardTab && item.dashboardTab === params.get('tab')) ||
    (item.robotsMode && item.robotsMode === params.get('mode')))
    ?? candidates.find(item => !item.settingsTab && !item.dashboardTab && !item.robotsMode)
  if (!item) {
    if (pathname === '/settings') {
      const key = 'layout.sidebar.settings'
      const translated = t?.(key)
      return translated && translated !== key ? translated : localeMessages.en[key] || 'Settings'
    }
    return null
  }
  return getNavItemTitle(item, key => {
    const translated = t?.(key)
    return translated && translated !== key ? translated : localeMessages.en[key] ?? key
  })
}