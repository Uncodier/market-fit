"use client"

import { Input } from "@/app/components/ui/input"
import { CalendarDays } from "./custom-icons"
import { PropertyRow, hasPropertyValue } from "./PropertyRow"
import { displayBirthday, getBirthdayDraft, getBirthdayError, serializeBirthday, type BirthdayDraft } from "./birthday-date"

interface BirthdayFieldProps {
  value: string | null
  showEmpty: boolean
  onCommit: (value: string | null) => Promise<void>
}

const fields = [
  { key: "day", label: "Day", placeholder: "DD", maxLength: 2 },
  { key: "month", label: "Month", placeholder: "MM", maxLength: 2 },
  { key: "year", label: "Year", placeholder: "YYYY", maxLength: 4 },
] as const

export function BirthdayField({ value, showEmpty, onCommit }: BirthdayFieldProps) {
  return (
    <PropertyRow<BirthdayDraft>
      icon={<CalendarDays size={14} />}
      label="Birthday"
      value={displayBirthday(value)}
      empty={!hasPropertyValue(value)}
      showEmpty={showEmpty}
      editValue={getBirthdayDraft(value)}
      validate={getBirthdayError}
      onCommit={(draft) => onCommit(serializeBirthday(draft))}
      renderEditor={(draft, setDraft) => (
        <div role="group" aria-label="Birthday date" className="grid grid-cols-[1fr_1fr_1.5fr] gap-1">
          {fields.map(({ key, label, placeholder, maxLength }) => (
            <label key={key} className="min-w-0">
              <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
              <Input
                aria-label={`Birthday ${key}`}
                value={draft[key]}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.value.replace(/\D/g, "").slice(0, maxLength) })}
                type="text"
                inputMode="numeric"
                maxLength={maxLength}
                placeholder={placeholder}
                autoComplete={key === "day" ? "bday-day" : key === "month" ? "bday-month" : "bday-year"}
                className="h-8 min-w-0 px-1 text-center text-sm"
              />
            </label>
          ))}
        </div>
      )}
    />
  )
}