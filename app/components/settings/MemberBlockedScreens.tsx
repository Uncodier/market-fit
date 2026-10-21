"use client"

import { useLocalization } from "@/app/context/LocalizationContext"
import { getNavItemTitle } from "@/app/config/navigation-areas"
import { getBlockableNavGroups } from "@/lib/auth/screen-access"
import { MemberAccessChip, MemberAccessPanel } from "./MemberAccessPanel"

interface MemberBlockedScreensProps {
  blockedScreens: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}

export function MemberBlockedScreens({
  blockedScreens,
  onChange,
  disabled = false,
}: MemberBlockedScreensProps) {
  const { t } = useLocalization()
  const groups = getBlockableNavGroups()
  const blocked = new Set(blockedScreens)
  const hiddenCount = blockedScreens.length

  const toggleKey = (key: string) => {
    if (disabled) return
    const next = new Set(blocked)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange([...next])
  }

  const toggleArea = (keys: string[], shouldBlock: boolean) => {
    if (disabled) return
    const next = new Set(blocked)
    for (const key of keys) {
      if (shouldBlock) next.add(key)
      else next.delete(key)
    }
    onChange([...next])
  }

  const hiddenPreview = groups
    .flatMap((group) =>
      group.items
        .filter((item) => blocked.has(item.key))
        .map((item) => getNavItemTitle(item, t))
    )
    .slice(0, 2)

  return (
    <MemberAccessPanel title={t("settings.team.appAccess") || "App access"}
      count={hiddenCount} countLabel={t("settings.team.hidden") || "hidden"}
      summary={t("settings.team.allAppsVisible") || "All apps visible"}
      preview={hiddenPreview} initialOpen={hiddenCount > 0}>
      <p className="text-xs text-muted-foreground">
        {t("settings.team.hiddenAppsDesc") || "Hidden apps will not appear in this member's menu."}
      </p>
      {groups.map((group) => {
        const keys = group.items.map((item) => item.key)
        const blockedCount = keys.filter((key) => blocked.has(key)).length
        const allBlocked = blockedCount === keys.length
        const categoryTitle = t(group.categoryKey)
        return (
          <div key={group.area} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {categoryTitle === group.categoryKey ? group.area : categoryTitle}
              </p>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={disabled}
                onClick={() => toggleArea(keys, !allBlocked)}
              >
                {allBlocked ? (t("settings.team.showAll") || "Show all") : (t("settings.team.hideAll") || "Hide all")}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((item) => {
                const isBlocked = blocked.has(item.key)
                return (
                  <MemberAccessChip
                    key={item.key}
                    restricted={isBlocked}
                    disabled={disabled}
                    onClick={() => toggleKey(item.key)}
                    title={isBlocked ? (t("settings.team.showApp") || "Show this app") : (t("settings.team.hideApp") || "Hide this app")}
                  >
                    {getNavItemTitle(item, t)}
                  </MemberAccessChip>
                )
              })}
            </div>
          </div>
        )
      })}
    </MemberAccessPanel>
  )
}
