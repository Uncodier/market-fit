"use client"

import { useState } from "react"
import { Badge } from "@/app/components/ui/badge"
import { ChevronDown, ChevronUp, X } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getNavItemTitle } from "@/app/config/navigation-areas"
import { getBlockableNavGroups } from "@/lib/auth/screen-access"
import { cn } from "@/lib/utils"

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
  const [open, setOpen] = useState(blockedScreens.length > 0)
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
    <div className="rounded-lg border border-border/70 bg-muted/20">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-medium">{t("settings.team.appAccess") || "App access"}</span>
          {hiddenCount > 0 ? (
            <>
              <Badge variant="secondary">{hiddenCount} {t("settings.team.hidden") || "hidden"}</Badge>
              {!open && hiddenPreview.length > 0 && (
                <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                  {hiddenPreview.join(", ")}
                  {hiddenCount > hiddenPreview.length
                    ? ` +${hiddenCount - hiddenPreview.length}`
                    : ""}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">{t("settings.team.allAppsVisible") || "All apps visible"}</span>
          )}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="space-y-4 border-t border-border/70 px-3 py-3">
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
                      <button
                        key={item.key}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleKey(item.key)}
                        title={isBlocked ? (t("settings.team.showApp") || "Show this app") : (t("settings.team.hideApp") || "Hide this app")}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                          isBlocked
                            ? "border-border bg-muted text-muted-foreground"
                            : "border-border bg-background hover:bg-accent"
                        )}
                      >
                        {getNavItemTitle(item, t)}
                        {isBlocked && <X className="h-3 w-3" size={12} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
