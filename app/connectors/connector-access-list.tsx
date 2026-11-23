"use client"

import { Button } from "@/app/components/ui/button"
import { useState, type ReactNode } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { type accessPrincipals, exceptionStatus, isExpired, type PrincipalKind } from "./connector-access-principals"

export function ConnectorAccessList({ principals, workspace, kind, onEdit, disabled, editingId, editor }: {
  principals: ReturnType<typeof accessPrincipals>; workspace: boolean; kind: PrincipalKind; onEdit: (id: string) => void; disabled: boolean; editingId: string | null; editor: ReactNode
}) {
  const { t } = useLocalization()
  const [now] = useState(() => Date.now())
  const withoutRow = principals.filter(principal => principal.eligible && !principal.row)
  const saved = principals.flatMap(({ id, label, row, eligible }) => row ? [{ id, label, row, eligible }] : [])

  return <div className="min-w-0 space-y-3">
    {(workspace || kind === "agent") && <>
      {withoutRow.length > 0 ? <details className="rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer">{t(workspace ? "connectors.inheritedCount" : "connectors.withoutGrantCount", { count: withoutRow.length })}</summary>
        <ul className="mt-2 space-y-1 text-muted-foreground">{withoutRow.map(({ id, label }) => <li key={id}>{label}</li>)}</ul>
      </details> : workspace && <p className="text-sm text-muted-foreground">{t("connectors.noneInherited")}</p>}
    </>}
    {!saved.length && <p className="text-sm text-muted-foreground">{t(workspace ? "connectors.noExceptions" : "connectors.noSavedGrants")}</p>}
    <ul className="space-y-2 text-sm">{saved.map(({ id, label, row, eligible }) => {
      const current = eligible && !row.revoked_at && !isExpired(row.expires_at, now)
      const use = current && ("enabled" in row ? row.enabled : row.can_use)
      const grantStatus = use ? "connectors.canUse" : current && "can_view" in row && row.can_view ? "connectors.canView" : "connectors.noGrant"
      return <li key={id} className="break-words rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2"><span className="font-medium">{label}</span>
          <Button type="button" size="sm" variant="ghost" disabled={disabled} aria-label={t("connectors.editRelation", { name: label })} onClick={() => onEdit(id)}>{t("connectors.edit")}</Button>
        </div>
        {!eligible && <p className="text-xs text-muted-foreground">{t("connectors.noLongerEligible")}</p>}
        <p className="text-xs text-muted-foreground">{t(workspace ? exceptionStatus(row, now) : grantStatus)}</p>
        {row.revoked_at && <p className="text-xs text-muted-foreground">{t("connectors.revokedAt", { date: new Date(row.revoked_at).toLocaleString() })}</p>}
        {row.expires_at && <p className="text-xs text-muted-foreground">{t(isExpired(row.expires_at, now) ? "connectors.expiredAt" : "connectors.expiresAt", { date: new Date(row.expires_at).toLocaleString() })}</p>}
        {editingId === id && editor}
      </li>
    })}</ul>
  </div>
}