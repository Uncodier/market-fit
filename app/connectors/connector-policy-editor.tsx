"use client"

import { useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Input } from "@/app/components/ui/input"
import { publicationLabel, type SupportPublication } from "./support-publication"
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group"
import { ConnectorToolPicker } from "./connector-tool-picker"
import { AskStatus, useAskStatus } from "./provider-direct-settings"
import type { AskAccessIntent } from "./provider-direct-contract"
import { SectionCard, SectionCardHeader, SectionCardContent, SectionCardFooter } from "@/app/components/ui/section-card"
import type { Connector, ConnectorAccess, ToolAccessMode } from "./types"

export type PolicyUpdate = { catalog_reads: false } | { tool_access_mode: ToolAccessMode; allowed_tools: string[]; allowed_hosts: string[]; require_approval: boolean; enabled: boolean; catalog_reads?: true; ask_access?: AskAccessIntent; support_publication?: SupportPublication | null }

export function ConnectorPolicyEditor({ siteId, access, connector, canManage, pending, blocked = false, save, onChanged }: {
  siteId: string; access: ConnectorAccess; connector: Connector; canManage: boolean; pending: boolean; blocked?: boolean; save: (policy: PolicyUpdate) => void; onChanged: () => void
}) {
  const { t } = useLocalization()
  const savedMode = access.policy.tool_access_mode ?? "selected"
  const [mode, setMode] = useState(savedMode)
  const [tools, setTools] = useState(access.policy.allowed_tools)
  const savedAssistant = access.policy.allowed_hosts.includes("assistant")
  const ask = useAskStatus(siteId, connector, canManage)
  const { status } = ask
  const [askDraft, setAskDraft] = useState<AskAccessIntent>()
  const verified = !!status?.attested && !status.unsupported_reason && !status.setup_pending
  const intent = verified && askDraft?.expected_direct_revision === status.direct_revision ? askDraft : undefined
  const savedAsk = savedAssistant && !!status?.enabled
  const legacyHostOnly = !!status && !status.enabled && !status.setup_pending && !verified
  const [legacyHost, setLegacyHost] = useState(savedAssistant)
  const assistant = intent?.enabled ?? (legacyHostOnly ? legacyHost : savedAssistant)
  const [catalogReads, setCatalogReads] = useState(access.policy.catalog_reads === true)
  const catalogChanged = catalogReads !== (access.policy.catalog_reads === true)
  const [approval, setApproval] = useState(access.policy.require_approval)
  const [enabled, setEnabled] = useState(connector.enabled)
  const savedPublication = access.policy.support_publication
  const showPublication = canManage && connector.toolkit_slug === "gmail" && savedPublication !== undefined
  const [audience, setAudience] = useState<SupportPublication["audience"] | "off">(savedPublication?.audience ?? "off")
  const [labelId, setLabelId] = useState(savedPublication?.label_id ?? "")
  const invalidPublication = showPublication && audience !== "off" && (!publicationLabel.test(labelId) || (mode === "selected" && !tools.includes("GMAIL_FETCH_EMAILS")))
  const publicationChanged = showPublication && (audience !== (savedPublication?.audience ?? "off") || (audience !== "off" && labelId !== savedPublication?.label_id))
  const otherChanges = !!intent || assistant !== savedAssistant || publicationChanged || mode !== savedMode || tools.length !== access.policy.allowed_tools.length || tools.some(id => !access.policy.allowed_tools.includes(id)) || approval !== access.policy.require_approval || enabled !== connector.enabled
  const dirty = catalogChanged || otherChanges
  const optingOut = catalogChanged && !catalogReads
  const activatable = connector.provider_status.toUpperCase() === "ACTIVE" && !!connector.verified_at && !connector.revocation_pending
  const catalogReady = assistant && enabled && activatable && !connector.revocation_dispatched
  const askReady = verified && !!access.policy.tool_access_mode && enabled && activatable && !connector.revocation_dispatched && (mode === "all" || tools.length > 0)
  const invalidDraft = optingOut ? otherChanges : invalidPublication || (enabled && !activatable) || (catalogChanged && !catalogReady) || (intent?.enabled && !askReady)
  function savePolicy() {
    if (!canManage || pending || ask.pending || blocked || !dirty || invalidDraft) return
    if (optingOut) return save({ catalog_reads: false })
    const hosts = assistant === savedAssistant ? access.policy.allowed_hosts : assistant
      ? [...access.policy.allowed_hosts, "assistant"] : access.policy.allowed_hosts.filter(host => host !== "assistant")
    save({ tool_access_mode: mode, allowed_tools: tools, allowed_hosts: hosts, require_approval: approval, enabled,
      ...(intent ? { ask_access: intent } : {}),
      ...(catalogChanged ? { catalog_reads: true as const } : {}),
      ...(showPublication ? { support_publication: audience === "off" ? null : { audience, label_id: labelId } } : {}),
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
      <div id="robots-ask" className="space-y-2">
        <h3 className="text-sm font-medium">{t("connectors.directTitle")}</h3>
        <p className="text-sm">{t("connectors.askAccount", { account: connector.display_name })}</p>
        {canManage ? <>
          <AskStatus connector={connector} policy={access.policy} resource={ask} disabled={pending}
            onRefresh={() => { setAskDraft(undefined); setLegacyHost(savedAssistant); ask.refresh(); if (ask.mismatch) onChanged() }}
            onRevoke={() => { setAskDraft(undefined); void ask.revoke() }} />
          {verified && <label className="flex items-center gap-2 text-sm"><Checkbox checked={intent?.enabled ?? savedAsk}
            disabled={blocked || pending || ask.pending || (!intent && !savedAsk && !askReady)}
            onCheckedChange={value => setAskDraft((value === true) === savedAsk ? undefined : { enabled: value === true, expected_direct_revision: status.direct_revision })} />{t("connectors.allowAsk")}</label>}
          {verified && !savedAsk && !askReady && <p className="text-xs text-muted-foreground">{t("connectors.askNeedsScope")}</p>}
          {intent?.enabled && <p className="text-sm">{t("connectors.directEffects")} {t("connectors.directPrivate")}</p>}
        </> : <p className="text-sm text-muted-foreground">{t("connectors.directManagerOnly")}</p>}
      </div>
      {legacyHostOnly && <label className="flex items-center gap-2 text-sm"><Checkbox checked={assistant} disabled={blocked || pending || ask.pending} onCheckedChange={value => setLegacyHost(value === true)} />{t("connectors.legacyAssistantHost")}</label>}
      <p className="text-xs text-muted-foreground">{t("connectors.hostAssistant")}</p>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={approval} disabled={!canManage || pending} onCheckedChange={value => setApproval(value === true)} />{t("connectors.requireApproval")}</label>
      <p className="text-xs text-muted-foreground">{t("connectors.approvalHelp")}</p>
      {showPublication && <fieldset className="space-y-2" disabled={blocked || pending}>
        <legend className="text-sm font-medium">{t("connectors.publicationAudience")}</legend>
        <RadioGroup aria-label={t("connectors.publicationAudience")} value={audience} disabled={blocked || pending} onValueChange={v => { if (v === "off" || v === "verified" || v === "anonymous") setAudience(v) }}>
          {(["off", "verified", "anonymous"] as const).map(v => <label key={v} className="flex items-center gap-2 text-sm"><RadioGroupItem value={v} />{t({off: "connectors.publicationOff", verified: "connectors.publicationVerified", anonymous: "connectors.publicationAnonymous"}[v])}</label>)}
        </RadioGroup>
        {audience !== "off" && <><p className="text-xs">{t("connectors.publicationHelp")}</p>
          <label className="block text-sm">{t("connectors.publicationLabel")}<Input value={labelId} maxLength={38} onChange={e => setLabelId(e.target.value)} /></label>
          {invalidPublication && <p className="text-xs text-muted-foreground">{t("connectors.publicationInvalid")}</p>}</>}
      </fieldset>}
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={enabled} disabled={!canManage || pending || (!enabled && !activatable)} onCheckedChange={value => setEnabled(value === true)} />{t("connectors.enabled")}</label>
      <p className="text-xs text-muted-foreground">{t("connectors.enableHelp")}</p>
      {access.policy.catalog_reads !== undefined && <details className="space-y-2 text-sm">
        <summary className="w-fit cursor-pointer font-medium">{t("connectors.legacyReadsTitle")}</summary>
        <label className="flex items-center gap-2"><Checkbox checked={catalogReads}
          disabled={!canManage || blocked || pending || (!catalogReads && !catalogReady)}
          onCheckedChange={value => setCatalogReads(value === true)} />{t("connectors.catalogReads")}</label>
        <p className="text-xs text-muted-foreground">{t(mode === "all" ? "connectors.catalogReadsAll" : "connectors.catalogReadsSelected")} {t("connectors.catalogReadsLimits")}</p>
        {canManage && !catalogReady && <p className="text-xs text-muted-foreground">{t("connectors.catalogReadsUnavailable")}</p>}
      </details>}
      {optingOut && otherChanges && <p role="alert" className="text-sm">{t("connectors.errors.catalogOptOutSeparate")}</p>}
    </SectionCardContent>
    {canManage && <SectionCardFooter onSave={savePolicy} dirty={dirty} saving={pending} saveDisabled={blocked || pending || ask.pending || !dirty || invalidDraft} saveLabel={t("connectors.savePolicy")} savingLabel={t("connectors.saving")} />}
  </SectionCard>
}