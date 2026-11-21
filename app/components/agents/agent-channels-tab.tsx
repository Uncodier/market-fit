"use client"

import { useId, useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ChannelIcon } from "@/app/components/channels/channel-icon"
import { Button } from "@/app/components/ui/button"
import { SectionCard, SectionCardHeader } from "@/app/components/ui/section-card"
import { ChannelAgentAssignmentsProvider, servingChannelAgentId, useChannelAgentAssignments } from "@/app/components/settings/channel-agent-assignments-provider"
import { ChannelAgentRow } from "@/app/components/settings/channel-agent-row"
import { getChannelLabel } from "@/lib/site-channels"
import { AgentChannelSetup } from "./agent-channel-setup"
import { AgentChannelsSkeleton } from "./channel-skeletons"

export function AgentChannelsTab({ siteId, agentId }: { siteId: string; agentId: string }) {
  return <ChannelAgentAssignmentsProvider siteId={siteId}>
    <ChannelDirectory key={agentId} siteId={siteId} agentId={agentId} />
  </ChannelAgentAssignmentsProvider>
}

function ChannelDirectory({ siteId, agentId }: { siteId: string; agentId: string }) {
  const model = useChannelAgentAssignments()
  const { t } = useLocalization()
  const [showOther, setShowOther] = useState(false)
  const otherListId = useId()
  const data = model?.data
  if (!model) return null
  if (!data && !model.failed) return <AgentChannelsSkeleton />
  if (!data?.connections) return <div className="space-y-3 p-4 text-sm text-muted-foreground" role="alert">
    {t("settings.channelAgent.failed")} <Button type="button" variant="outline" size="sm" onClick={model.reload}>{t("common.retry")}</Button>
  </div>
  const agent = data.agents.find(item => item.id === agentId)
  if (!agent) return <p role="status">{t("settings.channelAgent.unavailable")}</p>

  const selections = new Map(data.assignments.map(a => [a.connectionId, a.agentId]))
  const groups: Record<"assigned" | "current" | "other", typeof data.connections> = { assigned: [], current: [], other: [] }
  for (const connection of data.connections) {
    const observed = servingChannelAgentId(data, connection.id, connection.type)
    const group = selections.get(connection.id) === agentId ? 'assigned' : observed === agentId ? 'current' : 'other'
    groups[group].push(connection)
  }
  const renderCard = (c: typeof data.connections[number]) => {
    const channel = c.type === 'website' ? t('settings.nav.websiteChannel') : getChannelLabel(c.type)
    const label = c.label || channel
    return <SectionCard key={c.id}>
      <SectionCardHeader title={<span className="flex items-center gap-2"><ChannelIcon channel={c.type} />{label}</span>}
        description={[channel !== label ? channel : '', c.account || (c.type === 'website' ? '' : c.id)].filter(Boolean).join(' · ')}
        actions={<span className="text-xs text-muted-foreground">{t(`settings.agentChannels.status.${c.status}`)}</span>} />
      <ChannelAgentRow type={c.type} label={[label, c.account || (c.type === 'website' ? '' : c.id)].filter(Boolean).join(' · ')}
        connectionId={c.id} profileAgentId={agentId} />
    </SectionCard>
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-semibold">{t('settings.agentChannels.tab')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.agentChannels.summary')}</p>
        {agent.status !== 'active' && <p className="mt-1 text-sm text-muted-foreground">{t('settings.agentChannels.activateFirst')}</p>}</div>
      {data.canManage && data.assignmentsAvailable !== false && agent.status === 'active' && <AgentChannelSetup siteId={siteId} agentId={agentId} />}
    </div>
    <section className="space-y-2"><h3 className="font-medium">{t('settings.agentChannels.assigned')}</h3>
      {groups.assigned.length ? groups.assigned.map(renderCard) : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        {data.assignmentsAvailable === false ? t('settings.channelAgent.migration') : t('settings.agentChannels.none')}</p>}
    </section>
    {groups.current.length > 0 && <section className="space-y-2"><h3 className="font-medium">{t('settings.agentChannels.current')}</h3>
      {groups.current.map(renderCard)}</section>}
    {groups.other.length > 0 && <section className="space-y-2">
      <Button aria-expanded={showOther} aria-controls={otherListId} type="button" variant="outline" size="sm" onClick={() => setShowOther(!showOther)}>
        {t('settings.agentChannels.other', { count: groups.other.length })}</Button>
      <div id={otherListId} hidden={!showOther} className="space-y-2">{showOther && groups.other.map(renderCard)}</div></section>}
  </div>
}