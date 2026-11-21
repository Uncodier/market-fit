"use client"

import { useEffect, useRef, useState } from "react"
import { FormProvider, useForm, useWatch } from "react-hook-form"
import { v4 as uuid } from "uuid"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { PlusCircle } from "@/app/components/ui/icons"
import { SupportChannelsSection } from "@/app/components/settings/SupportChannelsSection"
import { useChannelAgentAssignments } from "@/app/components/settings/channel-agent-assignments-provider"
import type { SiteFormValues } from "@/app/components/settings/form-schema"
import { isActiveAgentChannel } from "@/lib/agent-channel-state"
import { isDemoModeActive, isRealSiteId } from "@/lib/demo-utils"

type Props = { siteId: string; agentId: string }
type Model = NonNullable<ReturnType<typeof useChannelAgentAssignments>>
type Connection = SiteFormValues["channels"]["connections"][number]

function canSetUp(data: Model["data"], agentId: string) {
  return data?.canManage && data.assignmentsAvailable !== false && data.connections &&
    data.agents.some(agent => agent.id === agentId && agent.status === "active")
}

function providerComplete(row: Connection | undefined, draftId: string) {
  if (!row || row.id !== draftId || !row.type || !row.zavu_sender_id || !isActiveAgentChannel(row)) return false
  if (row.metadata?.activation_pending === true || row.metadata?.provider_channel_active === false) return false
  return row.type !== "email" || row.metadata?.emailChannelActive === true
}

export function AgentChannelSetup({ siteId, agentId }: Props) {
  const model = useChannelAgentAssignments()
  const { currentSite } = useSite()
  if (!isRealSiteId(siteId) || isDemoModeActive() || currentSite?.id !== siteId || !model || !canSetUp(model.data, agentId)) return null
  return <SetupDialog key={`${siteId}:${agentId}`} siteId={siteId} agentId={agentId} model={model} />
}

function SetupDialog({ siteId, agentId, model }: Props & { model: Model }) {
  const { t } = useLocalization()
  const [draftId, setDraftId] = useState<string | null>(null)
  const close = () => setDraftId(null)
  const title = t("settings.agentChannels.setupAction")
  return <Dialog open={draftId !== null} onOpenChange={open => {
    if (!open) return close()
    const id = uuid()
    if (model.data?.connectionIds.includes(id)) { toast.error(t("settings.channelAgent.conflict")); return }
    setDraftId(id)
  }}>
    <DialogTrigger asChild><Button type="button" variant="outline" size="sm">
      <PlusCircle aria-hidden size={16} className="mr-1.5" />{title}
    </Button></DialogTrigger>
    {draftId && <DraftSetup key={draftId} siteId={siteId} agentId={agentId} draftId={draftId} model={model} close={close} />}
  </Dialog>
}

function DraftSetup({ siteId, agentId, draftId, model, close }: Props & { draftId: string; model: Model; close: () => void }) {
  const { t } = useLocalization()
  // A private form, never hydrated from or submitted to the site's Settings form.
  // Provider handlers persist their own changes; assignment is a separate, explicit write.
  const form = useForm<SiteFormValues>({ defaultValues: { channels: { connections: [
    { id: draftId, type: "", name: "", status: "pending" },
  ] } } })
  const [row] = useWatch({ control: form.control, name: "channels.connections" }) || []
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const inFlight = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  async function finish() {
    if (inFlight.current || !providerComplete(row, draftId)) return
    inFlight.current = true
    setBusy(true)
    setMessage("")
    try {
      const fresh = await model.reload()
      if (!mounted.current) return
      if (!fresh || !canSetUp(fresh, agentId)) { setMessage("settings.channelAgent.saveError"); return }
      const matches = fresh.connections?.filter(c => c.id === draftId)
      if (matches?.length !== 1 || matches[0].type !== row.type || matches[0].status !== "active" ||
        !fresh.connectionIds.includes(draftId) || !providerComplete(form.getValues("channels.connections.0"), draftId)) {
        setMessage("settings.agentChannels.setupPending"); return
      }
      // Even a cleared assignment has history. The existing-connection editor owns reassignment.
      if (fresh.assignments.some(a => a.connectionId === draftId)) { setMessage("settings.agentChannels.setupConflict"); return }
      const result = await model.save({ connectionId: draftId, agentId, expectedRevision: 0 })
      if (!mounted.current) return
      if (result !== "saved") { setMessage(result === "conflict" ? "settings.channelAgent.conflict" : "settings.channelAgent.saveError"); return }
      toast.success(t("settings.channelAgent.saved"))
      close()
    } catch { if (mounted.current) setMessage("settings.channelAgent.saveError") }
    finally { inFlight.current = false; if (mounted.current) setBusy(false) }
  }

  return <DialogContent size="lg" busy={busy}>
    <DialogHeader><DialogTitle>{t("settings.agentChannels.setupAction")}</DialogTitle>
      <DialogDescription>{t("settings.agentChannels.setupDescription")}</DialogDescription></DialogHeader>
    <DialogBody className="space-y-4">
      <p className="text-sm">{t("settings.agentChannels.setupFees")}</p>
      <FormProvider {...form}>
      <SupportChannelsSection active siteId={siteId} standalone={{ draftId, receiptError: t("settings.agentChannels.setupPending") }} />
    </FormProvider>
      <p className="text-sm text-muted-foreground">{t("settings.channelAgent.notice")}</p>
      {message && <p role="alert" className="text-sm text-destructive">{t(message)}</p>}
    </DialogBody>
    <DialogFooter><Button type="button" disabled={busy || !providerComplete(row, draftId)} onClick={finish}>
      {t(busy ? "common.loading" : "settings.agentChannels.setupFinish")}
    </Button></DialogFooter>
  </DialogContent>
}