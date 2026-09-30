"use client"

import { useFormContext } from "react-hook-form"
import { Checkbox } from "../ui/checkbox"
import { Input } from "../ui/input"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import type { SiteFormValues } from "./form-schema"
import { ICP_TARGET_LEADS_MAX } from "./icp-lead-generation-settings"
import { IcpMiningListSelector } from "./IcpMiningListSelector"

export function IcpLeadGenerationFields({ siteId }: { siteId?: string }) {
  const form = useFormContext<SiteFormValues>()
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        ICP mining is always active, independently of Leads Follow Up and channel health. No sending account is required to mine leads. Mining does not send outreach messages.
      </p>
      <IcpMiningListSelector siteId={siteId} />
      <FormField control={form.control} name="activities.icp_lead_generation.target_leads" render={({ field }) => (
        <FormItem>
          <FormLabel>Target leads per run</FormLabel>
          <FormControl>
            <Input {...field} type="number" min={1} max={ICP_TARGET_LEADS_MAX} step={1} className="max-w-40"
              value={Number.isFinite(field.value) ? field.value : ""}
              onChange={event => field.onChange(event.target.value === "" ? NaN : Number(event.target.value))} />
          </FormControl>
          <FormDescription>1–3,000 found leads per run (default 150). This targets leads found and enriched, not candidates scanned or a guaranteed number of new leads.</FormDescription>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="activities.icp_lead_generation.research_enabled" render={({ field }) => (
        <FormItem>
          <div className="flex items-center gap-2">
            <FormControl><Checkbox checked={field.value === true} onCheckedChange={checked => field.onChange(checked === true)} /></FormControl>
            <FormLabel>Additional deep research</FormLabel>
          </div>
          <FormDescription>Run additional deep research on found leads. Off by default.</FormDescription>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  )
}