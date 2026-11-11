"use client"

import { useEffect, useId, useState, useTransition } from "react"
import { useSWRConfig } from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { AutomationPausedBadge } from "@/app/components/chat/AutomationPausedBadge"
import { isAutomationPaused } from "@/lib/chat/automation-snooze"
import { updateConversationAutomationSnooze } from "@/app/chat/automation-snooze-actions"
import { updateLeadAutomationSnooze } from "../automation-snooze-actions"
import { useLeadAutomationSnooze } from "./use-lead-automation-snooze"

type Props = { leadId: string; leadName: string; open: boolean; onOpenChange: (open: boolean) => void }

export function LeadAutomationSnoozeDialog(props: Props) {
  const { currentSite } = useSite()
  const { user } = useAuthContext()
  const permissions = useOptionalPermissions()
  const siteId = currentSite?.id ?? ""
  if (!props.open) return null
  return <SnoozeSession key={`${siteId}:${props.leadId}:${user?.id}`} {...props} siteId={siteId} userId={user?.id}
    canUpdate={!!user && !!siteId && !siteId.startsWith("demo-") && (permissions?.can("update") ?? true)} />
}

function SnoozeSession({ leadId, leadName, onOpenChange, siteId, userId, canUpdate }: Props & { siteId: string; userId?: string; canUpdate: boolean }) {
  const { data, error, isLoading, mutate } = useLeadAutomationSnooze(leadId, siteId, userId)
  const { mutate: mutateCache } = useSWRConfig()
  const [busy, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [])

  const run = (operation: () => Promise<{ error?: string }>) => {
    if (busy || !canUpdate) return
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await operation()
        setMessage(result.error ?? "Saved.")
        await mutate()
        if (!result.error) await mutateCache(key => Array.isArray(key) && (
          (key[0] === "conversations" && key[1] === siteId) || (key[0] === "automation-snooze" && key[2] === siteId)))
      } catch {
        setMessage("Unable to confirm the change. Reload before trying again.")
        void mutate()
      }
    })
  }

  return <Dialog open onOpenChange={next => { if (!busy) onOpenChange(next) }}>
    <DialogContent busy={busy} onClick={event => event.stopPropagation()}>
      <DialogHeader>
        <DialogTitle>Automation Snooze</DialogTitle>
        <DialogDescription>Configure future human replies for {leadName}. Existing pauses keep their expiry, even when switched off. Resume each thread separately below.</DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        {!siteId || !userId || siteId.startsWith("demo-") ? <p role="alert">Select an authenticated site to manage automation snooze.</p> : <>
          {isLoading && <p role="status">Loading automation snooze…</p>}
          {error && <div role="alert">Unable to load automation snooze. <Button variant="link" disabled={busy} onClick={() => void mutate()}>Retry</Button></div>}
          {data && <>
            <p className="text-sm">Effective setting: {data.effectiveHours === 0 ? "Off" : `${data.effectiveHours} hours after a human reply`}.</p>
            <SnoozeOptions key={String(data.hours)} hours={data.hours} siteHours={data.siteHours} disabled={busy || !canUpdate || !!error}
              onSave={hours => run(() => updateLeadAutomationSnooze(leadId, siteId, hours))} />
            <h3 className="font-medium">Conversation pauses</h3>
            {!data.conversations.length && <p className="text-sm text-muted-foreground">No conversations for this lead yet.</p>}
            {data.conversations.map((thread, index) => <div key={thread.id} className="rounded-md border p-3 space-y-2">
              <a href={`/chat?conversationId=${thread.id}`} className="text-sm underline">Conversation {index + 1}</a>
              <div><AutomationPausedBadge until={thread.automation_paused_until} /></div>
              {!isAutomationPaused(thread.automation_paused_until, now) && <p className="text-sm text-muted-foreground">No active pause.</p>}
              {thread.last_human_reply_at && <p className="text-xs text-muted-foreground">Last human reply: <time dateTime={thread.last_human_reply_at}>{new Date(thread.last_human_reply_at).toLocaleString()}</time></p>}
              {isAutomationPaused(thread.automation_paused_until, now) && <Button size="sm" variant="outline" disabled={busy || !canUpdate || !!error}
                onClick={() => run(() => updateConversationAutomationSnooze(thread.id, siteId, {
                  action: "resume", expectedPausedUntil: thread.automation_paused_until!, expectedLastHumanReplyAt: thread.last_human_reply_at,
                }))}>Resume now</Button>}
            </div>)}
          </>}
          {!canUpdate && <p className="text-sm text-muted-foreground">You do not have permission to change automation snooze.</p>}
          {message && <p role={message === "Saved." ? "status" : "alert"}>{message}</p>}
        </>}
      </DialogBody>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}

function SnoozeOptions({ hours, siteHours, disabled, onSave }: { hours: number | null; siteHours: number; disabled: boolean; onSave: (hours: number | null) => void }) {
  const id = useId()
  const [mode, setMode] = useState(hours === null ? "inherit" : hours === 0 ? "off" : "custom")
  const [custom, setCustom] = useState(String(hours || siteHours || 4))
  const valid = mode !== "custom" || (custom.trim() !== "" && Number.isFinite(Number(custom)) && Number(custom) > 0 && Number(custom) <= 168)
  return <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (valid && !disabled) onSave(mode === "inherit" ? null : mode === "off" ? 0 : Number(custom)) }}>
    <RadioGroup value={mode} onValueChange={setMode} disabled={disabled} aria-label="Lead automation snooze">
      {[["inherit", `Inherit site setting (${siteHours === 0 ? "Off" : `${siteHours} hours`})`], ["off", "Off for this lead"], ["custom", "Custom hours"]].map(([value, label]) => <div className="flex items-center gap-2" key={value}>
        <RadioGroupItem value={value} id={`${id}-${value}`} /><Label htmlFor={`${id}-${value}`}>{label}</Label>
      </div>)}
    </RadioGroup>
    {mode === "custom" && <div>
      <Label htmlFor={`${id}-hours`}>Pause after a human reply (hours)</Label>
      <Input id={`${id}-hours`} type="number" min="0" max="168" step="any" value={custom} disabled={disabled}
        aria-invalid={!valid} onChange={event => setCustom(event.target.value)} />
      {!valid && <p role="alert">Enter hours greater than 0 and up to 168.</p>}
    </div>}
    <Button type="submit" size="sm" disabled={disabled || !valid}>Save setting</Button>
  </form>
}