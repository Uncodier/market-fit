"use client"

import { useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { PlusCircle, X } from "@/app/components/ui/icons"
import { SectionCard, SectionCardContent, SectionCardHeader } from "@/app/components/ui/section-card"
import { ConnectorAccessList } from "./connector-access-list"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { accessPrincipals, exceptionStatus, isExpired, type PrincipalKind } from "./connector-access-principals"
import type { AgentGrant, ConnectorAccess, MemberGrant } from "./types"

type Upsert = { members: MemberGrant[]; agents: AgentGrant[] }

export function ConnectorGrantEditor({ access, kind, pending, save }: {
  access: ConnectorAccess; kind: PrincipalKind; pending: boolean; save: (upsert: Upsert) => void
}) {
  const { t } = useLocalization()
  const member = kind === "member"
  const workspace = member && access.access_mode === "workspace"
  const options = accessPrincipals(access, kind)
  const [editing, setEditing] = useState<string | null>(null)
  const candidates = options.filter(option => option.eligible && !option.row)
  const principal = options.find(option => option.id === editing)
  const adding = editing !== null && !principal?.row
  const title = !member ? "connectors.agentGrants" : workspace ? "connectors.memberExceptions" : "connectors.members"
  const addLabel = member ? "connectors.addMember" : "connectors.addAgent"
  const cancel = <Button type="button" size="icon" variant="ghost" aria-label={t("connectors.cancel")} disabled={pending} onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
  return <SectionCard>
    <SectionCardHeader title={t(title)} description={t(!member ? "connectors.agentGrantsHelp" : workspace ? "connectors.exceptionsHelp" : "connectors.grantsHelp")} actions={
      <Button type="button" variant="outline" size="sm" disabled={pending || editing !== null || !candidates.length} onClick={() => setEditing("")}>
        <PlusCircle className="mr-2 h-4 w-4" />{t(addLabel)}
      </Button>} />
    <SectionCardContent>
      {adding && <div className="flex items-center gap-2">
        <Select value={editing ?? ""} onValueChange={setEditing} disabled={pending}>
          <SelectTrigger aria-label={t(member ? "connectors.selectMember" : "connectors.selectAgent")}><SelectValue placeholder={t(member ? "connectors.selectMember" : "connectors.selectAgent")} /></SelectTrigger>
          <SelectContent>{candidates.map(option => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
        </Select>{cancel}
      </div>}
      {adding && principal && <GrantForm key={principal.id} {...{ kind, principal, workspace, pending, save }} />}
      <ConnectorAccessList principals={options} workspace={workspace} kind={kind} onEdit={setEditing} disabled={pending || editing !== null} editingId={editing}
        editor={principal?.row && <div className="space-y-2"><GrantForm key={principal.id} {...{ kind, principal, workspace, pending, save }} />{cancel}</div>} />
    </SectionCardContent>
  </SectionCard>
}

function localDateTime(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function GrantForm({ kind, principal, workspace, pending, save }: {
  kind: PrincipalKind; principal: ReturnType<typeof accessPrincipals>[number]; workspace: boolean; pending: boolean; save: (upsert: Upsert) => void
}) {
  const { t } = useLocalization()
  const { id, row, eligible } = principal
  const revokeOnly = !eligible
  const inherits = workspace && !row
  const currentView = row && "can_view" in row ? row.can_view : inherits
  const [now] = useState(() => Date.now())
  const currentUse = row ? !row.revoked_at && !isExpired(row.expires_at, now) && ("can_use" in row ? row.can_use : row.enabled) : inherits
  const [view, setView] = useState(currentView)
  const [use, setUse] = useState(currentUse)
  const [expiry, setExpiry] = useState(localDateTime(row?.expires_at ?? null))
  const expiresAt = expiry ? new Date(expiry) : null
  const validExpiry = !expiresAt || (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > now)
  const canRestore = workspace && eligible && row && (!currentUse || isExpired(row.expires_at, now))
  const dirty = view !== currentView || use !== currentUse || expiry !== localDateTime(row?.expires_at ?? null)
  const canSave = !revokeOnly && validExpiry && (dirty || (!workspace && kind === "member")) && (kind === "member" || !!row || use)
  const upsert = (canView: boolean, canUse: boolean, expires: string | null): Upsert => kind === "member"
    ? { members: [{ user_id: id, can_view: canView, can_use: canUse, expires_at: expires }], agents: [] }
    : { members: [], agents: [{ agent_id: id, enabled: canUse, expires_at: expires }] }

  return <div className="space-y-3 rounded-lg border p-4">
    {workspace && <p className="text-sm">{t(row ? exceptionStatus(row, now) : "connectors.inheritsAccess")}</p>}
    {revokeOnly && <p className="text-sm text-muted-foreground">{t(workspace ? "connectors.blockOnlyHelp" : "connectors.revokeOnlyHelp")}</p>}
    {kind === "member" && <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={view} disabled={pending || revokeOnly} onCheckedChange={value => { setView(value === true); if (!value) setUse(false) }} />{t("connectors.canView")}
    </label>}
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={use} disabled={pending || revokeOnly} onCheckedChange={value => { setUse(value === true); if (value && kind === "member") setView(true) }} />{t("connectors.canUse")}
    </label>
    <div className="space-y-1"><Label htmlFor={`${kind}-expiry`}>{t(workspace ? "connectors.exceptionExpiry" : "connectors.expiry")}</Label>
      <Input id={`${kind}-expiry`} type="datetime-local" value={expiry} disabled={pending || revokeOnly} onChange={event => setExpiry(event.target.value)} />
      <p className="text-xs text-muted-foreground">{t(workspace ? "connectors.exceptionExpiryHelp" : "connectors.expiryHelp")}</p>
      {!validExpiry && <p role="alert" className="text-sm text-destructive">{t("connectors.invalidExpiry")}</p>}
    </div>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={pending || !canSave} onClick={() => save(upsert(view, use, expiresAt?.toISOString() ?? null))}>{t(workspace ? "connectors.saveException" : "connectors.saveGrant")}</Button>
      {(workspace || row) && <Button variant="outline" size="sm" disabled={pending} onClick={() => save(upsert(false, false, null))}>{t(workspace ? "connectors.blockAccess" : "connectors.revokeGrant")}</Button>}
      {canRestore && <Button variant="outline" size="sm" disabled={pending} onClick={() => save(upsert(true, true, null))}>{t("connectors.restoreAccess")}</Button>}
    </div>
    {canRestore && <p className="text-xs text-muted-foreground">{t("connectors.restoreAccessHelp")}</p>}
  </div>
}