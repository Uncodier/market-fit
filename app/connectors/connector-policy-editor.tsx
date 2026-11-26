"use client"

import { useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Button } from "@/app/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group"
import { ConnectorToolPicker } from "./connector-tool-picker"
import { AskStatus, useAskStatus } from "./provider-direct-settings"
import { isAskVerified, type AskAccessIntent } from "./provider-direct-contract"
import { SectionCard, SectionCardHeader, SectionCardContent, SectionCardFooter } from "@/app/components/ui/section-card"
import type { Connector, ConnectorAccess, ToolAccessMode } from "./types"

export type PolicyUpdate = { tool_access_mode: ToolAccessMode; allowed_tools: string[]; allowed_hosts: string[]; require_approval: boolean; enabled: boolean; ask_access?: AskAccessIntent; support_publication?: null }

export function ConnectorPolicyEditor({ siteId, access, connector, canManage, pending, blocked = false, save, onChanged }: {
  siteId: string; access: ConnectorAccess; connector: Connector; canManage: boolean; pending: boolean; blocked?: boolean; save: (policy: PolicyUpdate) => void; onChanged: () => void
}) {
  const { t } = useLocalization()
  const savedMode = access.policy.tool_access_mode ?? "selected"
  const [mode, setMode] = useState(savedMode)
  const [tools, setTools] = useState(access.policy.allowed_tools)
  const savedAssistant = access.policy.allowed_hosts.includes("assistant")
  const savedDirect = access.policy.allowed_hosts.includes("direct")
  const [direct, setDirect] = useState(savedDirect)
  const ask = useAskStatus(siteId, connector, canManage)
  const { status } = ask
  const restrictedAsk = status?.ask_compatible === false || status?.ask_compatible === null
  const [askDraft, setAskDraft] = useState<AskAccessIntent>()
  const verified = !!status && isAskVerified(status)
  const unified = status?.authorization_mode === "host_policy"
  const memberPolicy = status?.authorization_mode === "member_policy"
  const hostPolicy = unified || memberPolicy
  const intent = !unified && verified && askDraft?.expected_direct_revision === status.direct_revision ? askDraft : undefined
  const savedAsk = savedAssistant && !!status?.enabled
  const legacyHostOnly = !!status && !status.enabled && !status.setup_pending && !verified
  const [hostDraft, setHostDraft] = useState(savedAssistant)
  const assistant = hostPolicy ? hostDraft : intent?.enabled ?? (legacyHostOnly ? hostDraft : savedAssistant)
  const [approval, setApproval] = useState(access.policy.require_approval)
  const [enabled, setEnabled] = useState(connector.enabled)
  const savedPublication = access.policy.support_publication
  const [clearPublication, setClearPublication] = useState(false)
  const publicationChanged = canManage && !!savedPublication && clearPublication
  const dirty = !!intent || assistant !== savedAssistant || direct !== savedDirect || publicationChanged || mode !== savedMode || tools.length !== access.policy.allowed_tools.length || tools.some(id => !access.policy.allowed_tools.includes(id)) || approval !== access.policy.require_approval || enabled !== connector.enabled
  const activatable = connector.provider_status.toUpperCase() === "ACTIVE" && !!connector.verified_at && !connector.revocation_pending
  const askReady = verified && !!access.policy.tool_access_mode && enabled && activatable && !connector.revocation_dispatched && (mode === "all" || tools.length > 0)
  const invalidDraft = (restrictedAsk && !savedAssistant && assistant) || (enabled && !activatable) || (intent?.enabled && (!askReady || !assistant))
  function savePolicy() {
    if (!canManage || pending || ask.pending || blocked || !dirty || invalidDraft) return
    const askHosts = assistant === savedAssistant ? access.policy.allowed_hosts : assistant
      ? [...access.policy.allowed_hosts, "assistant"] : access.policy.allowed_hosts.filter(host => host !== "assistant")
    const hosts = direct === savedDirect ? askHosts : direct ? [...askHosts, "direct"] : askHosts.filter(host => host !== "direct")
    save({ tool_access_mode: mode, allowed_tools: tools, allowed_hosts: hosts, require_approval: approval, enabled,
      ...(intent ? { ask_access: intent } : {}),
      ...(publicationChanged ? { support_publication: null } : {}),
    })
  }
  return <SectionCard id="tools-permissions">
    <SectionCardHeader title={t("connectors.policy")} description={t("connectors.policyHelp")} />
    <SectionCardContent>
      {canManage ? <RadioGroup aria-label={t("connectors.toolMode")} value={mode} disabled={blocked || pending} onValueChange={value => { if (value === "all" || value === "selected") setMode(value) }}>
        {(["all", "selected"] as const).map(option => <label key={option} className="flex items-center gap-2 text-sm">
          <RadioGroupItem value={option} />{t(option === "all" ? "connectors.allCompatible" : "connectors.onlySelected")}
        </label>)}
      </RadioGroup> : <p className="text-sm font-medium">{t(mode === "all" ? "connectors.allCompatible" : "connectors.onlySelected")}</p>}
      {mode === "all" ? <div className="space-y-1 text-sm">
        <p>{t("connectors.allCompatibleHelp")}</p>
        {canManage && access.reviewed_tools && <p className="text-muted-foreground">{access.reviewed_tools.length === 0
          ? t("connectors.noExecutableTools") : t("connectors.compatibleCount", { count: String(access.reviewed_tools.length) })}</p>}
      </div> : <ConnectorToolPicker siteId={siteId} slug={connector.toolkit_slug} selected={tools} onChange={setTools} canManage={canManage} disabled={blocked || pending} />}
      {canManage && <div className="space-y-1"><label className="flex items-center gap-2 text-sm">
        <Checkbox checked={direct} disabled={blocked || pending} onCheckedChange={value => setDirect(value === true)} />{t("connectors.scheduledHost")}
      </label><p className="text-xs text-muted-foreground">{t("connectors.scheduledHostHelp")}</p></div>}
      <div id="robots-ask" className="space-y-2">
        <h3 className="text-sm font-medium">{t("connectors.directTitle")}</h3>
        <p className="text-sm">{t("connectors.askAccount", { account: connector.display_name })}</p>
        {canManage ? <>
          <AskStatus connector={connector} policy={access.policy} resource={ask} disabled={pending}
            onRefresh={() => { setAskDraft(undefined); setHostDraft(savedAssistant); ask.refresh(); if (ask.mismatch) onChanged() }}
            onRevoke={() => { setAskDraft(undefined); void ask.revoke() }} />
          {hostPolicy && <label className="flex items-center gap-2 text-sm"><Checkbox checked={assistant} disabled={blocked || pending || ask.pending || (restrictedAsk && !assistant)}
            onCheckedChange={value => setHostDraft(value === true)} />{t(unified ? "connectors.askHostPolicy" : "connectors.assistantHost")}</label>}
          {!unified && status && !status.enabled && !status.setup_pending && (status.explicitly_disabled || !verified) && <Button type="button" variant="outline" size="sm"
            disabled={blocked || pending || ask.pending || (!intent && (!assistant || !askReady))}
            onClick={() => setAskDraft(intent ? undefined : { enabled: true, expected_direct_revision: status.direct_revision })}>
            {t(intent ? "connectors.cancelRestoreAsk" : "connectors.restoreAsk")}
          </Button>}
          {!hostPolicy && verified && <label className="flex items-center gap-2 text-sm"><Checkbox checked={intent?.enabled ?? savedAsk}
            disabled={blocked || pending || ask.pending || (!intent && !savedAsk && !askReady)}
            onCheckedChange={value => setAskDraft((value === true) === savedAsk ? undefined : { enabled: value === true, expected_direct_revision: status.direct_revision })} />{t("connectors.allowAsk")}</label>}
          {!hostPolicy && verified && !savedAsk && !askReady && <p className="text-xs text-muted-foreground">{t("connectors.askNeedsScope")}</p>}
          {(intent?.enabled || (hostPolicy && (verified || (unified && assistant)))) && <p className="text-sm">{t("connectors.directEffects")} {t("connectors.directPrivate")}</p>}
        </> : <p className="text-sm text-muted-foreground">{t("connectors.directManagerOnly")}</p>}
      </div>
      {!hostPolicy && legacyHostOnly && <label className="flex items-center gap-2 text-sm"><Checkbox checked={assistant} disabled={blocked || pending || ask.pending} onCheckedChange={value => setHostDraft(value === true)} />{t("connectors.legacyAssistantHost")}</label>}
      <p className="text-xs text-muted-foreground">{t("connectors.hostAssistant")}</p>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={approval} disabled={!canManage || pending} onCheckedChange={value => setApproval(value === true)} />{t("connectors.requireApproval")}</label>
      <p className="text-xs text-muted-foreground">{t("connectors.approvalHelp")}</p>
      {canManage && savedPublication && <label className="flex items-center gap-2 text-sm"><Checkbox checked={clearPublication} disabled={blocked || pending} onCheckedChange={value => setClearPublication(value === true)} />{t("connectors.removeLegacyPublication")}</label>}
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={enabled} disabled={!canManage || pending || (!enabled && !activatable)} onCheckedChange={value => setEnabled(value === true)} />{t("connectors.enabled")}</label>
      <p className="text-xs text-muted-foreground">{t("connectors.enableHelp")}</p>
    </SectionCardContent>
    {canManage && <SectionCardFooter onSave={savePolicy} dirty={dirty} saving={pending} saveDisabled={blocked || pending || ask.pending || !dirty || invalidDraft} saveLabel={t("connectors.savePolicy")} savingLabel={t("connectors.saving")} />}
  </SectionCard>
}