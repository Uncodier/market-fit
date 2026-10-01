"use client"

import { useFormContext } from "react-hook-form"
import { ACTIVITY_START_TIME_ERROR, activityTimeErrors, displayedActivityTimeMode, isValidActivityStartTime, type TimedActivityKey } from "@/lib/activity-start-time"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Input } from "../ui/input"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import type { SiteFormValues } from "./form-schema"

type Props = {
  activityKey: TimedActivityKey
  timezone?: string
}

export function ActivityStartTimeField({ activityKey, timezone }: Props) {
  const form = useFormContext<SiteFormValues>()
  const path = `activities.${activityKey}.start_time` as const
  const modePath = `activities.${activityKey}.start_time_mode` as const
  // Controller retains its initial default when a later site has no value.
  // Watch the current form snapshot instead so an omitted time clears the display.
  const value = form.watch(path)
  const savedMode = form.watch(modePath)
  const mode = displayedActivityTimeMode({ start_time_mode: savedMode, start_time: value })
  const modeError = activityTimeErrors({ start_time_mode: savedMode, start_time: value }).find(error => error.field === "start_time_mode")
  const label = activityKey === "daily_resume_and_stand_up" ? "Standup" : activityKey === "leads_follow_up" ? "Follow-up" : "Cold outreach"
  return <div className="space-y-3">
    <FormField control={form.control} name={modePath} render={({ field }) => <FormItem>
      <FormLabel>{label} execution time</FormLabel>
      <Select value={mode} onValueChange={field.onChange}>
        <FormControl><SelectTrigger ref={field.ref} onBlur={field.onBlur} className="max-w-xs" aria-invalid={!!modeError}>
          <SelectValue placeholder="Choose execution time" />
        </SelectTrigger></FormControl>
        <SelectContent>
          <SelectItem value="business_opening">Business opening time</SelectItem>
          <SelectItem value="custom">Custom time</SelectItem>
        </SelectContent>
      </Select>
      <FormDescription>
        {timezone ? `Schedule timezone: ${timezone}.` : "Schedule uses the site's business-hours timezone, or America/Mexico_City if none is configured."}
        {" "}Business opening time uses each day&apos;s opening, or 09:00 if unavailable, and skips explicitly closed days.
        {activityKey === "leads_initial_cold_outreach" && " Cold outreach follows business operating days in either mode; missing days use Monday–Friday."}
      </FormDescription>
      {modeError && <p role="alert" className="text-sm text-destructive">{modeError.message}</p>}
      <FormMessage />
    </FormItem>} />
    {mode === "custom" && <FormField control={form.control} name={path} render={({ field }) => {
    const invalid = value !== undefined && !isValidActivityStartTime(value)
    return <FormItem>
      <FormLabel>{label} start time</FormLabel>
        <FormControl><Input {...field} type="time" step={60} required className="max-w-40"
          value={typeof value === "string" ? value : ""} aria-invalid={invalid}
          onChange={event => field.onChange(event.target.value)} /></FormControl>
      <FormDescription>What time should this activity run? Enter a time in 24-hour format.</FormDescription>
      {invalid && <p role="alert" className="text-sm text-destructive">{ACTIVITY_START_TIME_ERROR}</p>}
      <FormMessage />
    </FormItem>
  }} />}
  </div>
}