"use client"

import { useState } from "react"
import { useSWRConfig } from "swr"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { useAutomationSnooze } from "@/app/hooks/useAutomationSnooze"
import { updateConversationAutomationSnooze } from "@/app/chat/automation-snooze-actions"
import { AutomationPausedBadge } from "./AutomationPausedBadge"
import {
  DEFAULT_AUTOMATION_SNOOZE_HOURS,
  MAX_AUTOMATION_SNOOZE_HOURS,
  isAutomationPaused,
  type AutomationSnoozeMutation,
  type AutomationSnoozeState,
} from "@/lib/chat/automation-snooze"

function SnoozeSettings({ state, busy, onSave }: {
  state: AutomationSnoozeState
  busy: boolean
  onSave: (input: AutomationSnoozeMutation) => Promise<void>
}) {
  const [hours, setHours] = useState(state.automation_snooze_hours?.toString() ?? "")
  const value = hours.trim() === "" ? null : Number(hours)
  const valid = value === null || (Number.isFinite(value) && value >= 0 && value <= MAX_AUTOMATION_SNOOZE_HOURS)
  return (
    <form className="space-y-3" onSubmit={event => {
      event.preventDefault()
      if (valid && !busy) void onSave({ action: "settings", hours: value })
    }}>
      <Label htmlFor="automation-snooze-hours">Pause after a human reply (hours)</Label>
      <Input id="automation-snooze-hours" type="number" min={0} max={MAX_AUTOMATION_SNOOZE_HOURS}
        step="any" placeholder={`Default (${DEFAULT_AUTOMATION_SNOOZE_HOURS} hours)`} value={hours}
        onChange={event => setHours(event.target.value)} disabled={busy}
        aria-describedby="automation-snooze-help" aria-invalid={!valid} />
      <p id="automation-snooze-help" className="text-xs text-muted-foreground">
        Leave empty for the 4-hour default. Use 0 to disable and resume now, or up to 168 hours.
        Other changes apply to future human replies. Assignment stays unchanged.
      </p>
      {!valid && <p role="alert" className="text-xs text-destructive">Enter a number from 0 to 168.</p>}
      <Button type="submit" size="sm" disabled={busy || !valid}>{busy ? "Saving…" : "Save hours"}</Button>
    </form>
  )
}

export function AutomationSnoozeControls({ conversationId, siteId }: { conversationId: string; siteId: string }) {
  const { user } = useAuthContext()
  const { data, error, isLoading, mutate } = useAutomationSnooze(conversationId, siteId, user?.id)
  const { mutate: mutateCache } = useSWRConfig()
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const save = async (input: AutomationSnoozeMutation) => {
    if (busy) return
    setBusy(true)
    setSaveError(null)
    try {
      const response = await updateConversationAutomationSnooze(conversationId, siteId, input)
      if (response.error) {
        setSaveError(response.error)
        void mutate()
        return
      }
      // Revalidate authoritative state rather than overwriting a newer realtime event.
      await mutate()
      await mutateCache(key => Array.isArray(key) && key[0] === "conversations" && key[1] === siteId)
    } catch {
      setSaveError("Unable to confirm the change. Refresh and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 shrink-0 max-w-[45%] ml-2">
      {data && <AutomationPausedBadge until={data.automation_paused_until} />}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-1 text-xs" aria-label="Automation snooze settings">Automation snooze</Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-3">
          <h3 className="font-medium">Automation snooze</h3>
          {isLoading && <Skeleton className="h-24 w-full" aria-label="Loading automation snooze" />}
          {error && <div role="alert" className="text-sm text-destructive">
            Unable to load automation snooze. <Button variant="link" size="sm" onClick={() => void mutate()}>Retry</Button>
          </div>}
          {data && <>
            <p className="text-xs text-muted-foreground">
              {isAutomationPaused(data.automation_paused_until) ? "Automatic replies are paused." :
                data.automation_snooze_hours === 0 ? "Automatic snooze is disabled." : "No active snooze."}
            </p>
            <AutomationPausedBadge until={data.automation_paused_until} />
            {data.last_human_reply_at && <p className="text-xs text-muted-foreground">
              Last human reply: <time dateTime={data.last_human_reply_at}>
                {new Date(data.last_human_reply_at).toLocaleString()}
              </time>
            </p>}
            {data.automation_paused_until && isAutomationPaused(data.automation_paused_until) && (
              <Button size="sm" variant="outline" disabled={busy || !!error} onClick={() => void save({
                action: "resume", expectedPausedUntil: data.automation_paused_until!,
              })}>Resume now</Button>
            )}
            <SnoozeSettings key={`${conversationId}:${data.automation_snooze_hours}`} state={data}
              busy={busy || !!error} onSave={save} />
          </>}
          {saveError && <p role="alert" className="text-xs text-destructive">{saveError}</p>}
        </PopoverContent>
      </Popover>
    </div>
  )
}