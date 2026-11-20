import { useEffect, useState } from 'react'
import { connectorRequest, scopedConnectorPath } from '@/app/connectors/connector-request'
import { connectorSchema, isUsableConnector } from '@/app/connectors/types'

// Use only the authenticated local connection projection (never a provider catalog).
export function useConversationConnector(hint: string | null | undefined, siteId?: string, userId?: string,
  instance?: { id?: string; site_id?: string } | null, selectionRevision = 0) {
  const key = hint && siteId && userId && (!instance?.id || instance.site_id === siteId)
    ? JSON.stringify([hint, siteId, userId, instance?.id, selectionRevision]) : undefined
  const [state, setState] = useState<{ key: string; name?: string; toolkit?: string }>()
  useEffect(() => {
    if (!key || !siteId || !hint) return
    const controller = new AbortController()
    connectorRequest(scopedConnectorPath(`connections/${encodeURIComponent(hint)}`, siteId), connectorSchema, { signal: controller.signal }).then(account => {
      const usable = account.id === hint && isUsableConnector(account)
      if (!controller.signal.aborted) setState(usable ? { key, name: account.display_name, toolkit: account.toolkit_slug } : { key })
    }, () => { if (!controller.signal.aborted) setState({ key }) })
    return () => controller.abort()
  }, [key, siteId, hint])
  if (hint === undefined) return undefined
  if (key && state?.key !== key) return { notice: 'Checking the linked connector account…' }
  if (!key || !hint || !state?.toolkit) return { notice: 'This connector link is unavailable. Open a visible account from Connectors to try again.' }
  return { id: hint, name: state.name || state.toolkit, toolkit: state.toolkit, notice: `Selected connector: ${state.name || state.toolkit}. ${state.toolkit === 'supabase'
    ? 'Use Ask to request, for example, “List the tables in this project.”' : 'Use Ask to request an action for this account.'} Available actions depend on the instance’s permissions.` }
}