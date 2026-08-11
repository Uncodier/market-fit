"use client"

import { useEffect, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Switch } from "@/app/components/ui/switch"
import { toast } from "sonner"
import { Store } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { isBusinessOpen, withStoreOpenState } from "@/app/commerce/business-hours"
import { MenuItem } from "@/app/components/navigation/MenuItem"

interface BusinessOpenToggleProps {
  isCollapsed?: boolean
}

export function BusinessOpenToggle({ isCollapsed }: BusinessOpenToggleProps) {
  const { currentSite, updateSettings } = useSite()
  const { t } = useLocalization()
  const [isUpdating, setIsUpdating] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  if (!currentSite) return null

  const businessHours = currentSite.settings?.business_hours || []
  const hasHours = businessHours.length > 0
  const isOpen = hasHours ? isBusinessOpen(businessHours, now) : true
  const title = isOpen
    ? t("settings.storeOpen.open")
    : t("settings.storeOpen.closed")

  const handleToggle = async (checked: boolean) => {
    if (!hasHours) {
      toast.error(t("settings.storeOpen.configureHoursFirst"))
      return
    }

    setIsUpdating(true)
    try {
      const newHours = withStoreOpenState(businessHours, checked, now)

      await updateSettings(currentSite.id, {
        business_hours: newHours,
      })

      toast.success(
        checked
          ? t("settings.storeOpen.toast.open")
          : t("settings.storeOpen.toast.closed")
      )
    } catch (err) {
      console.error(err)
      toast.error(t("settings.storeOpen.toast.error"))
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className={cn("relative", !isCollapsed && "pl-3")}>
      <MenuItem
        href="#"
        icon={Store}
        title={title}
        isActive={false}
        isCollapsed={isCollapsed}
        onClick={(e) => {
          e.preventDefault()
          if (!isUpdating) void handleToggle(!isOpen)
        }}
      >
        {!isCollapsed && (
          <div className="ml-auto flex items-center">
            <Switch
              checked={isOpen}
              disabled={isUpdating}
              onCheckedChange={(checked) => {
                void handleToggle(checked)
              }}
              onClick={(e) => e.stopPropagation()}
              aria-label={title}
              className="data-[state=checked]:bg-primary/90 focus:outline-none focus:ring-0"
              style={{ outline: "none" }}
            />
          </div>
        )}
      </MenuItem>
    </div>
  )
}
