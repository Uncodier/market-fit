"use client"

import { useFormContext } from "react-hook-form"
import { Checkbox } from "../ui/checkbox"
import { FormField, FormItem, FormMessage } from "../ui/form"
import type { SiteFormValues } from "./form-schema"
import { DAILY_STANDUP_REPORT_SECTIONS, DAILY_STANDUP_WEEKDAYS, type DailyStandupReportSection } from "./daily-standup-settings"
import { ActivityStartTimeField } from "./ActivityStartTimeField"

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const SECTION_LABELS: Record<DailyStandupReportSection, string> = {
  sales: "Sales", tasks: "Tasks", requirements: "Requirements", social: "Social media",
  channels: "Channels", records: "Records", orders: "Orders", reservations: "Reservations", inventory: "Inventory",
}

function SelectionGroup<T extends string | number>({ title, description, options, selected, onChange }: {
  title: string
  description: string
  options: { value: T; label: string }[]
  selected: T[]
  onChange: (value: T[]) => void
}) {
  return <fieldset className="space-y-3">
    <legend className="text-sm font-semibold">{title}</legend>
    <p className="text-sm text-muted-foreground">{description}</p>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {options.map(option => <label key={option.value} className="flex items-center gap-2 text-sm">
        <Checkbox checked={selected.includes(option.value)} onCheckedChange={checked => {
          const next = checked === true ? [...selected, option.value] : selected.filter(value => value !== option.value)
          onChange(options.filter(item => next.includes(item.value)).map(item => item.value))
        }} />
        {option.label}
      </label>)}
    </div>
    <FormMessage />
  </fieldset>
}

export function DailyStandupFields({ timezone }: { timezone?: string }) {
  const form = useFormContext<SiteFormValues>()
  return <div className="mt-6 space-y-6 border-t pt-6">
    <FormField control={form.control} name="activities.daily_resume_and_stand_up.weekdays" render={({ field }) => (
      <FormItem>
        <SelectionGroup title="Standup weekdays" description="Default: Monday and Friday. Runs on selected days in the site's timezone, including closed days. Choose a start time below or keep the legacy opening-time schedule. An active standup needs at least one day."
          options={WEEKDAYS.map((label, value) => ({ label, value }))}
          selected={field.value === undefined ? DAILY_STANDUP_WEEKDAYS : Array.isArray(field.value) ? field.value : []}
          onChange={field.onChange} />
      </FormItem>
    )} />
    <ActivityStartTimeField activityKey="daily_resume_and_stand_up" timezone={timezone} />
    <FormField control={form.control} name="activities.daily_resume_and_stand_up.report_sections" render={({ field }) => (
      <FormItem>
        <SelectionGroup title="Report sections" description="Choose what the report includes. All sections are selected by default. An active standup needs at least one section."
          options={DAILY_STANDUP_REPORT_SECTIONS.map(value => ({ value, label: SECTION_LABELS[value] }))}
          selected={field.value === undefined ? [...DAILY_STANDUP_REPORT_SECTIONS] : Array.isArray(field.value) ? field.value : []}
          onChange={field.onChange} />
      </FormItem>
    )} />
  </div>
}