import type { InstanceNode } from '@/app/types/instance-nodes'

export function hasRecoverableImprentaExecution(
  nodes: readonly InstanceNode[],
  instanceId: string,
  generatingNodeIds?: ReadonlySet<string>,
): boolean {
  return nodes.some(node => {
    if (node.instance_id !== instanceId) return false
    // Keep the backend's starting state compatible with the narrower client type.
    if (['running', 'starting'].includes(node.status)) return true
    if (node.status !== 'pending') return false
    // The executor persists result.status before/during streaming. A parent log
    // alone is not execution evidence: branching from chat also creates drafts.
    return generatingNodeIds?.has(node.id) === true
      || ['running', 'streaming'].includes(node.result?.status)
  })
}

type ContextChange = {
  eventType: string
  new?: { target_node_id?: unknown }
  old?: { target_node_id?: unknown }
}

export function affectsImprentaContexts(
  payload: ContextChange,
  nodes: readonly InstanceNode[],
  instanceId: string,
): boolean {
  const targets = [payload.new?.target_node_id, payload.old?.target_node_id]
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  // DELETE may expose only its primary key under the table's replica identity.
  if (targets.length === 0) return payload.eventType === 'DELETE'
  return nodes.some(node => node.instance_id === instanceId && targets.includes(node.id))
}

/** At most one active read and one trailing request, retaining any log upgrade. */
export function createCoalescedReconciliation(
  reconcile: (includeLogs: boolean) => Promise<void>,
  isCurrent: () => boolean,
  onError: (error: unknown) => void,
): (includeLogs: boolean) => Promise<void> {
  let inFlight: Promise<void> | null = null
  let queued: boolean | null = null

  return includeLogs => {
    if (!isCurrent()) return Promise.resolve()
    queued = queued === null ? includeLogs : queued || includeLogs
    if (inFlight) return inFlight
    inFlight = Promise.resolve().then(async () => {
      try {
        while (queued !== null && isCurrent()) {
          const next = queued
          queued = null
          try {
            await reconcile(next)
          } catch (error) {
            if (isCurrent()) onError(error)
          }
        }
      } finally {
        inFlight = null
        queued = null
      }
    })
    return inFlight
  }
}