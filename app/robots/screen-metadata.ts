import { LayoutGrid } from "@/app/components/ui/icons"
import { findNavigationMenuItem, getNavItemTitle } from "@/app/config/navigation-areas"
import { AREA_ICON, NAV_ITEM_ICON } from "@/app/config/module-visuals"

const SCREEN_ALIASES: Record<string, string> = {
  database: "applicationsDatabase",
  imprenta: "contentCreator",
  workflow: "workflows",
}

export const getScreenMetadata = (screen: string | undefined, t: (k: string) => string) => {
  if (!screen) return { label: "App", icon: LayoutGrid }

  const key = SCREEN_ALIASES[screen] ?? screen
  const navigationEntry = findNavigationMenuItem(key)
  if (navigationEntry) {
    const { area, item } = navigationEntry
    return {
      label: getNavItemTitle(item, t),
      icon: NAV_ITEM_ICON[item.key] ?? AREA_ICON[area],
    }
  }

  if (key in AREA_ICON) {
    const categoryKey = `layout.category.${key}`
    const categoryLabel = t(categoryKey)
    return {
      label: categoryLabel !== categoryKey ? categoryLabel : key,
      icon: AREA_ICON[key as keyof typeof AREA_ICON],
    }
  }

  const translationKey = `layout.sidebar.${key}`
  let label = t(translationKey)
  if (label === translationKey) {
    label = (screen.charAt(0).toUpperCase() + screen.slice(1).replace(/([A-Z])/g, " $1")).trim()
  }

  return { label, icon: NAV_ITEM_ICON[key] ?? LayoutGrid }
}

