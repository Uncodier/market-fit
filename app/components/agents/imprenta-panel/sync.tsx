import type { ImprentaContext } from './data-types'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { InstanceNode } from '@/app/types/instance-nodes'

type NodePayload = RealtimePostgresChangesPayload<InstanceNode> & { old: Partial<InstanceNode> & { id: string } }
import { useEffect, useLayoutEffect } from "react"
import { resolveImprentaSync } from "@/app/lib/imprenta-instance-sync"
import { WF_LOAD_NODE_TYPES } from "@/app/components/workflows/types"
import { normalizeImprentaNodeForResultMediaType } from './result-helpers'
import type { useImprentaPanelState } from './state'

type ImprentaSynchronizationOptions = Pick<ReturnType<typeof useImprentaPanelState>, "imprentaData" | "imprentaSyncedInstanceRef" | "imprentaRequestedInstanceRef" | "deletedNodeIdsRef" | "setInitialPrompt" | "setDummyNodes" | "setPositions" | "setGeneratingNodeIds" | "setSelectedContextId" | "hoverStore" | "setZoomedMedia" | "setTempConnection" | "setNodes" | "setContexts" | "nodesRef" | "supabase" | "nodeHeightsRef" | "refreshImprentaData"> & { activeInstanceId?: string }

export function useImprentaSynchronization({
  imprentaData,
  imprentaSyncedInstanceRef,
  imprentaRequestedInstanceRef,
  deletedNodeIdsRef,
  setInitialPrompt,
  setDummyNodes,
  setPositions,
  setGeneratingNodeIds,
  setSelectedContextId,
  hoverStore,
  setZoomedMedia,
  setTempConnection,
  setNodes,
  setContexts,
  nodesRef,
  supabase,
  nodeHeightsRef,
  refreshImprentaData,
  activeInstanceId,
}: ImprentaSynchronizationOptions) {
  useLayoutEffect(() => {
    const res = resolveImprentaSync(
      activeInstanceId,
      imprentaData,
      imprentaSyncedInstanceRef.current,
      imprentaRequestedInstanceRef.current,
      {
        resetEphemeralState: () => {
          deletedNodeIdsRef.current.clear()
          setInitialPrompt("")
          setDummyNodes([])
          setPositions({})
          setGeneratingNodeIds(new Set())
          setSelectedContextId(null)
          hoverStore.set(null)
          setZoomedMedia(null)
          setTempConnection(null)
        },
        setNodes: (incoming) => {
          setNodes(incoming.filter(n => !deletedNodeIdsRef.current.has(n.id)))
        },
        setContexts: (incoming) => setContexts(incoming as ImprentaContext[]),
      }
    )
    imprentaSyncedInstanceRef.current = res.syncedId
    imprentaRequestedInstanceRef.current = res.requestedId
  }, [activeInstanceId, imprentaData, hoverStore])

  useEffect(() => {
    if (!activeInstanceId) return

    // Subscribe to realtime updates for nodes
    let cancelled = false
    let nodeBatchBuffer: NodePayload[] = []
    let nodeBatchTimeout: NodeJS.Timeout | null = null

    const handleNodePayload = (payload: NodePayload) => {
      if (payload.eventType === 'INSERT') {
        const incoming = payload.new as InstanceNode
        if (deletedNodeIdsRef.current.has(incoming.id)) return
        const normalized = normalizeImprentaNodeForResultMediaType(incoming, nodesRef.current)
        const typeChanged = normalized.type !== incoming.type
        const mediaChanged =
          (normalized.settings)?.media_type !== (incoming.settings)?.media_type
        if (typeChanged || mediaChanged) {
          void supabase
            .from("instance_nodes")
            .update({ type: normalized.type, settings: normalized.settings })
            .eq("id", incoming.id)
        }
        setNodes(prev => {
          if (prev.some(n => n.id === incoming.id)) return prev;
          return [...prev, normalized];
        })
        setDummyNodes(prev => {
          // Find dummies for the same parent
          const dummiesForParent = prev.filter(d => d.parent_node_id === incoming.parent_node_id);

          if (dummiesForParent.length > 0) {
            // Get the first dummy that hasn't been replaced yet
            const dummyToReplace = dummiesForParent[0];
            const index = prev.findIndex(d => d.id === dummyToReplace.id);

            if (index !== -1) {
              // Pre-assign the dummy's position and height to the new real node
              setPositions(currPositions => {
                if (currPositions[dummyToReplace.id]) {
                  const newPositions = {
                    ...currPositions,
                    [incoming.id]: currPositions[dummyToReplace.id]
                  };

                  if (nodeHeightsRef.current[dummyToReplace.id]) {
                    nodeHeightsRef.current[incoming.id] = nodeHeightsRef.current[dummyToReplace.id];
                  }

                  // Immediately clean up the dummy node's position so it doesn't bump the new node
                  delete newPositions[dummyToReplace.id];

                  return newPositions;
                }
                return currPositions;
              });

              setGeneratingNodeIds(prev => {
                const next = new Set(prev);
                next.add(incoming.id);
                return next;
              });

              const copy = [...prev];
              copy.splice(index, 1);
              return copy;
            }
          }
          return prev;
        })
      } else if (payload.eventType === 'UPDATE') {
        const incoming = payload.new as InstanceNode
        if (deletedNodeIdsRef.current.has(incoming.id)) return
        const normalized = normalizeImprentaNodeForResultMediaType(incoming, nodesRef.current)
        const typeChanged = normalized.type !== incoming.type
        const mediaChanged =
          (normalized.settings)?.media_type !== (incoming.settings)?.media_type
        if (typeChanged || mediaChanged) {
          void supabase
            .from("instance_nodes")
            .update({ type: normalized.type, settings: normalized.settings })
            .eq("id", incoming.id)
        }

        setNodes(prev => prev.map(n => n.id === incoming.id ? normalized : n))

        if (incoming.status === 'completed' || incoming.status === 'failed') {
          setGeneratingNodeIds(prev => {
            if (prev.has(incoming.id)) {
              const next = new Set(prev);
              next.delete(incoming.id);
              return next;
            }
            return prev;
          });
        }

        // If the executed node fails or completes without a child, we might want to clear dummy children
        if (incoming.status === 'failed' || incoming.status === 'completed') {
          setDummyNodes(prev => {
            const toRemove = prev.filter(d => d.parent_node_id === incoming.id);
            if (toRemove.length > 0) {
              // Also clean up their positions to prevent memory leaks
              setPositions(curr => {
                const copy = { ...curr };
                toRemove.forEach(d => delete copy[d.id]);
                return copy;
              });
              return prev.filter(d => d.parent_node_id !== incoming.id);
            }
            return prev;
          });
        }
      } else if (payload.eventType === 'DELETE') {
        deletedNodeIdsRef.current.delete(payload.old.id)
        setNodes(prev => prev.filter(n => n.id !== payload.old.id))
      }
    }

    const subscription = supabase
      .channel(`instance_nodes_${activeInstanceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'instance_nodes',
        filter: `instance_id=eq.${activeInstanceId}`
      }, (payload: NodePayload) => {
        // Skip workflow nodes arriving via realtime
        const type = ("type" in payload.new ? payload.new.type : undefined) || payload.old?.type
        if (type && (WF_LOAD_NODE_TYPES as readonly string[]).includes(type)) return

        nodeBatchBuffer.push(payload)
        if (!nodeBatchTimeout) {
          nodeBatchTimeout = setTimeout(() => {
            nodeBatchTimeout = null
            const batch = nodeBatchBuffer
            nodeBatchBuffer = []
            // Using flushSync is generally not needed in React 18, 
            // setNodes inside timeout is already batched automatically.
            batch.forEach(handleNodePayload)
          }, 100)
        }
      })
      .subscribe()

    // Subscribe to realtime updates for contexts
    let contextTimeout: NodeJS.Timeout | null = null
    const contextSubscription = supabase
      .channel(`instance_node_contexts_${activeInstanceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'instance_node_contexts'
      }, () => {
        if (contextTimeout) clearTimeout(contextTimeout)
        contextTimeout = setTimeout(async () => {
          // Refetch contexts on any change
          const currentNodes = nodesRef.current.map(n => n.id)
          if (currentNodes.length > 0) {
            const { data } = await supabase.from('instance_node_contexts').select('*').in('target_node_id', currentNodes)
            if (data) setContexts(data)
          }
        }, 500)
      })
      .subscribe()

    let visibilityTimeout: NodeJS.Timeout | null = null
    const reconcileFromServer = async (includeLogs: boolean) => {
      try {
        const data = await refreshImprentaData({ includeLogs })
        if (!data || cancelled || imprentaRequestedInstanceRef.current !== activeInstanceId) return
        setNodes(data.nodes.filter(n => !deletedNodeIdsRef.current.has(n.id)))
        setContexts(data.contexts as ImprentaContext[])
      } catch (error) {
        if (!cancelled) console.error("Failed to reconcile Imprenta data", error)
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (visibilityTimeout) clearTimeout(visibilityTimeout)
        visibilityTimeout = setTimeout(() => {
          void reconcileFromServer(true)
        }, 1000)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    // Fallback reconcile while nodes are in-flight (covers missed Realtime events)
    const reconcileInterval = setInterval(() => {
      const hasInFlight = nodesRef.current.some((n) =>
        ['running', 'pending', 'starting'].includes(n.status)
      )
      if (hasInFlight && document.visibilityState === 'visible') {
        void reconcileFromServer(false)
      }
    }, 15000)

    return () => {
      cancelled = true
      if (visibilityTimeout) clearTimeout(visibilityTimeout)
      clearInterval(reconcileInterval)
      document.removeEventListener('visibilitychange', handleVisibility)
      if (nodeBatchTimeout) clearTimeout(nodeBatchTimeout)
      if (contextTimeout) clearTimeout(contextTimeout)
      try { supabase.removeChannel(subscription) } catch { /* ignore */ }
      try { supabase.removeChannel(contextSubscription) } catch { /* ignore */ }
    }
  }, [activeInstanceId, supabase, refreshImprentaData])

  return {}
}
