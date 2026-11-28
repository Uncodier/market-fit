import { ToolbarDateRangePicker } from "@/app/components/ui/toolbar-date-range-picker"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { RecordDateRange } from "../lib/list-filter"

export function RecordDateFilter({ value, onChange }: {
  value: RecordDateRange
  onChange: (range: RecordDateRange) => void
}) {
  const { t } = useLocalization()
  const clear = t("clear")
  const clearLabel = clear && clear !== "clear" ? clear : "Clear date range"
  return (
    <ToolbarDateRangePicker
      clearLabel={clearLabel}
      onClear={value ? () => onChange(null) : undefined}
      initialStartDate={value?.startDate}
      initialEndDate={value?.endDate}
      onRangeChange={(startDate, endDate) => onChange({ startDate, endDate })}
    />
  )
}