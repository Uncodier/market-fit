import { Button } from "@/app/components/ui/button"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { RecordDateRange } from "../lib/list-filter"

export function RecordDateFilter({ value, onChange }: {
  value: RecordDateRange
  onChange: (range: RecordDateRange) => void
}) {
  const { t } = useLocalization()
  return <div className="flex items-center gap-2">
    <Button variant={value ? "ghost" : "secondary"} size="sm" aria-pressed={!value} onClick={() => onChange(null)}>
      {t("datePicker.allTime")}
    </Button>
    <CalendarDateRangePicker
      initialStartDate={value?.startDate}
      initialEndDate={value?.endDate}
      onRangeChange={(startDate, endDate) => onChange({ startDate, endDate })}
    />
  </div>
}