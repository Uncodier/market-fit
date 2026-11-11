"use client"

import { useFormContext } from "react-hook-form"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import type { SiteFormValues } from "./form-schema"

export function AutomationSnoozeFields() {
  const form = useFormContext<SiteFormValues>()
  return <div className="mt-4 space-y-2">
    <FormField control={form.control} name="activities.conversation_automation_snooze.hours" render={({ field }) => (
      <FormItem>
        <FormLabel>Pause after a human reply (hours)</FormLabel>
        <FormControl><Input type="number" min="0" max="168" step="any" {...field}
          value={Number.isFinite(field.value) ? field.value : ""}
          onChange={event => field.onChange(event.target.value === "" ? NaN : Number(event.target.value))} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
    <p className="text-sm text-muted-foreground">Default: 4 hours. Enter more than 0 and up to 168 hours. Lead overrides take priority. Changes apply to future human replies only; existing pauses keep their expiry. Resume individual threads from the lead menu.</p>
  </div>
}