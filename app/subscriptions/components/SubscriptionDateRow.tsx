"use client"

import { format } from "date-fns"
import { Button } from "@/app/components/ui/button"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Calendar, ChevronDown } from "@/app/components/ui/icons"
import { Label } from "@/app/components/ui/label"
import { PropertyRow } from "@/app/leads/components/PropertyRow"
import { formatDueDate, isDateOnly } from "@/lib/finance/due-date"

export function SubscriptionDateRow({ id, label, value, onCommit, allowClear = false, description, readOnly = false, validate }: {
  id: string
  label: string
  value?: string | null
  onCommit: (value: string) => Promise<void>
  allowClear?: boolean
  description: string
  readOnly?: boolean
  validate?: (value: string) => string | null
}) {
  return (
    <PropertyRow
      icon={<Calendar />}
      label={label}
      value={formatDueDate(value)}
      showEmpty
      editValue={value || ""}
      saveOnEnter={false}
      editorLayout="stacked"
      onCommit={onCommit}
      readOnly={readOnly}
      validate={validate}
      renderEditor={(draft, setDraft) => (
        <div className="grid min-w-0 gap-2">
          <Label htmlFor={id} className="sr-only">{label}</Label>
          <DatePicker
            id={id}
            aria-describedby={`${id}-description`}
            date={isDateOnly(draft) ? new Date(`${draft}T12:00:00`) : undefined}
            setDate={(next) => setDraft(format(next, "yyyy-MM-dd"))}
            placeholder={`Select ${label.toLowerCase()}`}
            trigger={(
              <Button
                id={id}
                aria-describedby={`${id}-description`}
                type="button"
                variant="outline"
                className="h-8 w-full min-w-0 justify-start gap-2 rounded-md px-2 font-normal"
                title={isDateOnly(draft) ? formatDueDate(draft) : undefined}
              >
                <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-left text-xs">
                  {isDateOnly(draft) ? formatDueDate(draft) : `Select ${label.toLowerCase()}`}
                </span>
                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              </Button>
            )}
          />
          {allowClear && draft ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 justify-start px-2"
              aria-label={`Clear ${label.toLowerCase()}`}
              onClick={() => setDraft("")}
            >
              Clear
            </Button>
          ) : null}
          <p id={`${id}-description`} className="text-xs text-muted-foreground">{description}</p>
        </div>
      )}
    />
  )
}