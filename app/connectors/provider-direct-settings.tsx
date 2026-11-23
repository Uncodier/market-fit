"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { ConnectorError } from "./connector-feedback"
import { ConnectorRequestError, scopedConnectorPath } from "./connector-request"
import { directPolicyStatus, type DirectPolicyStatus } from "./provider-direct-contract"
import type { Connector, ConnectorAccess } from "./types"
import { useConnectorMutation, useConnectorResource } from "./use-connector-resource"

export function useAskStatus(siteId: string, connector: Connector, canManage: boolean) {
  const { t } = useLocalization()
  const base = `connections/${encodeURIComponent(connector.id)}/provider-direct`
  const schema = useMemo(() => directPolicyStatus(connector.id), [connector.id])
  const resource = useConnectorResource(canManage ? scopedConnectorPath(base, siteId) : null, schema)
  const mutation = useConnectorMutation()
  const [saved, setSaved] = useState<DirectPolicyStatus>()
  const [failed, setFailed] = useState(false)
  const snapshot = saved ?? resource.data
  const mismatch = !!snapshot && snapshot.revision !== connector.revision
  const error = resource.error || (failed && mutation.error) || (mismatch && new ConnectorRequestError("conflict", 409))
  const status = canManage && !error ? snapshot : undefined
  const refresh = () => { setFailed(false); setSaved(undefined); resource.reload() }
  // Recovery never broadens permission or needs a working provider catalogue.
  async function revoke() {
    if (!status || mutation.pending) return
    const change = { site_id: siteId, expected_revision: status.revision, expected_direct_revision: status.direct_revision, enabled: false }
    const receipt = await mutation.run(`/api/connectors/${base}`, change, directPolicyStatus(connector.id, change, status.setup_pending !== undefined), "PATCH")
    if (receipt) {
      // PATCH receipts can use the legacy shape. Only GET reports the current authority.
      if (status.authorization_mode === "member_policy") refresh()
      else setSaved(receipt)
      toast.success(t("connectors.directRevoked", { account: connector.display_name }))
    } else setFailed(true)
  }
  return { status, error, mismatch, pending: mutation.pending, cleared: !!saved, refresh, revoke }
}

function askState(status: DirectPolicyStatus, connector: Connector, policy?: ConnectorAccess["policy"]) {
  if (status.unsupported_reason) return "unsupported"
  if (status.explicitly_disabled) return "disabled"
  if (status.setup_pending) return "pending"
  if (!status.enabled) return status.attested ? "off" : "unverified"
  if (!connector.enabled || !connector.verified_at || connector.provider_status !== "ACTIVE" || connector.revocation_pending || connector.revocation_dispatched) return "blocked"
  if (!policy) return "on"
  if (!policy.tool_access_mode) return "scopeUnknown"
  return policy.allowed_hosts.includes("assistant") && (policy.tool_access_mode === "all" || policy.allowed_tools.length > 0) ? "available" : "blocked"
}

export function AskStatus({ resource, connector, policy, onRefresh, onRevoke, disabled }: {
  resource: ReturnType<typeof useAskStatus>; connector: Connector; policy?: ConnectorAccess["policy"];
  onRefresh: () => void; onRevoke: () => void; disabled?: boolean
}) {
  const { t } = useLocalization()
  const { status, error, cleared, pending } = resource
  if (error) return <ConnectorError error={error} retry={onRefresh} />
  if (!status) return <p role="status" className="text-sm">{t("connectors.directLoading")}</p>
  const state = askState(status, connector, policy)
  const generic = status.authorization_mode === "member_policy"
  const memberLabels: Record<string, string> = { unsupported: "connectors.genericUnsupported", unverified: "connectors.genericUnverified", blocked: "connectors.policyBlocked" }
  const stateLabel = (generic && memberLabels[state]) || `connectors.askState.${state}`
  const clear = !status.explicitly_disabled && !cleared && !status.enabled && !status.setup_pending && (!policy || (!status.attested && !status.unsupported_reason))
  // Preserve a local immediate revoke/cancel path even if a draft or provider is unusable.
  const revoke = !status.explicitly_disabled && (status.setup_pending || clear || (status.enabled && (status.authorization_mode === "member_policy" || !policy || state !== "available")))
  return <div className="space-y-2 text-sm" role="group" aria-label={t("connectors.directTitle")}>
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">{t(stateLabel)}</Badge>
      {revoke && <Button type="button" variant="outline" size="sm" disabled={pending || disabled} onClick={onRevoke}>
        {t(status.setup_pending ? "connectors.cancelAskSetup" : status.enabled ? "connectors.directDisable" : "connectors.directClear")}
      </Button>}
      <Button type="button" variant="ghost" size="sm" disabled={pending || disabled} onClick={onRefresh}>{t("connectors.refresh")}</Button>
    </div>
    <p className="text-muted-foreground">{t(generic && state === "unsupported"
      ? "connectors.genericUnsupportedHelp" : `connectors.askHelp.${state}`)}</p>
  </div>
}

/** Mounted only for managers, keyed by site, account and revision. */
export function DirectPolicyControls({ siteId, connector, onChanged }: { siteId: string; connector: Connector; onChanged: () => void }) {
  const resource = useAskStatus(siteId, connector, true)
  return <AskStatus resource={resource} connector={connector} onRevoke={() => void resource.revoke()}
    onRefresh={() => { resource.refresh(); if (resource.mismatch) onChanged() }} />
}
