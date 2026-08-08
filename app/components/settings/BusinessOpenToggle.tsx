"use client"

import { useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Switch } from "@/app/components/ui/switch"
import { Label } from "@/app/components/ui/label"
import { toast } from "sonner"
import { Store } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"

export function BusinessOpenToggle() {
  const { currentSite, updateSettings } = useSite()
  const { t } = useLocalization()
  const [isUpdating, setIsUpdating] = useState(false)

  if (!currentSite) return null;

  const businessHours = currentSite.settings?.business_hours || [];
  const hasHours = businessHours.length > 0;
  
  // If we don't have business hours configured, they can't toggle this.
  // We could create a default one, but let's just default to open.
  const isForceClosed = hasHours && !!businessHours[0].force_closed;
  const isOpen = !isForceClosed;

  const handleToggle = async (checked: boolean) => {
    if (!hasHours) {
      toast.error(t("settings.storeOpen.configureHoursFirst"));
      return;
    }

    setIsUpdating(true);
    try {
      const newForceClosed = !checked;
      const newHours = [...businessHours];
      newHours[0] = { ...newHours[0], force_closed: newForceClosed };

      await updateSettings(currentSite.id, {
        business_hours: newHours
      });

      toast.success(
        newForceClosed
          ? t("settings.storeOpen.toast.closed")
          : t("settings.storeOpen.toast.open")
      );
    } catch (err) {
      console.error(err);
      toast.error(t("settings.storeOpen.toast.error"));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors",
        isOpen
          ? "border-emerald-500/45 bg-emerald-500/15 dark:border-emerald-400/50 dark:bg-emerald-500/20"
          : "border-rose-500/40 bg-rose-500/10 dark:border-rose-400/45 dark:bg-rose-500/15",
        (isUpdating || !hasHours) && "opacity-60"
      )}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          isOpen ? "bg-emerald-500 dark:bg-emerald-400" : "bg-rose-500 dark:bg-rose-400"
        )}
        aria-hidden
      />
      <Store
        className={cn(
          "h-4 w-4",
          isOpen ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"
        )}
      />
      <Label
        htmlFor="store-open-toggle"
        className={cn(
          "cursor-pointer select-none text-sm font-semibold",
          isOpen ? "text-emerald-800 dark:text-emerald-200" : "text-rose-800 dark:text-rose-200"
        )}
      >
        {isOpen ? t("settings.storeOpen.open") : t("settings.storeOpen.closed")}
      </Label>
      <Switch
        id="store-open-toggle"
        checked={isOpen}
        onCheckedChange={handleToggle}
        disabled={isUpdating || !hasHours}
        className={cn(
          "ml-0.5 origin-right scale-90 [&>span]:bg-white [&>span]:shadow-sm dark:[&>span]:bg-white",
          isOpen
            ? "data-[state=checked]:bg-emerald-500"
            : "data-[state=unchecked]:bg-rose-500/50"
        )}
      />
    </div>
  )
}
