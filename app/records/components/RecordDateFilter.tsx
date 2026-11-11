import { Button } from "@/app/components/ui/button"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { RecordDateRange } from "../lib/list-filter"

export function RecordDateFilter({ value, onChange }: {
  value: RecordDateRange
  onChange: (range: RecordDateRange) => void
}) {
  const { t } = useLocalization()
  return <div className="flex min-w-0 flex-col items-stretch gap-2 md:flex-row md:items-center">
    <Button variant={value ? "ghost" : "secondary"} size="sm" aria-pressed={!value} onClick={() => onChange(null)}>
      {t("datePicker.allTime")}
    </Button>
    <CalendarDateRangePicker
      initialStartDate={value?.startDate}
      initialEndDate={value?.endDate}
      className="min-w-0 [&_button]:max-w-full [&_button]:whitespace-normal"
      onRangeChange={(startDate, endDate) => onChange({ startDate, endDate })}
    />
  </div>
}