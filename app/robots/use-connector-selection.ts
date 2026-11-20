import { useState } from 'react'
import { isRobotConnectorId } from '@/lib/navigation/robot-connector-hint'
import { useConversationConnector } from './use-conversation-connector'

export function useConnectorSelection(hint: string | null | undefined, siteId?: string, userId?: string,
  instance?: { id?: string; site_id?: string } | null) {
  const canSelect = Boolean(siteId && userId && (!instance?.id || instance.site_id === siteId))
  const scope = JSON.stringify([siteId, userId, instance?.id, instance?.site_id, hint === undefined ? [] : [hint]])
  const [selection, setSelection] = useState({ scope, id: hint, revision: 0 })
  const current = selection.scope === scope ? selection : { scope, id: hint, revision: selection.revision + 1 }
  if (current !== selection) setSelection(current)
  const selectedId = current.id
  function selectConnector(id?: string) {
    if (id === undefined || (canSelect && isRobotConnectorId(id))) {
      setSelection(previous => ({ scope, id, revision: previous.revision + 1 }))
    }
  }
  return {
    connector: useConversationConnector(selectedId, siteId, userId, instance, current.revision),
    scope,
    selectedId,
    selectConnector,
    canSelect,
    manualOnly: hint !== undefined || selectedId !== undefined,
  }
}