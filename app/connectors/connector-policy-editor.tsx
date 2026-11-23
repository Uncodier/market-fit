"use client"

import { useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Input } from "@/app/components/ui/input"
import { publicationLabel, type SupportPublication } from "./support-publication"
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group"
import { ConnectorToolPicker } from "./connector-tool-picker"
import { ProviderDirectSection } from "./provider-direct-settings"
import { SectionCard, SectionCardHeader, SectionCardContent, SectionCardFooter } from "@/app/components/ui/section-card"
import type { Connector, ConnectorAccess, ToolAccessMode } from "./types"

export type PolicyUpdate = { catalog_reads: false } | { tool_access_mode: ToolAccessMode; allowed_tools: string[]; allowed_hosts: string[]; require_approval: boolean; enabled: boolean; catalog_reads?: true; support_publication?: SupportPublication | null }

export function ConnectorPolicyEditor({ siteId, access, connector, canManage, pending, blocked = false, save, onChanged }: {
  siteId: string; access: ConnectorAccess; connector: Connector; canManage: boolean; pending: boolean; blocked?: boolean; save: (policy: PolicyUpdate) => void; onChanged: () => void
}) {
  const { t } = useLocalization()
  const savedMode = access.policy.tool_access_mode ?? "selected"
  const [mode, setMode] = useState(savedMode)
  const [tools, setTools] = useState(access.policy.allowed_tools)
  const savedAssistant = access.policy.allowed_hosts.includes("assistant")
  const [assistant, setAssistant] = useState(savedAssistant)
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
  const otherChanges = assistant !== savedAssistant || publicationChanged || mode !== savedMode || tools.length !== access.policy.allowed_tools.length || tools.some(id => !access.policy.allowed_tools.includes(id)) || approval !== access.policy.require_approval || enabled !== connector.enabled
  const dirty = catalogChanged || otherChanges
  const optingOut = catalogChanged && !catalogReads
  const activatable = connector.provider_status.toUpperCase() === "ACTIVE" && !!connector.verified_at && !connector.revocation_pending
  const catalogReady = assistant && enabled && activatable && !connector.revocation_dispatched
  const invalidDraft = optingOut ? otherChanges : invalidPublication || (enabled && !activatable) || (catalogChanged && !catalogReady)
  function savePolicy() {
    if (!canManage || pending || blocked || !dirty || invalidDraft) return
    if (optingOut) return save({ catalog_reads: false })
    const hosts = assistant === savedAssistant ? access.policy.allowed_hosts : assistant
      ? [...access.policy.allowed_hosts, "assistant"] : access.policy.allowed_hosts.filter(host => host !== "assistant")
    save({ tool_access_mode: mode, allowed_tools: tools, allowed_hosts: hosts, require_approval: approval, enabled,
      ...(catalogChanged ? { catalog_reads: true as const } : {}),
      ...(showPublication ? { support_publication: audience === "off" ? null : { audience, label_id: labelId } } : {}),
    })
  }
  return <><SectionCard id="tools-permissions">
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
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={assistant} disabled={!canManage || blocked || pending} onCheckedChange={value => setAssistant(value === true)} />{t("connectors.allowAssistant")}</label>
      <p className="text-xs text-muted-foreground">{t("connectors.hostAssistant")}</p>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={catalogReads}
        disabled={!canManage || blocked || pending || access.policy.catalog_reads === undefined || (!catalogReads && !catalogReady)}
        onCheckedChange={value => setCatalogReads(value === true)} />{t("connectors.catalogReads")}</label>
      <p className="text-xs text-muted-foreground">{t(mode === "all" ? "connectors.catalogReadsAll" : "connectors.catalogReadsSelected")}</p>
      <p className="text-xs text-muted-foreground">{t("connectors.catalogReadsLimits")}</p>
      {optingOut && otherChanges && <p role="alert" className="text-sm">{t("connectors.errors.catalogOptOutSeparate")}</p>}
      {canManage && !catalogReady && <p className="text-xs text-muted-foreground">{t("connectors.catalogReadsUnavailable")}</p>}
      <p className="text-xs text-muted-foreground">{t("connectors.versionedExecutionBilling")}</p>
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
    </SectionCardContent>
    {canManage && <SectionCardFooter onSave={savePolicy} dirty={dirty} saving={pending} saveDisabled={blocked || pending || !dirty || invalidDraft} saveLabel={t("connectors.savePolicy")} savingLabel={t("connectors.saving")} />}
  </SectionCard>
    <ProviderDirectSection key={`${siteId}:${connector.id}:${access.revision}`} siteId={siteId} connector={connector} canManage={canManage}
      policy={access.policy} blockEnable={dirty || blocked || pending} onChanged={onChanged} />
  </>
}