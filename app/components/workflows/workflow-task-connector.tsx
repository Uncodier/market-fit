"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { scopedConnectorPath } from "@/app/connectors/connector-request"
import { connectionsSchema } from "@/app/connectors/types"
import { useConnectorResource } from "@/app/connectors/use-connector-resource"
import { isRobotConnectorId } from "@/lib/navigation/robot-connector-hint"
import { WF_FIELD_CLASS } from "./types"
import { TaskConnectorAuthorization } from "./task-connector-authorization"

export function WorkflowTaskConnector({ siteId, instanceId, nodeId, selectedId, onSave }: {
  siteId: string
  instanceId: string
  nodeId: string
  selectedId?: string | null
  onSave: (id: string | null) => Promise<unknown>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  // Canvases can contain many steps. Fetch private account labels only on demand.
  const { data, error, reload } = useConnectorResource(editing && siteId
    ? scopedConnectorPath("connections", siteId) : null, connectionsSchema)
  const accounts = (data?.items ?? []).filter(account => isRobotConnectorId(account.id))
  async function save(id: string | null) {
    if (saving || (id !== null && !accounts.some(account => account.id === id))) return
    setSaving(true)
    setFailed(false)
    try {
      await onSave(id)
      setEditing(false)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }
  return <div className="flex flex-col gap-1 border-t pt-2">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-medium">Connector</span>
      <Button type="button" size="sm" variant="ghost" disabled={saving || !siteId}
        aria-expanded={editing} onClick={() => { setFailed(false); setEditing(!editing) }}>
        {editing ? "Close" : selectedId ? "Change connector" : "Select connector"}
      </Button>
    </div>
    {selectedId && <p className="text-xs">Account selected · Review scheduled authorization separately</p>}
    {editing && <>
      {error ? <div role="alert">Could not load accounts. <Button type="button" onClick={reload}>Retry</Button></div>
        : !data ? <p role="status">Loading accounts…</p>
        : accounts.length ? <select aria-label="Task connector account" className={WF_FIELD_CLASS}
          disabled={saving} value={accounts.some(a => a.id === selectedId) ? selectedId! : ""}
          onChange={event => void save(event.target.value)}>
          <option value="" disabled>Select a visible account</option>
          {accounts.map(account => <option key={account.id} value={account.id}>
            {account.display_name} · {account.toolkit_slug} · {account.id.slice(-8)}
          </option>)}
        </select> : <p>No visible connector accounts.</p>}
      {selectedId && <Button type="button" variant="ghost" disabled={saving} onClick={() => void save(null)}>Remove selection</Button>}
      {failed && <p role="alert">Could not confirm the change. Reload the task to check its saved selection.</p>}
      <TaskConnectorAuthorization key={`${nodeId}:${selectedId ?? ''}`} siteId={siteId} instanceId={instanceId} nodeId={nodeId} selectedId={selectedId} toolkit={accounts.find(a => a.id === selectedId)?.toolkit_slug} />
    </>}
    <p className="text-[11px] text-muted-foreground">Optional. No sandbox required. Selecting an account does not grant execution access.</p>
  </div>
}