import type { InstanceNode } from "@/app/types/instance-nodes"

export function resolveImprentaSync(
  activeInstanceId: string | undefined,
  imprentaData: { nodes: InstanceNode[]; contexts: any[] } | undefined,
  currentSyncedInstanceId: string | null,
  currentRequestedInstanceId: string | null,
  actions: {
    resetEphemeralState: () => void
    setNodes: (nodes: InstanceNode[]) => void
    setContexts: (contexts: any[]) => void
  }
): { syncedId: string | null; requestedId: string | null } {
  // 1. If the active instance changed (user navigated)
  if (activeInstanceId !== currentRequestedInstanceId) {
    actions.resetEphemeralState()
    
    if (!activeInstanceId) {
      actions.setNodes([])
      actions.setContexts([])
      return { syncedId: null, requestedId: null }
    }

    if (imprentaData) {
      actions.setNodes(imprentaData.nodes)
      actions.setContexts(imprentaData.contexts)
      return { syncedId: activeInstanceId, requestedId: activeInstanceId }
    } else {
      actions.setNodes([])
      actions.setContexts([])
      return { syncedId: null, requestedId: activeInstanceId }
    }
  }

  // 2. Active instance is the same as we requested.
  // Did data just arrive for it?
  if (activeInstanceId && currentSyncedInstanceId !== activeInstanceId && imprentaData) {
    actions.setNodes(imprentaData.nodes)
    actions.setContexts(imprentaData.contexts)
    return { syncedId: activeInstanceId, requestedId: activeInstanceId }
  }

  // 3. Either we are still waiting for data, or we already synced it (and realtime owns updates now).
  return { syncedId: currentSyncedInstanceId, requestedId: currentRequestedInstanceId }
}
