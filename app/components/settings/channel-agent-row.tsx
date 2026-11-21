"use client"

import Link from "next/link"
import { useId, useState } from "react"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { Bot, Pencil } from "@/app/components/ui/icons"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { NativeSelect } from "@/app/components/ui/native-select"
import { servingChannelAgentId, useChannelAgentAssignments } from "./channel-agent-assignments-provider"
import { AgentLoadingRegion } from "@/app/components/agents/agent-loading-region"
import { ChannelAgentRowShape } from "@/app/components/agents/channel-skeletons"

type Props = { connectionId?: string; type?: string; label: string; profileAgentId?: string }
type Model = NonNullable<ReturnType<typeof useChannelAgentAssignments>>

export function ChannelAgentRow(props: Props) {
  const model = useChannelAgentAssignments()
  if (!model) return null
  return <div role="group" aria-label={props.label}>
    {!model.data && !model.failed
      ? <AgentLoadingRegion><ChannelAgentRowShape profile={!!props.profileAgentId} /></AgentLoadingRegion>
      : <AgentRow {...props} model={model} />}
  </div>
}

function AgentRow({ connectionId, type, label, profileAgentId, model }: Props & { model: Model }) {
  const { t } = useLocalization()
  const tx = (key: string) => t(`settings.channelAgent.${key}`)
  const { data } = model
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<"conflict" | "saveError" | null>(null)
  const selectId = useId()
  const assignment = data?.assignments.find(item => item.connectionId === connectionId)
  const voice = type === "voice"
  const sms = type === "sms"
  const sameTransport = !data?.connections || data.connections.some(c => c.id === connectionId && c.type === type)
  const actualId = sameTransport ? servingChannelAgentId(data, connectionId, type) : null
  const actual = actualId ? data?.agents.find(agent => agent.id === actualId) : undefined
  const selected = assignment?.agentId ? data?.agents.find(agent => agent.id === assignment.agentId) : undefined
  const suggestedAgent = profileAgentId !== assignment?.agentId ? data?.agents.find(agent => agent.id === profileAgentId && agent.status === 'active') : undefined
  const currentRevision = assignment?.revision || 0
  const stale = open && currentRevision !== revision
  const persisted = !!connectionId && data?.connectionIds.includes(connectionId) && sameTransport
  const canChange = !!(data?.canManage && data.assignmentsAvailable !== false && persisted)
  const eligibleDraft = !draft || data?.agents.some(agent => agent.id === draft && agent.status === 'active')
  const name = (agent: NonNullable<typeof actual>) => `${agent.name || agent.role || agent.id}${agent.status !== "active" ? ` · ${tx("inactive")}` : ""}`
  const edit = (id: string, caption: string) => <Button asChild variant="outline" size="sm">
    <Link href={`/agents/${id}`} prefetch={false}><Pencil size={14} aria-hidden className="mr-1.5" />{caption}</Link>
  </Button>

  function reviewLatest() {
    setDraft(assignment?.agentId || "")
    setRevision(currentRevision)
    setError(null)
  }

  async function save() {
    if (!connectionId || busy || stale || !canChange || !eligibleDraft) return
    setBusy(true)
    setError(null)
    const result = await model.save({ connectionId, agentId: draft || null, expectedRevision: revision })
    setBusy(false)
    if (result !== "saved") { setError(result === "conflict" ? "conflict" : "saveError"); return }
    setOpen(false)
    toast.success(tx("saved"))
  }

  return <div className="mx-5 mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3 text-sm">
    <div className="flex min-w-0 items-start gap-2">
      <Bot size={16} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 space-y-1">
        <div className="break-words"><span className="text-muted-foreground">{tx(voice ? "voice" : "serving")}: </span>
          <span className="font-medium">{model.failed ? tx("failed") : !data ? t("common.loading") : sms ? tx("noReplies") : actual ? name(actual) : tx("unknown")}</span>
          {actual && !voice && !sms && <span className="ml-2 text-xs text-muted-foreground">{tx("default")}</span>}
        </div>
        {assignment?.agentId && <p className="break-words text-xs text-muted-foreground">
          {tx("planned")}: <span className="font-medium text-foreground">{selected ? name(selected) : tx("unavailable")}</span>
          {assignment.agentId !== actualId && <> · {tx("pending")}</>}
        </p>}
        {data?.assignmentsAvailable === false && <p className="text-xs text-muted-foreground">{tx("migration")}</p>}
        {data && !persisted && <p className="text-xs text-muted-foreground">{tx("draft")}</p>}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {!profileAgentId && (actual ? edit(actual.id, tx("edit")) : <Button variant="outline" type="button" size="sm" disabled>{tx("edit")}</Button>)}
      {!profileAgentId && selected && selected.id !== actualId && edit(selected.id, tx("editSaved"))}
      {model.failed && <Button type="button" variant="outline" size="sm" onClick={model.reload}>{t("common.retry")}</Button>}
      <Dialog open={open} onOpenChange={next => {
        if (busy) return
        if (next) {
          reviewLatest()
          if (suggestedAgent) setDraft(suggestedAgent.id)
        }
        setOpen(next)
      }}>
        <DialogTrigger asChild><Button type="button" variant="outline" size="sm"
          disabled={!canChange}>{suggestedAgent ? t("settings.agentChannels.assignHere") : tx("change")}</Button></DialogTrigger>
        <DialogContent size="sm" busy={busy}>
          <DialogHeader>
            <DialogTitle>{t("settings.channelAgent.dialog", { channel: label })}</DialogTitle>
            <DialogDescription>{tx("notice")}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-2">
            {profileAgentId && assignment?.agentId && <p className="text-sm text-muted-foreground">{tx("planned")}: {selected ? name(selected) : tx("unavailable")}</p>}
            <label htmlFor={selectId} className="text-sm font-medium">{tx("choice")}</label>
            <NativeSelect id={selectId} value={draft} disabled={busy || !canChange || stale}
              onChange={event => { setDraft(event.target.value); setError(null) }} className="bg-background text-foreground dark:border-input dark:bg-background">
              <option value="">{tx("default")}</option>
              {draft && !data?.agents.some(a => a.id === draft) && <option value={draft} disabled>{tx("unavailable")}</option>}
              {data?.agents.map(agent => <option key={agent.id} value={agent.id} disabled={agent.status !== "active"}>
                {name(agent)}{agent.role && agent.name !== agent.role ? ` — ${agent.role}` : ""}
              </option>)}
            </NativeSelect>
            {(error || stale) && <div role="alert" className="space-y-2 text-sm text-destructive">
              <p>{tx(stale || error === "conflict" ? "conflict" : "saveError")}</p>
              <Button variant="outline" type="button" size="sm" onClick={() => { if (!data) model.reload(); reviewLatest() }}>{t("common.retry")}</Button>
            </div>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="button" variant="outline" data-permission="update" onClick={save} disabled={busy || !!error || stale || !canChange || !eligibleDraft || draft === (assignment?.agentId || "")}>
              {t(busy ? "common.saving" : "common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </div>
}