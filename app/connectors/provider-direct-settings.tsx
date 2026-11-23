"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { SectionCard, SectionCardContent, SectionCardHeader } from "@/app/components/ui/section-card"
import { ConnectorError } from "./connector-feedback"
import { ConnectorRequestError, scopedConnectorPath } from "./connector-request"
import { directPolicyStatus } from "./provider-direct-contract"
import type { Connector, ConnectorAccess } from "./types"
import { useConnectorMutation, useConnectorResource } from "./use-connector-resource"

type ManagerProps = {
  siteId: string; connector: Connector; onChanged: () => void
  // No saved scope supplied on the local recovery surface: revocation only.
  policy?: ConnectorAccess["policy"]; blockEnable?: boolean
}

export function ProviderDirectSection({ canManage, ...props }: ManagerProps & { canManage: boolean }) {
  const { t } = useLocalization()
  const [review, setReview] = useState(false)
  return <SectionCard id="provider-direct">
    <SectionCardHeader title={t("connectors.directTitle")} description={t("connectors.directHelp")} />
    <SectionCardContent>
      <p className="text-sm">{t("connectors.directBoundary")}</p>
      <p className="text-sm">{t("connectors.directEffects")}</p>
      <p className="text-sm text-muted-foreground">{t("connectors.directPrivate")}</p>
      {!canManage ? <p className="text-sm">{t("connectors.directManagerOnly")}</p>
        : review ? <DirectPolicyControls {...props} />
        : <Button type="button" size="sm" variant="outline" onClick={() => setReview(true)}>{t("connectors.directReview")}</Button>}
    </SectionCardContent>
  </SectionCard>
}

/** Only mount for a manager, keyed by the selected site, account and revision. */
export function DirectPolicyControls(props: ManagerProps) {
  // Direct changes no longer remount the ordinary policy editor. Refresh only
  // these controls on retry; never replay the mutation or discard a policy draft.
  const [attempt, setAttempt] = useState(0)
  return <DirectPolicySnapshot key={attempt} {...props} refresh={() => { setAttempt(a => a + 1); props.onChanged() }} />
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
  if (status.revision !== connector.revision) return <ConnectorError error={new ConnectorRequestError("conflict", 409)} retry={refresh} />

  const all = policy?.tool_access_mode === "all"
  const scopeLabel = all ? t("connectors.directAll") : t("connectors.directSelected", { count: policy?.allowed_tools.length ?? 0 })
  const ready = !!policy && policy.allowed_hosts.includes("assistant") && (all || policy.allowed_tools.length > 0)
  const accountActive = connector.enabled && !!connector.verified_at && connector.provider_status === "ACTIVE" && !connector.revocation_pending && !connector.revocation_dispatched
  const canEnable = !!policy?.tool_access_mode && accountActive && status.attested && !status.enabled && !blockEnable
  const update = async (enabled: boolean) => {
    if (mutation.pending || (enabled && !canEnable)) return
    const change = { site_id: siteId, expected_revision: status.revision, expected_direct_revision: status.direct_revision, enabled }
    const receipt = await mutation.run(`/api/connectors/${base}`, change, directPolicyStatus(connector.id, change), "PATCH")
    if (receipt) {
      setSaved(receipt)
      setConfirm(false)
      toast.success(t(receipt.enabled ? "connectors.directSaved" : "connectors.directRevoked", { account: connector.display_name }))
      onChanged()
    }
  }

  return <div className="space-y-3 text-sm" aria-label={t("connectors.directTitle")} role="group">
    <dl className="space-y-1">
      <div><dt className="inline font-medium">{t("connectors.directVerification")}: </dt><dd className="inline">{t(status.attested ? "connectors.directVerified" : "connectors.directUnverified")}</dd></div>
      <div><dt className="inline font-medium">{t("connectors.directEnrollment")}: </dt><dd className="inline">{t(status.enabled ? "connectors.directActive" : "connectors.directInactive")}</dd></div>
    </dl>
    {policy?.tool_access_mode && <p>{scopeLabel}</p>}
    {policy && !policy.tool_access_mode && <p>{t("connectors.directScopeUnknown")}</p>}
    {policy && !ready && <p>{t("connectors.directDormant")}</p>}
    {blockEnable && <p>{t("connectors.directUnsaved")}</p>}
    <p className="text-xs text-muted-foreground">{t("connectors.directRevokeHelp")}</p>
    <div className="flex flex-wrap gap-2">
      {policy && !status.enabled && <Button type="button" size="sm" disabled={!canEnable || mutation.pending} onClick={() => setConfirm(true)}>{t("connectors.directEnable")}</Button>}
      {(status.enabled || !status.attested || !policy) && <Button type="button" variant="outline" size="sm" disabled={mutation.pending} onClick={() => void update(false)}>
        {t(status.enabled ? "connectors.directDisable" : "connectors.directClear")}
      </Button>}
    </div>
    <ConfirmDialog open={confirm && canEnable} onOpenChange={setConfirm} loading={mutation.pending}
      title={t("connectors.directConfirmTitle", { account: connector.display_name })}
      description={<>{scopeLabel} {!ready && `${t("connectors.directDormant")} `}{t("connectors.directEffects")} {t("connectors.directPrivate")}</>}
      confirmLabel={t("connectors.directEnable")} cancelLabel={t("connectors.cancel")} onConfirm={() => update(true)} />
  </div>
}