"use client"

import { format } from "date-fns"
import { Button } from "@/app/components/ui/button"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Label } from "@/app/components/ui/label"
import { useLocalization } from "@/app/context/LocalizationContext"
import { isDateOnly } from "@/lib/finance/due-date"

export function DueDateField({ id, value, onChange, disabled, description }: {
  id: string
  value?: string | null
  onChange: (value: string) => void
  disabled?: boolean
  description?: string
}) {
  const { t } = useLocalization()
  const date = isDateOnly(value) ? new Date(`${value}T12:00:00`) : undefined
  const descriptionId = description ? `${id}-description` : undefined

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Due date (optional)</Label>
      <div className="flex items-center gap-2">
        <DatePicker
          id={id}
          aria-describedby={descriptionId}
          date={date}
          setDate={(next) => onChange(format(next, "yyyy-MM-dd"))}
          className="h-12 w-full"
          placeholder={t("datePicker.selectDueDate")}
          disabled={disabled}
        />
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-12 shrink-0"
            aria-label="Clear due date"
            disabled={disabled}
            onClick={() => onChange("")}
          >
            Clear
          </Button>
        ) : null}
      </div>
      {description ? <p id={descriptionId} className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  )
}