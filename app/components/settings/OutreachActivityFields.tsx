"use client"

import { useFormContext } from "react-hook-form"
import { Checkbox } from "../ui/checkbox"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import { isOutreachChannel, normalizeOutreachSettings, type OutreachActivityKey, type OutreachAccount } from "@/lib/outreach-settings"
import { getOutreachChannelLabel } from "./outreach-accounts"
import type { SiteFormValues } from "./form-schema"
import type { OutreachSegment } from "./outreach-segments"
import { ActivityStartTimeField } from "./ActivityStartTimeField"

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
type Props = {
  activityKey: OutreachActivityKey
  accounts: OutreachAccount[]
  segments: OutreachSegment[]
  loading: boolean
  error: string
  retry: () => void
  timezone?: string
}

export function OutreachActivityFields({ activityKey, accounts, segments, loading, error, retry, timezone }: Props) {
  const form = useFormContext<SiteFormValues>()
  const path = `activities.${activityKey}` as const
  const value = normalizeOutreachSettings(form.watch(path))
  const toggle = <T,>(items: T[], item: T) => items.includes(item) ? items.filter(existing => existing !== item) : [...items, item]
  const unavailableSegments = value.segment_ids.filter(id => !segments.some(segment => segment.id === id))
  const channels = [...new Set([...Object.keys(value.channel_accounts), ...accounts.map(account => account.channel)])].filter(isOutreachChannel)

  return (
    <div className="space-y-6 mt-6 border-t pt-6">
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Sending accounts</h4>
        <p className="text-sm text-muted-foreground">Select connected, usable agent accounts from any channel, including configured direct accounts. Select multiple accounts per channel. No selection disables that channel; no other account is used as a fallback.</p>
        <p className="text-sm text-muted-foreground">Audio is a message format supported by applicable messaging channels, not a separate account or channel.</p>
        {channels.map(channel => {
          const options = accounts.filter(account => account.channel === channel)
          const selected = value.channel_accounts[channel] || []
          const unavailable = selected.filter(id => !options.some(account => account.id === id))
          return (
            <fieldset key={channel} className="space-y-2 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">{getOutreachChannelLabel(channel)} accounts</legend>
              {channel === "voice" && <p className="text-sm text-muted-foreground">Voice calls require the contact&apos;s explicit consent before outreach. Selecting a voice account does not grant consent.</p>}
              {!options.length && <p className="text-sm text-muted-foreground">No usable connected accounts. Connect and save an account in Channels first.</p>}
              {options.map(account => (
                <label key={account.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selected.includes(account.id)} onCheckedChange={() => form.setValue(`${path}.channel_accounts.${channel}`, toggle(selected, account.id), { shouldDirty: true })} />
                  {account.label}
                </label>
              ))}
              {!selected.some(id => options.some(account => account.id === id)) && <p className="text-xs text-muted-foreground">No usable account selected — this channel is disabled.</p>}
              {unavailable.map(id => <div key={id} className="flex items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-400">
                <span>Previously selected account is unavailable ({id}). It will not send.</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => form.setValue(`${path}.channel_accounts.${channel}`, selected.filter(item => item !== id), { shouldDirty: true })}>Remove</Button>
              </div>)}
            </fieldset>
          )
        })}
      </div>
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Target segments</h4>
        <FormField control={form.control} name={`${path}.all_segments`} render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl><Checkbox checked={field.value} onCheckedChange={checked => field.onChange(checked === true)} /></FormControl>
            <FormLabel>All segments (all eligible leads on this site)</FormLabel>
          </FormItem>
        )} />
        <p className="text-sm text-muted-foreground">No segments selected means no leads are targeted unless All segments is explicitly enabled.</p>
        {loading && <p role="status" className="text-sm">Loading this site's segments…</p>}
        {error && <div role="alert" className="text-sm text-destructive">{error} <Button type="button" variant="ghost" size="sm" onClick={retry}>Retry</Button></div>}
        {!loading && !error && !segments.length && <p className="text-sm text-muted-foreground">This site has no segments yet.</p>}
        <div className="max-h-56 overflow-y-auto space-y-2">
          {segments.map(segment => <label key={segment.id} className="flex items-center gap-2 text-sm">
            <Checkbox disabled={value.all_segments} checked={value.segment_ids.includes(segment.id)} onCheckedChange={() => form.setValue(`${path}.segment_ids`, toggle(value.segment_ids, segment.id), { shouldDirty: true })} />
            {segment.name}
          </label>)}
        </div>
        {!loading && !error && unavailableSegments.length > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">Some previously selected segments are no longer available on this site. They will not target leads.</p>}
        {!loading && !error && unavailableSegments.map(id => <div key={id} className="flex items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-400">
          <span>Unavailable segment ({id})</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => form.setValue(`${path}.segment_ids`, value.segment_ids.filter(item => item !== id), { shouldDirty: true })}>Remove segment</Button>
        </div>)}
      </div>
      <FormField control={form.control} name={`${path}.daily_message_limit`} render={({ field }) => (
        <FormItem>
          <FormLabel>Daily message limit</FormLabel>
          <FormControl><Input {...field} type="number" min={1} max={10000} step={1} className="max-w-40" value={Number.isFinite(field.value) ? field.value : ""} onChange={event => field.onChange(event.target.value === "" ? NaN : Number(event.target.value))} /></FormControl>
          <p className="text-sm text-muted-foreground">1–10,000 messages per day (default 30), shared across all selected accounts and channels for this activity.</p>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name={`${path}.max_unanswered_messages`} render={({ field }) => (
        <FormItem>
          <FormLabel>Maximum unanswered messages</FormLabel>
          <FormControl><Input {...field} type="number" min={1} max={100} step={1} className="max-w-40" value={Number.isFinite(field.value) ? field.value : ""} onChange={event => field.onChange(event.target.value === "" ? NaN : Number(event.target.value))} /></FormControl>
          <p className="text-sm text-muted-foreground">1–100 messages (default 3). Counts confirmed outreach messages across channels since the contact's last real reply; drafts, pending and failed messages do not count. After reaching this limit, the contact is marked cold on the next eligible check after the reply-wait period, not immediately after sending.</p>
          <FormMessage />
        </FormItem>
      )} />
      {activityKey === "leads_follow_up" && <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Follow-up weekdays</legend>
        <p className="text-sm text-muted-foreground">Default: Tuesday, Wednesday and Thursday. No days selected means no follow-ups.</p>
        <div className="flex flex-wrap gap-4">
          {WEEKDAYS.map((day, index) => <label key={day} className="flex items-center gap-2 text-sm">
            <Checkbox checked={value.weekdays.includes(index)} onCheckedChange={() => form.setValue(`${path}.weekdays`, toggle(value.weekdays, index).sort(), { shouldDirty: true })} />
            {day}
          </label>)}
        </div>
      </fieldset>}
      {activityKey === "leads_follow_up" && <ActivityStartTimeField activityKey={activityKey} timezone={timezone} />}
    </div>
  )
}