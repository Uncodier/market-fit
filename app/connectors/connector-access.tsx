"use client"

import { useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { SectionCard, SectionCardContent, SectionCardHeader } from "@/app/components/ui/section-card"
import { ConnectorError } from "./connector-feedback"
import { ConnectorAccessSkeleton } from "./connector-skeletons"
import { ConnectorGrantEditor } from "./connector-grant-editor"
import { ConnectorBulkAccess, type BulkAccessOperation } from "./connector-bulk-access"
import { accountManagementReceipt } from "./account-management-contract"
import { exceptionStatus } from "./connector-access-principals"
import { ConnectorPolicyEditor } from "./connector-policy-editor"
import { askPolicyReceipt, type AskAccessIntent } from "./provider-direct-contract"
import { ConnectorRequestError, scopedConnectorPath } from "./connector-request"
import { mutationResultSchema, useConnectorMutation, useConnectorResource } from "./use-connector-resource"
import { accessSchema, type Connector } from "./types"

export function ConnectorAccessPanel({ siteId, connector, canManage, onChanged }: {
  siteId: string; connector: Connector; canManage: boolean; onChanged: () => void
}) {
  const { t } = useLocalization()
  const [now] = useState(() => Date.now())
  const base = `connections/${encodeURIComponent(connector.id)}`
  const { data, error, reload } = useConnectorResource(scopedConnectorPath(`${base}/access`, siteId), accessSchema)
  const mutation = useConnectorMutation()
  if (error) return <ConnectorError error={error} retry={reload} />
  if (!data) return <ConnectorAccessSkeleton />
  // Never combine a newer policy revision with an older enabled/provider snapshot.
  if (data.connector_id !== connector.id || data.revision !== connector.revision) {
    return <ConnectorError error={new ConnectorRequestError("conflict", 409)} retry={() => { reload(); onChanged() }} />
  }
  const manageable = canManage && data.can_manage
  const workspace = data.access_mode === "workspace"
  // The non-manager DTO has at most the viewer's own persisted member exception.
  const ownException = !data.can_manage ? data.members[0] : undefined
  const save = async (path: "access" | "policy", update: object, intent?: AskAccessIntent) => {
    if (!manageable) return
    const receipt = intent ? askPolicyReceipt(connector.id, data.revision, intent) : mutationResultSchema
    const result = await mutation.run(`/api/connectors/${base}/${path}`, { site_id: siteId, expected_revision: data.revision, ...update }, receipt, "PATCH")
    if (result !== undefined) onChanged()
  }
  const removeAccess = async (operation: BulkAccessOperation) => {
    if (!manageable || mutation.pending || mutation.error) return
    const result = await mutation.run(`/api/connectors/${base}/manage`, { site_id: siteId, expected_revision: data.revision, operation },
      accountManagementReceipt(connector.id, data.revision, { operation }), "PATCH")
    if (result) onChanged()
  }
  return <div className="space-y-6">
    {!!mutation.error && <ConnectorError error={mutation.error} retry={onChanged} />}
    <SectionCard id="access">
      <SectionCardHeader title={t("connectors.access")} description={t(workspace ? "connectors.workspaceAccessHelp" : "connectors.explicitAccessHelp")} />
      <SectionCardContent>
        <p className="text-sm">{t(connector.can_use ? "connectors.useGranted" : "connectors.noMemberUse")}</p>
        {workspace && !data.can_manage && (ownException || connector.can_use) && <p className="text-sm text-muted-foreground">
          {t(ownException ? exceptionStatus(ownException, now) : "connectors.inheritsAccess")}
        </p>}
        {!manageable && <p className="text-sm text-muted-foreground">{t("connectors.managerOnly")}</p>}
      </SectionCardContent>
      {manageable && <ConnectorBulkAccess name={connector.display_name} members={workspace || data.members.length > 0}
        agents={data.agents.length > 0} disabled={mutation.pending || !!mutation.error} pending={mutation.pending} onConfirm={removeAccess} />}
    </SectionCard>
    {manageable && (["member", "agent"] as const).map(kind => <ConnectorGrantEditor key={`${data.connector_id}:${data.revision}:${kind}`} access={data} kind={kind} pending={mutation.pending || !!mutation.error} save={update => void save("access", update)} />)}
    <ConnectorPolicyEditor siteId={siteId} key={`${siteId}:${connector.id}:${data.revision}:${manageable}`} access={data} connector={connector} canManage={manageable} pending={mutation.pending} blocked={!!mutation.error} save={update => void save("policy", update, "ask_access" in update ? update.ask_access : undefined)} onChanged={onChanged} />
  </div>
}