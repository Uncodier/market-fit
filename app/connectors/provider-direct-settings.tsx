"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { SectionCard, SectionCardContent, SectionCardHeader } from "@/app/components/ui/section-card"
import { ConnectorError } from "./connector-feedback"
import { ConnectorRequestError, scopedConnectorPath } from "./connector-request"
import { directPolicyStatus, type DirectPolicyStatus } from "./provider-direct-contract"
import type { Connector, ConnectorAccess } from "./types"
import { useConnectorMutation, useConnectorResource } from "./use-connector-resource"

type ManagerProps = {
  siteId: string; connector: Connector; onChanged: () => void
  // No saved scope supplied on the local recovery surface: revocation only.
  policy?: ConnectorAccess["policy"]; blockEnable?: boolean
}

export function AskAccessSection({ canManage, ...props }: ManagerProps & { canManage: boolean }) {
  const { t } = useLocalization()
  return <SectionCard id="robots-ask">
    <SectionCardHeader title={t("connectors.directTitle")} description={t("connectors.askAccount", { account: props.connector.display_name })} />
    <SectionCardContent>
      {canManage ? <DirectPolicyControls {...props} /> : <p className="text-sm text-muted-foreground">{t("connectors.directManagerOnly")}</p>}
    </SectionCardContent>
  </SectionCard>
}

/** Only mount for a manager, keyed by the selected site, account and revision. */
export function DirectPolicyControls(props: ManagerProps) {
  const [attempt, setAttempt] = useState(0)
  return <DirectPolicySnapshot key={attempt} {...props} refresh={() => setAttempt(a => a + 1)} />
}

function allowsAskTools(policy: NonNullable<ManagerProps["policy"]>) {
  return policy.allowed_hosts.includes("assistant") &&
    (policy.tool_access_mode === "all" || (policy.tool_access_mode === "selected" && policy.allowed_tools.length > 0))
}

function askState(status: DirectPolicyStatus, accountActive: boolean, policy?: ManagerProps["policy"]) {
  if (status.unsupported_reason) return "unsupported"
  if (status.setup_pending) return "pending"
  if (!status.enabled) return status.attested ? "off" : "unverified"
  if (!accountActive) return "blocked"
  if (!policy) return "on" // Recovery can confirm enrollment, not the allowed tool scope.
  if (!policy.tool_access_mode) return "scopeUnknown"
  return allowsAskTools(policy) ? "available" : "blocked"
}

function DirectPolicySnapshot({ siteId, connector, policy, blockEnable, onChanged, refresh }: ManagerProps & { refresh: () => void }) {
  const { t } = useLocalization()
  const base = `connections/${encodeURIComponent(connector.id)}/provider-direct`
  const schema = useMemo(() => directPolicyStatus(connector.id), [connector.id])
  const { data, error } = useConnectorResource(scopedConnectorPath(base, siteId), schema)
  const mutation = useConnectorMutation()
  const [confirm, setConfirm] = useState(false)
  const [saved, setSaved] = useState<typeof data>()
  const status = saved ?? data
  if (error || mutation.error) return <ConnectorError error={error || mutation.error} retry={refresh} />
  if (!status) return <p role="status" className="text-sm">{t("connectors.directLoading")}</p>
  if (status.revision !== connector.revision) return <ConnectorError error={new ConnectorRequestError("conflict", 409)} retry={() => { refresh(); onChanged() }} />

  const all = policy?.tool_access_mode === "all"
  const scopeLabel = all ? t("connectors.directAll") : t("connectors.directSelected", { count: policy?.allowed_tools.length ?? 0 })
  const ready = policy && allowsAskTools(policy)
  const accountActive = connector.enabled && !!connector.verified_at && connector.provider_status === "ACTIVE" && !connector.revocation_pending && !connector.revocation_dispatched
  const unsupported = !!status.unsupported_reason // Compatibility with an explicit denial from older servers.
  const offerEnable = !!policy?.tool_access_mode && accountActive && status.attested && !status.enabled && !status.setup_pending && !unsupported
  const canEnable = offerEnable && !blockEnable
  // Effective enrollment does not distinguish absent consent from consent for an old proof.
  const clear = !saved && !status.enabled && !status.setup_pending && (!policy || (!status.attested && !unsupported))
  const state = askState(status, accountActive, policy)
  const update = async (enabled: boolean) => {
    if (mutation.pending || (enabled && !canEnable)) return
    // A pending setup is only confirmed cancelled by a receipt that still reports setup state.
    const change = { site_id: siteId, expected_revision: status.revision, expected_direct_revision: status.direct_revision, enabled }
    const receipt = await mutation.run(`/api/connectors/${base}`, change, directPolicyStatus(connector.id, change, status.setup_pending !== undefined), "PATCH")
    if (receipt) {
      setSaved(receipt)
      setConfirm(false)
      // The ordinary revision is unchanged. Keep policy drafts and use the new Ask revision.
      toast.success(t(receipt.enabled ? "connectors.directSaved" : "connectors.directRevoked", { account: connector.display_name }))
    }
  }

  return <div className="space-y-2 text-sm" aria-label={t("connectors.directTitle")} role="group">
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">{t(`connectors.askState.${state}`)}</Badge>
      {offerEnable && <Button type="button" variant="outline" size="sm" disabled={!canEnable || mutation.pending} onClick={() => setConfirm(true)}>{t("connectors.directEnable")}</Button>}
      {(status.enabled || status.setup_pending || clear) && <Button type="button" variant="outline" size="sm" disabled={mutation.pending} onClick={() => void update(false)}>
        {t(status.setup_pending ? "connectors.cancelAskSetup" : status.enabled ? "connectors.directDisable" : "connectors.directClear")}
      </Button>}
      <Button type="button" variant="ghost" size="sm" disabled={mutation.pending} onClick={refresh}>{t("connectors.refresh")}</Button>
    </div>
    <p className="text-muted-foreground">{t(`connectors.askHelp.${state}`)}</p>
    {offerEnable && blockEnable && <p>{t("connectors.directUnsaved")}</p>}
    <ConfirmDialog open={confirm && canEnable} onOpenChange={setConfirm} loading={mutation.pending}
      title={t("connectors.directConfirmTitle", { account: connector.display_name })}
      description={<>{scopeLabel} {!ready && `${t("connectors.directDormant")} `}{t("connectors.directEffects")} {t("connectors.directPrivate")}</>}
      confirmLabel={t("connectors.directEnable")} cancelLabel={t("connectors.cancel")} onConfirm={() => update(true)} />
  </div>
}