"use client"

import { Button } from "@/app/components/ui/button"
import { useState, type ReactNode } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { accessPrincipals, exceptionStatus, isExpired, type PrincipalKind } from "./connector-access-principals"
import type { ConnectorAccess } from "./types"

export function ConnectorAccessList({ access, kind, onEdit, disabled, editingId, editor }: {
  access: ConnectorAccess; kind: PrincipalKind; onEdit: (id: string) => void; disabled: boolean; editingId: string | null; editor: ReactNode
}) {
  const { t } = useLocalization()
  const [now] = useState(() => Date.now())
  const workspace = access.access_mode === "workspace"
  const principals = accessPrincipals(access, kind)
  const inherited = workspace ? principals.filter(principal => principal.eligible && !principal.row) : []
  const exceptions = principals.flatMap(({ id, label, row, eligible }) => row ? [{ id, label, row, eligible }] : [])

  return <div className="min-w-0 space-y-3">
    {workspace && <>
      {inherited.length > 0 ? <details className="rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer">{t("connectors.inheritedCount", { count: inherited.length })}</summary>
        <ul className="mt-2 space-y-1 text-muted-foreground">{inherited.map(({ id, label }) => <li key={id}>{label}</li>)}</ul>
      </details> : <p className="text-sm text-muted-foreground">{t("connectors.noneInherited")}</p>}
    </>}
    {!exceptions.length && <p className="text-sm text-muted-foreground">{t(workspace ? "connectors.noExceptions" : "connectors.noSavedGrants")}</p>}
    <ul className="space-y-2 text-sm">{exceptions.map(({ id, label, row, eligible }) => {
      const use = "enabled" in row ? row.enabled : row.can_use
      const legacyStatus = use ? "connectors.canUse" : "can_view" in row && row.can_view ? "connectors.canView" : "connectors.noGrant"
      return <li key={id} className="break-words rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2"><span className="font-medium">{label}</span>
          <Button type="button" size="sm" variant="ghost" disabled={disabled} aria-label={t("connectors.editRelation", { name: label })} onClick={() => onEdit(id)}>{t("connectors.edit")}</Button>
        </div>
        {workspace && !eligible && <p className="text-xs text-muted-foreground">{t("connectors.noLongerEligible")}</p>}
        <p className="text-xs text-muted-foreground">{t(workspace ? exceptionStatus(row, now) : legacyStatus)}</p>
        {workspace && row.revoked_at && <p className="text-xs text-muted-foreground">{t("connectors.revokedAt", { date: new Date(row.revoked_at).toLocaleString() })}</p>}
        {row.expires_at && <p className="text-xs text-muted-foreground">{t(isExpired(row.expires_at, now) ? "connectors.expiredAt" : "connectors.expiresAt", { date: new Date(row.expires_at).toLocaleString() })}</p>}
        {editingId === id && editor}
      </li>
    })}</ul>
  </div>
}