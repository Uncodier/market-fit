import { Button } from "@/app/components/ui/button"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { X } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import type { RecordDateRange } from "../lib/list-filter"

export function RecordDateFilter({ value, onChange }: {
  value: RecordDateRange
  onChange: (range: RecordDateRange) => void
}) {
  const { t } = useLocalization()
  const clear = t("clear")
  const clearLabel = clear && clear !== "clear" ? clear : "Clear date range"
  return <div className="relative min-w-0 max-w-full">
    <CalendarDateRangePicker
      initialStartDate={value?.startDate}
      initialEndDate={value?.endDate}
      className={cn("min-w-0 [&_button]:max-w-full [&_button]:whitespace-normal", value && "[&_button]:pr-10")}
      onRangeChange={(startDate, endDate) => onChange({ startDate, endDate })}
    />
    {value && (
      <Button type="button" variant="ghost" size="icon" data-toolbar-icon-action="off"
        className="absolute right-1 top-1 z-10 h-7 w-7"
        aria-label={clearLabel} title={clearLabel} onClick={() => onChange(null)}>
        <X className="h-4 w-4" />
      </Button>
    )}
  </div>
}