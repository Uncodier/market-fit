"use client"

import { useId } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Progress } from "../ui/progress"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import type { SiteFormValues } from "./form-schema"
import { ICP_LIST_IDS_MAX, normalizeIcpLeadGenerationSettings } from "./icp-lead-generation-settings"
import { useIcpMiningLists } from "./use-icp-mining-lists"

export function IcpMiningListSelector({ siteId }: { siteId?: string }) {
  const form = useFormContext<SiteFormValues>()
  const { lists, loading, error, retry } = useIcpMiningLists(siteId)
  const value = normalizeIcpLeadGenerationSettings(useWatch({ control: form.control, name: "activities.icp_lead_generation" }))
  const allLists = value.all_lists === true
  const selected = Array.isArray(value.list_ids) ? value.list_ids.filter(id => typeof id === "string") : []
  const availableIds = new Set(lists.map(list => list.id))
  const missingIds = selected.filter(id => !availableIds.has(id))
  const loaded = !!siteId && !loading && !error
  const labelPrefix = useId()

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">Mining lists</legend>
      <FormField control={form.control} name="activities.icp_lead_generation.all_lists" render={({ field }) => (
        <FormItem>
          <div className="flex items-center gap-2">
            <FormControl><Checkbox checked={allLists} onCheckedChange={checked => field.onChange(checked === true)} /></FormControl>
            <FormLabel>All pending lists</FormLabel>
          </div>
          <FormDescription>Use all pending lists on this site, including future lists, and resume running lists. Turn off to use only the lists selected below.</FormDescription>
          <FormMessage />
        </FormItem>
      )} />
      {allLists
        ? <p className="text-sm text-muted-foreground">All eligible lists are included dynamically. Saved individual selections are retained but not used in this mode.</p>
        : <p role="status" className="text-sm text-muted-foreground">{selected.length === 0
          ? "No lists selected — no mining work will run. Other lists will never be used as a fallback."
          : `${selected.length} lists selected. Only selected pending or running lists will be used; unavailable lists are ignored without fallback.`}</p>}
      {!siteId && <p className="text-sm text-muted-foreground">Select a site to view its mining lists.</p>}
      {loading && <p role="status" className="text-sm text-muted-foreground">Loading pending mining lists...</p>}
      {error && <div role="alert" className="text-sm text-destructive">{error} <Button type="button" variant="outline" size="sm" onClick={retry}>Retry lists</Button></div>}
      {loaded && <>
        {!lists.length && <p className="text-sm text-muted-foreground">This site has no pending or running mining lists.</p>}
        <Button type="button" variant="outline" size="sm" onClick={retry}>Refresh lists</Button>
      </>}
      <FormField control={form.control} name="activities.icp_lead_generation.list_ids" render={({ field }) => (
        <FormItem>
          <FormControl>
            <div role="group" aria-label="Individual mining lists" className="max-h-72 overflow-y-auto space-y-3">
              {lists.map(list => {
                const name = list.name?.trim() || `List ${list.id}`
                const checked = selected.includes(list.id)
                const rawProgress = list.progress_percent == null ? NaN : Number(list.progress_percent)
                const progress = Number.isFinite(rawProgress) ? Math.max(0, Math.min(100, rawProgress)) : null
                const labelId = `${labelPrefix}-${list.id}`
                return <div key={list.id} className="rounded-md border p-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox aria-labelledby={labelId} checked={allLists || checked}
                      disabled={allLists || (!checked && selected.length >= ICP_LIST_IDS_MAX)}
                      onCheckedChange={next => field.onChange(next === true ? [...selected, list.id] : selected.filter(id => id !== list.id))} />
                    <span id={labelId} className="break-all">{name}</span>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {list.status === "running" ? "Running — resumable" : "Pending"}
                    {` · ${list.processed_targets ?? 0} / ${list.total_targets ?? 0} targets processed · ${progress === null ? "Progress unavailable" : `${progress}%`}`}
                  </p>
                  <Progress value={progress} aria-label={`${name} progress`} aria-valuenow={progress ?? undefined} className="h-1.5" />
                </div>
              })}
              {missingIds.map(id => <div key={id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="break-all">{loaded ? "Unavailable list" : "Saved list"} ({id}) — {loaded ? "completed, deleted, or no longer available on this site" : "availability not verified"}</span>
                <Button type="button" size="sm" variant="ghost" aria-label={`Remove list ${id}`}
                  onClick={() => field.onChange(selected.filter(item => item !== id))}>Remove list</Button>
              </div>)}
            </div>
          </FormControl>
          <FormDescription>Select up to 1,000 lists. Completed or deleted selections remain saved until you remove them.</FormDescription>
          <FormMessage />
        </FormItem>
      )} />
      {!allLists && loaded && selected.length > 0 && !selected.some(id => availableIds.has(id)) &&
        <p role="status" className="text-sm text-muted-foreground">None of the selected lists are currently available — no mining work will run. Other lists will never be used as a fallback.</p>}
      {!allLists && selected.length >= ICP_LIST_IDS_MAX && <p className="text-sm text-muted-foreground">Selection limit reached. Remove a list before adding another.</p>}
    </fieldset>
  )
}