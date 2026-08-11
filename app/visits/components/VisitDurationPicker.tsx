"use client"

import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import { visitDurationOptions } from "../visit-helpers"

type Props = {
  value: number | null
  defaultMinutes?: number
  onChange: (minutes: number) => void
}

export function VisitDurationPicker({ value, defaultMinutes = 60, onChange }: Props) {
  const { t } = useLocalization()
  const options = visitDurationOptions(defaultMinutes)

  return (
    <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar min-h-0 relative z-20">
      <div className="grid grid-cols-1 gap-3 pb-2">
        {options.map((minutes) => (
          <Button
            key={minutes}
            type="button"
            variant={value === minutes ? "default" : "outline"}
            className={cn(
              "w-full justify-center font-medium transition-all h-12",
              value === minutes ? "shadow-md" : "hover:border-primary/30 hover:bg-accent"
            )}
            onClick={() => onChange(minutes)}
          >
            {t("visits.minutes", { count: minutes })}
          </Button>
        ))}
      </div>
    </div>
  )
}
