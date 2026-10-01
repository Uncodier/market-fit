"use client"

import { useFormContext } from "react-hook-form"
import { ACTIVITY_START_TIME_ERROR, isValidActivityStartTime } from "@/lib/activity-start-time"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import type { SiteFormValues } from "./form-schema"

type Props = {
  activityKey: "daily_resume_and_stand_up" | "leads_follow_up"
  timezone?: string
}

export function ActivityStartTimeField({ activityKey, timezone }: Props) {
  const form = useFormContext<SiteFormValues>()
  const isStandup = activityKey === "daily_resume_and_stand_up"
  const path = `activities.${activityKey}.start_time` as const
  // Controller retains its initial default when a later site has no value.
  // Watch the current form snapshot instead so an omitted time clears the display.
  const value = form.watch(path)
  return <FormField control={form.control} name={path} render={({ field }) => {
    const invalid = value !== undefined && !isValidActivityStartTime(value)
    return <FormItem>
      <FormLabel>{isStandup ? "Standup start time" : "Follow-up start time"}</FormLabel>
      <div className="flex flex-wrap items-center gap-3">
        <FormControl><Input {...field} type="time" step={60} className="max-w-40"
          value={typeof value === "string" ? value : ""} aria-invalid={invalid}
          onChange={event => field.onChange(event.target.value)} /></FormControl>
        <Button type="button" variant="outline" size="sm" onClick={() => field.onChange("09:00")}>Use 09:00</Button>
      </div>
      <FormDescription>
        {timezone ? `Schedule timezone: ${timezone}.` : "Schedule uses the site's business-hours timezone, or America/Mexico_City if none is configured."}
        {" "}Optional, in HH:mm (24-hour format). When no time has been configured,
        {isStandup ? " runs at the configured opening time, or 09:00 if unavailable." : " runs at 09:00."}
        {" "}Once edited, enter a valid time or use 09:00 to save a fixed time. Clearing does not remove a saved time.
      </FormDescription>
      {invalid && <p role="alert" className="text-sm text-destructive">{ACTIVITY_START_TIME_ERROR}</p>}
      <FormMessage />
    </FormItem>
  }} />
}